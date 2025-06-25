import { getModelProvider } from '@/lib/models';
import { generateText } from 'ai';
import { SupportedModel, TokenUsage } from '@/lib/types';

function createRefinerPrompt(initialQuery: string, subQuery: string): string {
  return `You are a Search Query Optimization Expert. Your sole task is to combine an "Overall Research Goal" and a "Specific Sub-Topic" into a single, concise, and highly effective search engine query.

**Rules:**
- The final query should be a combination of the most important keywords from both inputs.
- Remove redundant words and phrases.
- Do not use conversational language.
- The output must be a single line containing only the optimized search query.

**Overall Research Goal:** "${initialQuery}"
**Specific Sub-Topic:** "${subQuery}"

**Optimized Search Query:**`;
}

export async function refineQuery({
  initialQuery,
  subQuery,
  model,
}: {
  initialQuery: string;
  subQuery: string;
  model: SupportedModel;
}): Promise<{ refinedQuery: string; usage: TokenUsage }> {

  // Use the model passed as a parameter for consistency
  const refinerModel = getModelProvider(model);
  const prompt = createRefinerPrompt(initialQuery, subQuery);

  const { text, usage } = await generateText({
    model: refinerModel, // Use the dynamically selected model
    prompt: prompt,
    maxTokens: 50, // Keep the output short and focused
  });

  const refinedQuery = text.trim();
  console.log(`REFINED QUERY: "${refinedQuery}" (from sub-query: "${subQuery}")`);
  
  return {
    refinedQuery,
    usage: { inputTokens: usage.promptTokens, outputTokens: usage.completionTokens },
  };
}