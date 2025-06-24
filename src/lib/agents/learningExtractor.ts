import { Document, Learning } from '@/lib/types';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * Extracts a concise learning and generates follow-up questions from a document.
 *
 * @param {{ query: string; document: Document; }} { query, document }
 * @returns {Promise<Learning>} A promise resolving to a structured Learning object.
 */
export async function extractLearning({ query, document }: { query: string; document: Document; }): Promise<Learning> {
  const contextText = document.text.substring(0, 8000); // Use a sizable chunk of text for context

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({
      learning: z.string().describe("A concise insight of 1-2 sentences summarizing the most important information in the document related to the original query."),
      followUpQuestions: z.array(z.string()).describe("1 to 3 novel, open-ended questions for further research that arise from the document's content."),
    }),
    prompt: `Original query: "${query}"\n\nDocument content:\n"""\n${contextText}\n"""\n\nBased on the document content, extract a key learning and generate follow-up questions relevant to the original query.`,
  });

  const learning: Learning = {
    query: query,
    url: document.metadata.url,
    learning: object.learning,
    followUpQuestions: object.followUpQuestions,
  };
  
  // Log: "LEARNING_GENERATED"
  console.log(`LEARNING_GENERATED: url=${learning.url}`);
  return learning;
}