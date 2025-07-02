import {
  Learning,
  ResearchRequestBody,
  TokenUsage,
  SupportedModel,
} from "@/lib/types";
import { generateSubQueries } from "./agents/subQueryGenerator";
import { refineQuery } from "./agents/queryRefiner";
import { searchAndEvaluate } from "./agents/searchAndEvaluate";
import { fetchAndParseContent } from "./agents/contentFetcher";
import { extractLearning } from "./agents/learningExtractor";
import { generateReport } from "./agents/reportGenerator";
import { deconstructClaim } from "./agents/claimDeconstructor";
import { renderVerdict } from "./agents/synthesisAndVerdict";

// --- FIX #1: Add 'initialQuery' to the ResearchState type ---
type ResearchState = {
  initialQuery: string; // This holds the user's original query for context
  completedQueries: Set<string>;
  allLearnings: Learning[];
  tokenTracker: TokenUsage;
  approvedUrls: Set<string>;
};

async function factCheckWorkflow({
  claim,
  model,
  searchProvider,
  onData,
}: {
  claim: string;
  model: SupportedModel;
  searchProvider: "google" | "exa";
  onData: (data: any) => void;
}) {
  const state: ResearchState = {
    initialQuery: claim,
    completedQueries: new Set(),
    allLearnings: [],
    tokenTracker: { inputTokens: 0, outputTokens: 0 },
    approvedUrls: new Set(),
  };

  onData({ type: "query-start", data: `Deconstructing claim: "${claim}"` });
  const { queries, usage: deconstructUsage } = await deconstructClaim({
    claim,
    model,
  });
  state.tokenTracker.inputTokens += deconstructUsage.inputTokens;
  state.tokenTracker.outputTokens += deconstructUsage.outputTokens;
  onData({
    type: "token-usage",
    data: { step: "deconstruct-claim", usage: deconstructUsage },
  });

  for (const query of queries) {
    state.completedQueries.add(query);
    const { relevantResults, usage: evalUsage } = await searchAndEvaluate({
      query,
      existingUrls: Array.from(state.approvedUrls),
      model,
      searchProvider,
    });
    state.tokenTracker.inputTokens += evalUsage.inputTokens;
    state.tokenTracker.outputTokens += evalUsage.outputTokens;

    // Find one good source per query to gather evidence
    for (const result of relevantResults) {
      if (state.approvedUrls.has(result.url)) continue;
      const document = await fetchAndParseContent(result);
      if (document) {
        state.approvedUrls.add(result.url);
        const { learning, usage: learnUsage } = await extractLearning({
          query,
          document,
          model,
        });
        state.allLearnings.push(learning);
        onData({ type: "learning", data: { learning, usage: learnUsage } });
        break;
      }
    }
  }

  if (state.allLearnings.length > 0) {
    onData({ type: "report", data: "Synthesizing verdict..." });
    const { report, usage: verdictUsage } = await renderVerdict({
      claim,
      learnings: state.allLearnings,
      model,
    });
    state.tokenTracker.inputTokens += verdictUsage.inputTokens;
    state.tokenTracker.outputTokens += verdictUsage.outputTokens;
    onData({
      type: "fact-check-report",  
      data: { report, usage: verdictUsage },
    });
  } else {
    onData({
      type: "error",
      data: "Could not find enough information to verify the claim.",
    });
  }
}

