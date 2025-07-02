import { Document, Learning, TokenUsage, SupportedModel } from "@/lib/types";
import { generateObject } from "ai";
import { z } from "zod"; // Zod is needed for schema definition
import { getModelProvider } from "@/lib/models";

// --- Define the schema for the AI's output ---
// This schema should be defined once, preferably at the top level
// or within the module where it's used.
const LearningSchema = z.object({
  isRelevant: z
    .boolean()
    .describe(
      "Is the document content directly relevant and useful for answering the original query?"
    ),
  learning: z
    .string()
    .describe(
      "If relevant, a concise 1-2 sentence insight. If not, a brief explanation of why it's irrelevant."
    ),
  followUpQuestions: z
    .array(z.string())
    .describe(
      "If relevant, 1-3 novel questions for further research. If not, an empty array."
    ),
});

/**
 * Extracts key learnings and follow-up questions from a document in the context of a query.
 *
 * @param {string} query - The original research query.
 * @param {Document} document - The document to extract learnings from.
 * @param {SupportedModel} model - The AI model to use for extraction.
 * @returns {Promise<{ learning: Learning; usage: TokenUsage }>} The extracted learning and token usage.
 */
export async function extractLearning({
  query,
  document,
  model,
}: {
  query: string;
  document: Document;
  model: SupportedModel;
}): Promise<{ learning: Learning; usage: TokenUsage }> {
  // Use substring for context. Consider more advanced chunking for larger documents if needed later.
  const contextText = document.text.substring(0, 8000);

  // Generate the object using the AI model and the defined schema
  const { object, usage: modelUsage } = await generateObject({
    model: getModelProvider(model),
    schema: LearningSchema,
    // --- START OF THE ENHANCED PROMPT ---
    prompt: `You are an expert Research Assistant AI. Your task is to meticulously analyze a given document's content in the context of an overall research query.

**Original Research Query:** "${query}"

**Document Content (Excerpt):**
"""
${contextText}
"""

**Your Objective:**
From the "Document Content" and strictly in relation to the "Original Research Query", identify ONE most significant, novel, and concise "learning." Additionally, generate 1 to 3 "follow-up questions" that are directly inspired by this document but require further investigation to fully answer the original query or explore new, related avenues.

**Strict Guidelines:**
1.  **Learning (\`learning\` field):**
    * MUST be a single, concise insight, 1-2 sentences in length.
    * It should capture the most important, factual, and non-obvious piece of information from the document that is directly relevant to the "Original Research Query."
    * Focus on data, findings, specific mechanisms, or key implications. Avoid generic statements or rephrasing the query.
    * Be objective and directly extracted/synthesized from the provided \`contextText\`.

2.  **Follow-Up Questions (\`followUpQuestions\` field):**
    * MUST be 1 to 3 distinct, open-ended questions.
    * They should naturally arise from the content of THIS document, but point towards information that is NOT fully explained or present within this document itself.
    * These questions must be designed to *advance the overall research* for the "Original Research Query" by exploring new facets or deeper details.
    * Ensure they are "novel" – meaning they aren't merely re-stating the \`Original Research Query\` or asking for obvious information from the provided document.
    * Format them as direct questions suitable for a search engine.

**Example for Guidance:**

**Original Research Query:** "How do carbon capture technologies work and what are their limitations?"

**Document Content (Excerpt):**
"""
...Direct air capture (DAC) systems use large fans to pull ambient air into a contactor, where chemical sorbents bind to CO2 molecules. The captured CO2 is then released by heating the sorbents and can be stored underground or utilized. A major challenge for DAC is the high energy input required for the regeneration process, making it expensive and energy-intensive. Recent innovations include more efficient sorbent materials.
"""

**Expected JSON Output (Example):**
\`\`\`json
{
  "learning": "Direct air capture (DAC) technology chemically binds CO2 from ambient air, but faces significant challenges due to the high energy demand and cost associated with sorbent regeneration.",
  "followUpQuestions": [
    "What are the most energy-efficient sorbent materials for direct air capture?",
    "What is the average cost per ton of CO2 captured by DAC systems?",
    "How does direct air capture compare to other carbon capture methods in terms of energy consumption?"
  ]
}
\`\`\`

Based on the "Original Research Query" and "Document Content", generate the JSON object for the \`learning\` and \`followUpQuestions\` strictly following the schema and guidelines.`,
    // --- END OF THE ENHANCED PROMPT ---
  });

  // Construct the Learning object from the AI's output and original document metadata
  const learning: Learning = {
    query: query,
    url: document.metadata.url,
    isRelevant: object.isRelevant,
    learning: object.learning,
    followUpQuestions: object.followUpQuestions,
  };

  // Construct the TokenUsage object from the model's usage statistics
  const usage: TokenUsage = {
    inputTokens: modelUsage.promptTokens,
    outputTokens: modelUsage.completionTokens,
  };

  console.log(
    `LEARNING_GENERATED: url=${learning.url}, Input tokens: ${usage.inputTokens}, Output tokens: ${usage.outputTokens}`
  );
  // Log the generated learning for debugging and tracking
  if (object.isRelevant) {
    const learning: Learning = {
      query: query,
      url: document.metadata.url,
      isRelevant: object.isRelevant,
      learning: object.learning,
      followUpQuestions: object.followUpQuestions,
    };
    console.log(`LEARNING_EXTRACTED from ${document.metadata.url}`);
    return { learning, usage };
  } else {
    console.log(
      `DOCUMENT_IRRELEVANT: ${document.metadata.url}. Reason: ${object.learning}`
    );
    return {
      learning: {
        query: query,
        url: document.metadata.url,
        isRelevant: object.isRelevant,
        learning: object.learning,
        followUpQuestions: object.followUpQuestions,
      },
      usage,
    };
  }
  // Return the extracted learning and token usage
  // return { learning, usage };
}

