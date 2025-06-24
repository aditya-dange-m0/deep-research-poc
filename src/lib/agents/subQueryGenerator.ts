import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { TokenUsage } from '@/lib/types';

export async function generateSubQueries({
  query,
  breadth,
}: {
  query: string;
  breadth: number;
}): Promise<{ queries: string[]; usage: TokenUsage }> {
  const prompt = `...`; // Same prompt as before
  
  const { text, usage } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: prompt,
  });

  const queries = text.split('\n').map(q => q.trim()).filter(q => q.length > 0);
  console.log(`SUB_QUERIES_GENERATED for "${query}": Input tokens: ${usage.promptTokens}, Output tokens: ${usage.completionTokens}`);
  
  return {
    queries,
    usage: { inputTokens: usage.promptTokens, outputTokens: usage.completionTokens },
  };
}