// --- FIX #3: Define the missing 'createContextualPrompt' function ---
function createContextualPrompt(
  state: ResearchState,
  followUpQuestions: string[]
): string {
  const completedTopicsString = Array.from(state.completedQueries).join("; ");
  const followUpQuestionsString = followUpQuestions
    .map((q) => `- "${q}"`)
    .join("\n");

  return `You are a strategic AI Research Orchestrator. Your current mission is to guide the next phase of a deep research inquiry by generating precise, highly targeted search queries.

---

**Overall Research Goal:** "${state.initialQuery}"

**Topics and Sub-Queries Already Thoroughly Investigated and Documented:**
${completedTopicsString.length > 0 ? completedTopicsString : "None yet."}

**New, Unanswered Follow-Up Questions Requiring Investigation (Derived from recent learnings):**
${followUpQuestionsString}

---

**YOUR TASK:**
Generate a list of specific, focused, and actionable search engine queries. These queries must directly address the "New, Unanswered Follow-Up Questions" while explicitly aiming to explore aspects *not yet covered* by the "Topics and Sub-Queries Already Thoroughly Investigated."

**Strict Rules for Query Generation:**
1.  **Directly Address Follow-ups:** Each generated search query must directly aim to answer one or more of the provided "New, Unanswered Follow-Up Questions."
2.  **Avoid Redundancy:** Absolutely do NOT generate queries for topics or information already present in the "Topics and Sub-Queries Already Thoroughly Investigated." Prioritize truly novel investigative paths.
3.  **Specificity & Search-Engine Ready:** Queries must be concise, factual, and optimized for a web search engine. Avoid conversational language or vague terms.
4.  **Collective Coverage:** The generated queries should collectively aim to make significant progress in answering the *set* of follow-up questions.
5.  **Output Format:** Provide only the generated search queries. Each query on a new line, with no numbering, bullet points, or any other formatting characters.

---

**Generate the specific search queries now:**`;
}

// Renamed to 'deepResearch' for clarity, was 'recursiveOrchestrator'
// async function deepResearch({
//   prompt,
//   depth,
//   breadth,
//   model,
//   searchProvider,
//   onData,
//   state,
// }: {
//   prompt: string;
//   depth: number;
//   breadth: number;
//   model: SupportedModel;
//   searchProvider: "google" | "exa";
//   onData: (data: any) => void;
//   state: ResearchState;
// }) {
//   if (depth === 0) {
//     console.log("REACHED MAX DEPTH");
//     return;
//   }

//   onData({ type: "query-start", data: prompt });

//   const { queries: subQueries, usage: subQueryUsage } =
//     await generateSubQueries({ query: prompt, breadth, model });
//   state.tokenTracker.inputTokens += subQueryUsage.inputTokens;
//   state.tokenTracker.outputTokens += subQueryUsage.outputTokens;
//   onData({
//     type: "token-usage",
//     data: { step: "sub-query", usage: subQueryUsage },
//   });

//   // Declare the array to collect follow-up questions for this batch of sub-queries
//   const aggregatedFollowUpQuestions: string[] = [];

//   for (const subQuery of subQueries) {
//     if (state.completedQueries.has(subQuery)) continue;
//     state.completedQueries.add(subQuery);

//     const learningsBeforeSubQuery = state.allLearnings.length;

//     const { refinedQuery, usage: refinerUsage } = await refineQuery({
//       initialQuery: state.initialQuery,
//       subQuery,
//       model,
//     });
//     state.tokenTracker.inputTokens += refinerUsage.inputTokens;
//     state.tokenTracker.outputTokens += refinerUsage.outputTokens;
//     onData({
//       type: "refining-query",
//       data: { query: refinedQuery, usage: refinerUsage },
//     });

//     const { relevantResults, usage: evaluationUsage } = await searchAndEvaluate(
//       {
//         query: refinedQuery,
//         existingUrls: Array.from(state.approvedUrls),
//         model,
//         searchProvider,
//       }
//     );

//     state.tokenTracker.inputTokens += evaluationUsage.inputTokens;
//     state.tokenTracker.outputTokens += evaluationUsage.outputTokens;
//     onData({ type: "relevance-check", data: { usage: evaluationUsage } });

//     for (const result of relevantResults) {
//       if (state.approvedUrls.has(result.url)) continue;

//       const document = await fetchAndParseContent(result);
//       if (document) {
//         state.approvedUrls.add(document.metadata.url);

//         const { learning, usage: learningUsage } = await extractLearning({
//           query: subQuery,
//           document,
//           model,
//         });
//         state.allLearnings.push(learning);
//         onData({ type: "learning", data: { learning, usage: learningUsage } });

