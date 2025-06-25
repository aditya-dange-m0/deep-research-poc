import { Learning, ResearchRequestBody, TokenUsage, SupportedModel } from '@/lib/types';
import { generateSubQueries } from './subQueryGenerator';
import { refineQuery } from './queryRefiner';
import { searchAndEvaluate } from './searchAndEvaluate';
import { fetchAndParseContent } from './contentFetcher';
import { extractLearning } from './learningExtractor';
import { generateReport } from './reportGenerator';

// --- FIX #1: Add 'initialQuery' to the ResearchState type ---
type ResearchState = {
  initialQuery: string; // This holds the user's original query for context
  completedQueries: Set<string>;
  allLearnings: Learning[];
  tokenTracker: TokenUsage;
  approvedUrls: Set<string>;
};

// --- FIX #3: Define the missing 'createContextualPrompt' function ---
function createContextualPrompt(state: ResearchState, followUpQuestions: string[]): string {
    return `The overall research goal is: "${state.initialQuery}".
We have already researched the following topics: ${Array.from(state.completedQueries).join(', ')}.
Based on the last learning, please now investigate the following questions: ${followUpQuestions.join(', ')}.
Generate focused search queries to answer these questions.`;
}

// Renamed to 'deepResearch' for clarity, was 'recursiveOrchestrator'
async function deepResearch({
  prompt,
  depth,
  breadth,
  model,
  onData,
  state,
}: {
  prompt: string;
  depth: number;
  breadth: number;
  model: SupportedModel;
  onData: (data: any) => void;
  state: ResearchState;
}) {
  if (depth === 0) {
    console.log('REACHED MAX DEPTH');
    return;
  }
  
  onData({ type: 'query-start', data: prompt });

  const { queries: subQueries, usage: subQueryUsage } = await generateSubQueries({ query: prompt, breadth, model });
  state.tokenTracker.inputTokens += subQueryUsage.inputTokens;
  state.tokenTracker.outputTokens += subQueryUsage.outputTokens;
  onData({ type: 'token-usage', data: { step: 'sub-query', usage: subQueryUsage } });

  for (const subQuery of subQueries) {
    if (state.completedQueries.has(subQuery)) continue;
    state.completedQueries.add(subQuery);
    
    // --- FIX #2: Pass the correct 'initialQuery' string to the refiner ---
    const { refinedQuery, usage: refinerUsage } = await refineQuery({
        initialQuery: state.initialQuery, // Use the original goal for context
        subQuery,
        model,
    });
    state.tokenTracker.inputTokens += refinerUsage.inputTokens;
    state.tokenTracker.outputTokens += refinerUsage.outputTokens;
    onData({ type: 'refining-query', data: { query: refinedQuery, usage: refinerUsage }});

    const { relevantResults, usage: evaluationUsage } = await searchAndEvaluate({
      query: refinedQuery,
      existingUrls: Array.from(state.approvedUrls),
      model,
    });
    
    state.tokenTracker.inputTokens += evaluationUsage.inputTokens;
    state.tokenTracker.outputTokens += evaluationUsage.outputTokens;
    onData({ type: 'relevance-check', data: { usage: evaluationUsage } });

    for (const result of relevantResults) {
      if (state.approvedUrls.has(result.url)) continue;

      const document = await fetchAndParseContent(result);
      if (document) {
        state.approvedUrls.add(document.metadata.url);

        const { learning, usage: learningUsage } = await extractLearning({ query: subQuery, document, model });
        state.allLearnings.push(learning); // This array will now be populated
        onData({ type: 'learning', data: { learning, usage: learningUsage } });

        if (depth > 1 && learning.followUpQuestions.length > 0) {
          const newPromptForRecursion = createContextualPrompt(state, learning.followUpQuestions);
          await deepResearch({
            prompt: newPromptForRecursion,
            depth: depth - 1,
            breadth: Math.ceil(breadth / 2),
            model,
            onData,
            state,
          });
        }
        // Break to move to the next sub-query after finding one good source
        break; 
      }
    }
  }
}

export async function startResearch(
  { initialQuery, depth, breadth, model }: { 
      initialQuery: string; 
      depth: number; 
      breadth: number; 
      model: SupportedModel;
  },
  onData: (data: any) => void
) {
  // Initialize the state correctly, including the initialQuery
  const state: ResearchState = {
    initialQuery: initialQuery,
    completedQueries: new Set<string>(),
    allLearnings: [],
    tokenTracker: { inputTokens: 0, outputTokens: 0 },
    approvedUrls: new Set<string>(),
  };

  await deepResearch({
    prompt: initialQuery,
    depth: depth,
    breadth: breadth,
    model,
    onData,
    state,
  });

  // This block will now execute because learnings will be found.
  if (state.allLearnings.length > 0) {
    const { report, usage: reportUsage } = await generateReport({
      learnings: state.allLearnings,
      query: initialQuery,
      model,
    });
    state.tokenTracker.inputTokens += reportUsage.inputTokens;
    state.tokenTracker.outputTokens += reportUsage.outputTokens;
    onData({ type: 'report', data: { report, usage: reportUsage } });
  } else {
    onData({ type: 'error', data: "Research concluded, but no relevant learnings were found to generate a report." });
  }

  onData({
    type: 'done',
    data: {
      message: 'Research complete.',
      totalUsage: state.tokenTracker,
    },
  });
}




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