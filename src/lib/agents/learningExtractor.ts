import { Document, Learning, TokenUsage, SupportedModel } from '@/lib/types';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getModelProvider } from '@/lib/models';


// --- FIX: Define the schema for the AI's output ---
const LearningSchema = z.object({
  learning: z.string().describe("A concise insight of 1-2 sentences summarizing the most important information in the document related to the original query."),
  followUpQuestions: z.array(z.string()).describe("1 to 3 novel, open-ended questions for further research that arise from the document's content."),
});

export async function extractLearning({
  query,
  document,
  model,
}: {
  query: string;
  document: Document;
  model: SupportedModel;
}): Promise<{ learning: Learning; usage: TokenUsage }> {
  const contextText = document.text.substring(0, 8000);

  const { object, usage: modelUsage } = await generateObject({
    model: getModelProvider(model), //openai('gpt-4o-mini'),
    // --- FIX: Use the defined schema here ---
    schema: LearningSchema,
    prompt: `Original query: "${query}"\n\nDocument content:\n"""\n${contextText}\n"""\n\nBased on the document content, extract a key learning and generate follow-up questions relevant to the original query.`,
  });

  // Now 'object' is correctly typed as { learning: string, followUpQuestions: string[] }
  const learning: Learning = {
    query: query,
    url: document.metadata.url,
    learning: object.learning,
    followUpQuestions: object.followUpQuestions,
  };
  
  const usage: TokenUsage = {
    inputTokens: modelUsage.promptTokens,
    outputTokens: modelUsage.completionTokens,
  };

  console.log(`LEARNING_GENERATED: url=${learning.url}, Input tokens: ${usage.inputTokens}, Output tokens: ${usage.outputTokens}`);
  return { learning, usage };
}