//         if (
//           learning.followUpQuestions &&
//           learning.followUpQuestions.length > 0
//         ) {
//           aggregatedFollowUpQuestions.push(...learning.followUpQuestions);
//         }
//         // Break to move to the next sub-query after finding one good source
//         break;
//       }
//     }

//     // After processing results for a sub-query, if there are follow-up questions, recurse.
//     if (depth > 1 && aggregatedFollowUpQuestions.length > 0) {
//       // Remove duplicates from aggregated follow-up questions
//       const uniqueFollowUpQuestions = [...new Set(aggregatedFollowUpQuestions)];
//       const newPromptForRecursion = createContextualPrompt(
//         state,
//         uniqueFollowUpQuestions
//       );
//       await deepResearch({
//         prompt: newPromptForRecursion,
//         depth: depth - 1,
//         breadth: Math.ceil(breadth / 2), // Consider if breadth needs adjustment based on # of follow-ups
//         model,
//         searchProvider,
//         onData,
//         state,
//       });
//     }

//     // Log if a sub-query (and its potential recursive calls) did not yield new learnings
//     if (state.allLearnings.length === learningsBeforeSubQuery) {
//       console.log(
//         `ORCHESTRATOR_INFO: Sub-query "${subQuery}" and its recursive calls did not yield new learnings. Initial query context: "${state.initialQuery}"`
//       );
//     }
//   }
// }

async function deepResearch({
  prompt,
  depth,
  breadth,
  model,
  onData,
  state,
  searchProvider, // <-- ADD this parameter
}: {
  prompt: string;
  depth: number;
  breadth: number;
  model: SupportedModel;
  onData: (data: any) => void;
  state: ResearchState;
  searchProvider: 'google' | 'exa'; // <-- ADD this parameter
}) {
  if (depth === 0) {
    console.log("REACHED MAX DEPTH");
    return;
  }

  onData({ type: "query-start", data: prompt });

  const { queries: subQueries, usage: subQueryUsage } =
    await generateSubQueries({ query: prompt, breadth, model });
  state.tokenTracker.inputTokens += subQueryUsage.inputTokens;
  state.tokenTracker.outputTokens += subQueryUsage.outputTokens;
  onData({
    type: "token-usage",
    data: { step: "sub-query", usage: subQueryUsage },
  });

  const aggregatedFollowUpQuestions: string[] = [];

  for (const subQuery of subQueries) {
    if (state.completedQueries.has(subQuery)) continue;
    state.completedQueries.add(subQuery);

    const learningsBeforeSubQuery = state.allLearnings.length;

    const { refinedQuery, usage: refinerUsage } = await refineQuery({
      initialQuery: state.initialQuery,
      subQuery,
      model,
    });
    state.tokenTracker.inputTokens += refinerUsage.inputTokens;
    state.tokenTracker.outputTokens += refinerUsage.outputTokens;
    onData({
      type: "refining-query",
      data: { query: refinedQuery, usage: refinerUsage },
    });

    // --- FIX: Pass the searchProvider down to the agent ---
    const { relevantResults, usage: evaluationUsage } = await searchAndEvaluate(
      {
        query: refinedQuery,
        existingUrls: Array.from(state.approvedUrls),
        model,
        searchProvider, // Pass the user's choice here
      }
    );

    state.tokenTracker.inputTokens += evaluationUsage.inputTokens;
    state.tokenTracker.outputTokens += evaluationUsage.outputTokens;
    onData({ type: "relevance-check", data: { usage: evaluationUsage } });

    for (const result of relevantResults) {
      if (state.approvedUrls.has(result.url)) continue;

      const document = await fetchAndParseContent(result);
      if (document) {
        state.approvedUrls.add(document.metadata.url);

        const { learning, usage: learningUsage } = await extractLearning({
          query: subQuery,
          document,
          model,
        });
        state.allLearnings.push(learning); // This is now correctly a Learning object
        onData({ type: "learning", data: { learning, usage: learningUsage } });

        if (
          learning.followUpQuestions &&
          learning.followUpQuestions.length > 0
        ) {
          aggregatedFollowUpQuestions.push(...learning.followUpQuestions);
        }
        break;
      }
    }
  }
  
  // --- LOGIC FIX: The recursive call now happens AFTER the for-loop has completed ---
  if (depth > 1 && aggregatedFollowUpQuestions.length > 0) {
    const uniqueFollowUpQuestions = [...new Set(aggregatedFollowUpQuestions)];
    const newPromptForRecursion = createContextualPrompt(
      state,
      uniqueFollowUpQuestions
    );
    await deepResearch({
      prompt: newPromptForRecursion,
      depth: depth - 1,
      breadth: Math.ceil(breadth / 2),
      model,
      onData,
      state,
      searchProvider, // Pass the provider down in recursion
    });
  }
}

