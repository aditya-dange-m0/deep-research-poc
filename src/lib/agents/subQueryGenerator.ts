import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Generates focused sub-queries from a broader topic using an AI model.
 *
 * @param {{ query: string; breadth: number; }} { query, breadth }
 * @returns {Promise<string[]>} A promise resolving to an array of sub-queries.
 */
export async function generateSubQueries({ query, breadth }: { query: string; breadth: number; }): Promise<string[]> {
  const prompt = `You are a research assistant. Your task is to break down a central topic into distinct, focused sub-topics for investigation. Based on the user's query "${query}", generate exactly ${breadth} specific and diverse sub-queries suitable for a web search engine. Do not number them or use bullet points. Each sub-query must be on a new line.`;

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: prompt,
    maxTokens: 200,
    temperature: 0.7,
  });

  const subQueries = text.split('\n').map(q => q.trim()).filter(q => q.length > 0);
  console.log(`SUB_QUERIES_GENERATED for "${query}":`, subQueries);
  return subQueries;
}