// import { Document, Learning, TokenUsage, SupportedModel } from '@/lib/types';
// import { generateObject } from 'ai';
// import { openai } from '@ai-sdk/openai';
// import { z } from 'zod';
// import { getModelProvider } from '@/lib/models';

// // --- FIX: Define the schema for the AI's output ---
// const LearningSchema = z.object({
//   learning: z.string().describe("A concise insight of 1-2 sentences summarizing the most important information in the document related to the original query."),
//   followUpQuestions: z.array(z.string()).describe("1 to 3 novel, open-ended questions for further research that arise from the document's content."),
// });

// export async function extractLearning({
//   query,
//   document,
//   model,
// }: {
//   query: string;
//   document: Document;
//   model: SupportedModel;
// }): Promise<{ learning: Learning; usage: TokenUsage }> {
//   const contextText = document.text.substring(0, 8000);

//   const { object, usage: modelUsage } = await generateObject({
//     model: getModelProvider(model), //openai('gpt-4o-mini'),
//     // --- FIX: Use the defined schema here ---
//     schema: LearningSchema,
//     prompt: `Original query: "${query}"\n\nDocument content:\n"""\n${contextText}\n"""\n\nBased on the document content, extract a key learning and generate follow-up questions relevant to the original query.`,
//   });

//   // Now 'object' is correctly typed as { learning: string, followUpQuestions: string[] }
//   const learning: Learning = {
//     query: query,
//     url: document.metadata.url,
//     learning: object.learning,
//     followUpQuestions: object.followUpQuestions,
//   };

//   const usage: TokenUsage = {
//     inputTokens: modelUsage.promptTokens,
//     outputTokens: modelUsage.completionTokens,
//   };

//   console.log(
//     `LEARNING_GENERATED: url=${learning.url}, Input tokens: ${usage.inputTokens}, Output tokens: ${usage.outputTokens}`
//   );
//   return { learning, usage };
// }