export async function startResearch(
  requestBody: ResearchRequestBody & { model: SupportedModel },
  onData: (data: any) => void
) {
  // Initialize the state correctly, including the initialQuery
  if (requestBody.taskType === "fact-check") {
    // --- Call the fact-checking workflow ---
    await factCheckWorkflow({
      claim: requestBody.initialQuery,
      model: requestBody.model,
      searchProvider: requestBody.searchProvider,
      onData,
    });
  } else {
    // --- Call your existing deep research workflow ---
    const state: ResearchState = {
      initialQuery: requestBody.initialQuery,
      completedQueries: new Set<string>(),
      allLearnings: [],
      tokenTracker: { inputTokens: 0, outputTokens: 0 },
      approvedUrls: new Set<string>(),
    };

    await deepResearch({
      prompt: requestBody.initialQuery,
      depth: requestBody.depth || 2,
      breadth: requestBody.breadth || 3,
      model: requestBody.model,
      searchProvider: requestBody.searchProvider,
      onData,
      state,
    });

    if (state.allLearnings.length > 0) {
      const { report, usage: reportUsage } = await generateReport({
        learnings: state.allLearnings,
        query: requestBody.initialQuery,
        model: requestBody.model,
      });
      state.tokenTracker.inputTokens += reportUsage.inputTokens;
      state.tokenTracker.outputTokens += reportUsage.outputTokens;
      onData({ type: "report", data: { report, usage: reportUsage } });
    } else {
      onData({
        type: "error",
        data: "Research concluded, but no relevant learnings were found to generate a report.",
      });
    }
  }

  // The 'done' message is now sent once at the end, regardless of the path taken.
  onData({
    type: "done",
    data: {
      message: "Task complete.",
      // Note: A more advanced implementation would return totalUsage from each workflow.
      // For now, this signals completion.
      totalUsage: { inputTokens: 0, outputTokens: 0 }, // Placeholder, can be refined.
    },
  });
}

// Actually I have researched about E2B and they only provide CPU code runtime and it would be quite expensive to generate and run code on E2B sandbox.
// And Modal Needs Constand Debugging during code generation and E2B don't provide any kind of functionality related to this.

// import { Learning, ResearchRequestBody, TokenUsage, SupportedModel } from '@/lib/types';
// import { generateSubQueries } from './subQueryGenerator';
// import { searchAndEvaluate } from './searchAndEvaluate';
// import { refineQuery } from './queryRefiner';
// import { fetchAndParseContent } from './contentFetcher';
// import { extractLearning } from './learningExtractor';
// import { generateReport } from './reportGenerator';

// // --- FIX 1: Add 'initialQuery' to the ResearchState type definition ---
// type ResearchState = {
//   initialQuery: string;
//   completedQueries: Set<string>;
//   allLearnings: Learning[];
//   tokenTracker: TokenUsage;
//   approvedUrls: Set<string>;
// };

// // --- FIX 2: Define the missing 'createContextualPrompt' function ---
// function createContextualPrompt(state: ResearchState, followUpQuestions: string[]): string {
//     return `The overall research goal is: "${state.initialQuery}".
// We have already researched the following topics: ${Array.from(state.completedQueries).join(', ')}.
// Based on the last learning, please now investigate the following questions: ${followUpQuestions.join(', ')}.
// Generate focused search queries to answer these questions.`;
// }

// // This function was previously named recursiveOrchestrator
// async function deepResearch({
//   prompt,
//   depth,
//   breadth,
//   model,
//   onData,
//   state,
// }: {
//   prompt: string;
//   depth: number;
//   breadth: number;
//   model: SupportedModel;
//   onData: (data: any) => void;
//   state: ResearchState;
// }) {
//   if (depth === 0) {
//     console.log('REACHED MAX DEPTH');
//     return;
//   }

//   onData({ type: 'query-start', data: prompt });

//   const { queries: subQueries, usage: subQueryUsage } = await generateSubQueries({ query: prompt, breadth, model });
//   state.tokenTracker.inputTokens += subQueryUsage.inputTokens;
//   state.tokenTracker.outputTokens += subQueryUsage.outputTokens;
//   onData({ type: 'token-usage', data: { step: 'sub-query', usage: subQueryUsage } });

//   for (const subQuery of subQueries) {
//     if (state.completedQueries.has(subQuery)) continue;

//     const { refinedQuery, usage: refinerUsage } = await refineQuery({
//         initialQuery: state.initialQuery, // This line will now work
//         subQuery,
//         model,
//     });
//     state.tokenTracker.inputTokens += refinerUsage.inputTokens;
//     state.tokenTracker.outputTokens += refinerUsage.outputTokens;
//     onData({ type: 'refining-query', data: { query: refinedQuery, usage: refinerUsage }});

//     const { relevantResults, usage: evaluationUsage } = await searchAndEvaluate({
//       query: refinedQuery,
//       existingUrls: Array.from(state.approvedUrls),
//       model,
//     });

//     state.tokenTracker.inputTokens += evaluationUsage.inputTokens;
//     state.tokenTracker.outputTokens += evaluationUsage.outputTokens;
//     onData({ type: 'relevance-check', data: { usage: evaluationUsage } });

//     state.completedQueries.add(subQuery);

//     for (const result of relevantResults) {
//       const document = await fetchAndParseContent(result);
//       if (document) {
//         state.approvedUrls.add(document.metadata.url);

//         const { learning, usage: learningUsage } = await extractLearning({ query: subQuery, document, model });
//         state.allLearnings.push(learning);
//         state.tokenTracker.inputTokens += learningUsage.inputTokens;
//         state.tokenTracker.outputTokens += learningUsage.outputTokens;
//         onData({ type: 'learning', data: { learning, usage: learningUsage } });

//         if (depth > 1 && learning.followUpQuestions.length > 0) {
//           const newPromptForRecursion = createContextualPrompt(state, learning.followUpQuestions); // This line will now work
//           await deepResearch({
//             prompt: newPromptForRecursion,
//             depth: depth - 1,
//             breadth: Math.ceil(breadth / 2),
//             model,
//             onData,
//             state,
//           });
//         }
//       }
//     }
//   }
// }

// export async function startResearch(
//   { initialQuery, depth, breadth, model }: {
//       initialQuery: string;
//       depth: number;
//       breadth: number;
//       model: SupportedModel;
//   },
//   onData: (data: any) => void
// ) {
//   const state: ResearchState = {
//     initialQuery: initialQuery, // The state is now initialized correctly
//     completedQueries: new Set<string>(),
//     allLearnings: [],
//     tokenTracker: { inputTokens: 0, outputTokens: 0 },
//     approvedUrls: new Set<string>(),
//   };

//   await deepResearch({
//     prompt: initialQuery,
//     depth: depth,
//     breadth: breadth,
//     model,
//     onData,
//     state,
//   });

//   if (state.allLearnings.length > 0) {
//     const { report, usage: reportUsage } = await generateReport({
//       learnings: state.allLearnings,
//       query: initialQuery,
//       model,
//     });
//     state.tokenTracker.inputTokens += reportUsage.inputTokens;
//     state.tokenTracker.outputTokens += reportUsage.outputTokens;
//     onData({ type: 'report', data: { report, usage: reportUsage } });
//   }

//   onData({
//     type: 'done',
//     data: {
//       message: 'Research complete.',
//       totalUsage: state.tokenTracker,
//     },
//   });
// }

// import { generateSubQueries } from './subQueryGenerator';
// import { performSearch } from './searchOrchestrator';
// import { fetchAndParseContent } from './contentFetcher';
// import { extractLearning } from './learningExtractor';
// import { Learning, ResearchRequestBody, TokenUsage, SupportedModel } from '@/lib/types';
// import { generateReport } from './reportGenerator';
// // import { checkRelevance } from './relevanceChecker';
// import { searchAndEvaluate } from './searchAndEvaluate';
// import { refineQuery } from './queryRefiner';

// // State for a single research request
// type ResearchState = {
//   completedQueries: Set<string>;
//   allLearnings: Learning[];
//   tokenTracker: TokenUsage;
//   approvedUrls: Set<string>;
// };

// // async function recursiveOrchestrator({
// //   query,
// //   depth,
// //   breadth,
// //   model,
// //   onData,
// //   state,
// // }: {
// //   query: string;
// //   depth: number;
// //   breadth: number;
// //   model: SupportedModel;
// //   onData: (data: any) => void;
// //   state: ResearchState;
// // }) {
// //   if (depth === 0 || state.completedQueries.has(query)) {
// //     return;
// //   }

// //   console.log(`ORCHESTRATOR_START: query="${query}", depth=${depth}, breadth=${breadth}`);
// //   state.completedQueries.add(query);
// //   onData({ type: 'query-start', data: query });

// //   const { queries: subQueries, usage: subQueryUsage } = depth > 1
// //     ? await generateSubQueries({ query, breadth, model })
// //     : { queries: [query], usage: { inputTokens: 0, outputTokens: 0 } };

// //   state.tokenTracker.inputTokens += subQueryUsage.inputTokens;
// //   state.tokenTracker.outputTokens += subQueryUsage.outputTokens;
// //   if(subQueryUsage.inputTokens > 0) {
// //     onData({ type: 'token-usage', data: { step: 'sub-query', usage: subQueryUsage } });
// //   }

// //   const followUpQueue: string[] = [];

// //   for (const subQuery of subQueries) {
// //     if (state.completedQueries.has(subQuery)) continue;
// //     state.completedQueries.add(subQuery);

// //     const searchResults = await performSearch(subQuery);
// //     for (const result of searchResults) {
// //       const document = await fetchAndParseContent(result);
// //       if (document) {
// //         const { learning, usage: learningUsage } = await extractLearning({ query: subQuery, document, model });
// //         state.allLearnings.push(learning);
// //         state.tokenTracker.inputTokens += learningUsage.inputTokens;
// //         state.tokenTracker.outputTokens += learningUsage.outputTokens;
// //         onData({ type: 'learning', data: { learning, usage: learningUsage } });
// //         followUpQueue.push(...learning.followUpQuestions);
// //       }
// //     }
// //   }

// //   if (depth > 1) {
// //     const uniqueFollowUps = [...new Set(followUpQueue)];
// //     for (const followUp of uniqueFollowUps) {
// //       await recursiveOrchestrator({
// //         query: followUp,
// //         depth: depth - 1,
// //         breadth: Math.ceil(breadth / 2),
// //         model,
// //         onData,
// //         state,
// //       });
// //     }
// //   }
// // }

// // async function recursiveOrchestrator({
// //   query,
// //   depth,
// //   breadth,
// //   model,
// //   onData,
// //   state,
// // }: {
// //   query: string;
// //   depth: number;
// //   breadth: number;
// //   model: SupportedModel;
// //   onData: (data: any) => void;
// //   state: ResearchState;
// // }) {
// //   if (depth === 0 || state.completedQueries.has(query)) {
// //     return;
// //   }

// //   console.log(`ORCHESTRATOR_START: query="${query}", depth=${depth}, breadth=${breadth}`);
// //   onData({ type: 'query-start', data: query });

// //   // --- FIX: DO NOT add the parent query to completedQueries here. ---
// //   // It should only be added when it's actively being processed in the loop below.
// //   // state.completedQueries.add(query); // <-- THIS LINE IS REMOVED.

// //   const { queries: subQueries, usage: subQueryUsage } = depth > 1
// //     ? await generateSubQueries({ query, breadth, model })
// //     : { queries: [query], usage: { inputTokens: 0, outputTokens: 0 } };

// //   state.tokenTracker.inputTokens += subQueryUsage.inputTokens;
// //   state.tokenTracker.outputTokens += subQueryUsage.outputTokens;
// //   if(subQueryUsage.inputTokens > 0) {
// //     onData({ type: 'token-usage', data: { step: 'sub-query', usage: subQueryUsage } });
// //   }

// //   const followUpQueue: string[] = [];

// //   for (const subQuery of subQueries) {
// //     // Check for completion here, right before processing the specific sub-query.
// //     if (state.completedQueries.has(subQuery)) continue;

// //     // NOW we mark this specific sub-query as being processed.
// //     state.completedQueries.add(subQuery);

// //     const searchResults = await performSearch(subQuery);

// //     const { relevantResults, usage: evaluationUsage } = await searchAndEvaluate({
// //       query: subQuery,
// //       existingUrls: Array.from(state.approvedUrls),
// //       model,
// //     });

// //     state.tokenTracker.inputTokens += evaluationUsage.inputTokens;
// //     state.tokenTracker.outputTokens += evaluationUsage.outputTokens;
// //     onData({ type: 'relevance-check', data: { usage: evaluationUsage } });

// //     for (const result of relevantResults) {
// //       const document = await fetchAndParseContent(result);
// //       if (document) {
// //         state.approvedUrls.add(document.metadata.url);
// //         const { learning, usage: learningUsage } = await extractLearning({ query: subQuery, document, model });
// //         state.allLearnings.push(learning);
// //         state.tokenTracker.inputTokens += learningUsage.inputTokens;
// //         state.tokenTracker.outputTokens += learningUsage.outputTokens;
// //         onData({ type: 'learning', data: { learning, usage: learningUsage } });
// //         followUpQueue.push(...learning.followUpQuestions);
// //       }
// //     }
// //   }

// //   if (depth > 1) {
// //     const uniqueFollowUps = [...new Set(followUpQueue)];
// //     for (const followUp of uniqueFollowUps) {
// //       await recursiveOrchestrator({
// //         query: followUp,
// //         depth: depth - 1,
// //         breadth: Math.ceil(breadth / 2),
// //         model,
// //         onData,
// //         state,
// //       });
// //     }
// //   }
// // }

// async function recursiveOrchestrator({
//   query, // This is the prompt for the current level
//   depth,
//   breadth,
//   model,
//   onData,
//   state,
// }: {
//   query: string;
//   depth: number;
//   breadth: number;
//   model: SupportedModel;
//   onData: (data: any) => void;
//   state: ResearchState;
// }) {
//   if (depth === 0 || state.completedQueries.has(query)) {
//     // Stop if we've hit max depth or are in a loop
//     if (depth === 0) console.log('REACHED MAX DEPTH');
//     return;
//   }

//   console.log(`ORCHESTRATOR_START: query="${query}", depth=${depth}, breadth=${breadth}`);
//   onData({ type: 'query-start', data: query });

//   // Step 1: Generate conceptual sub-queries from the current level's prompt
//   const { queries: subQueries, usage: subQueryUsage } = await generateSubQueries({ query, breadth, model });
//   state.tokenTracker.inputTokens += subQueryUsage.inputTokens;
//   state.tokenTracker.outputTokens += subQueryUsage.outputTokens;
//   onData({ type: 'token-usage', data: { step: 'sub-query', usage: subQueryUsage } });

//   for (const subQuery of subQueries) {
//     if (state.completedQueries.has(subQuery)) continue;

//     // --- NEW LOGIC INTEGRATED HERE ---

//     // Step 2: Refine the conceptual sub-query into an effective search string
//     const { refinedQuery, usage: refinerUsage } = await refineQuery({
//         initialQuery: state.initialQuery, // Use the overall goal for context
//         subQuery,
//         model,
//     });
//     state.tokenTracker.inputTokens += refinerUsage.inputTokens;
//     state.tokenTracker.outputTokens += refinerUsage.outputTokens;
//     onData({ type: 'refining-query', data: { query: refinedQuery, usage: refinerUsage }});

//     // Step 3: Search and Evaluate using the REFINED query
//     const { relevantResults, usage: evaluationUsage } = await searchAndEvaluate({
//       query: refinedQuery,
//       existingUrls: Array.from(state.approvedUrls),
//       model,
//     });

//     state.tokenTracker.inputTokens += evaluationUsage.inputTokens;
//     state.tokenTracker.outputTokens += evaluationUsage.outputTokens;
//     onData({ type: 'relevance-check', data: { usage: evaluationUsage } });

//     // Mark the conceptual sub-query as completed to prevent re-processing this path
//     state.completedQueries.add(subQuery);

//     for (const result of relevantResults) {
//       const document = await fetchAndParseContent(result);
//       if (document) {
//         state.approvedUrls.add(document.metadata.url);

//         const { learning, usage: learningUsage } = await extractLearning({ query: subQuery, document, model });
//         state.allLearnings.push(learning);
//         state.tokenTracker.inputTokens += learningUsage.inputTokens;
//         state.tokenTracker.outputTokens += learningUsage.outputTokens;
//         onData({ type: 'learning', data: { learning, usage: learningUsage } });

//         // --- THE CORRECTED RECURSION ---
//         if (depth > 1 && learning.followUpQuestions.length > 0) {
//           const newPromptForRecursion = createContextualPrompt(state, learning.followUpQuestions);
//           await recursiveOrchestrator({ // Correctly calls itself
//             query: newPromptForRecursion,
//             depth: depth - 1,
//             breadth: Math.ceil(breadth / 2),
//             model,
//             onData,
//             state,
//           });
//         }
//       }
//     }
//   }
// }

// export async function startResearch(
//   { initialQuery, depth, breadth, model }: {
//       initialQuery: string;
//       depth: number;
//       breadth: number;
//       model: SupportedModel;
//        // This now explicitly requires a defined model
//   },
//   onData: (data: any) => void
// )  {
//   const state: ResearchState = {
//     completedQueries: new Set<string>(),
//     allLearnings: [],
//     tokenTracker: { inputTokens: 0, outputTokens: 0 },
//     approvedUrls: new Set<string>()
//   };

//   await recursiveOrchestrator({
//     query: initialQuery,
//     depth: depth,
//     breadth: breadth,
//     model: model,
//     onData,
//     state,
//   });

//   if (state.allLearnings.length > 0) {
//     const { report, usage: reportUsage } = await generateReport({
//       learnings: state.allLearnings,
//       query: initialQuery,
//       model: model
//     });
//     state.tokenTracker.inputTokens += reportUsage.inputTokens;
//     state.tokenTracker.outputTokens += reportUsage.outputTokens;
//     onData({ type: 'report', data: { report, usage: reportUsage } });
//   }

//   // Final completion message with total token usage
//   onData({
//     type: 'done',
//     data: {
//       message: 'Research complete.',
//       totalUsage: state.tokenTracker,
//     },
//   });
// }
