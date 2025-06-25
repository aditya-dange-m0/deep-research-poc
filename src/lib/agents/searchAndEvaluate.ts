import { SearchResult, TokenUsage, SupportedModel } from '@/lib/types';
import { getModelProvider } from '@/lib/models';
import { generateObject } from 'ai';
import { z } from 'zod';
import { performSearch } from './searchOrchestrator';

// --- FIX: Wrap the enum in a Zod object ---
const RelevanceSchema = z.object({
  evaluation: z.enum(['RELEVANT', 'IRRELEVANT']),
});

function createEvaluationPrompt(searchResult: SearchResult, query: string, existingUrls: string[]): string {
  return `You are a meticulous research gatekeeper. Your task is to evaluate if a search result is relevant to a user's query and if it's a unique source.

**User's Current Query:** "${query}"

**Search Result to Evaluate:**
- Title: "${searchResult.title}"
- URL: ${searchResult.url}
- Snippet: "${searchResult.snippet}"

**URLs of sources already collected in this research session:**
${existingUrls.length > 0 ? existingUrls.join('\n') : 'None'}

**Evaluation Criteria:**
1.  **Relevance:** Is the content described in the title and snippet HIGHLY and DIRECTLY relevant to the "User's Current Query"?
2.  **Uniqueness:** Is the URL a new source not already present in the list of collected sources?

**Decision:**
- If the result is highly relevant AND unique, classify it as 'RELEVANT'.
- If it is a duplicate, off-topic, an advertisement, or a low-quality forum, classify it as 'IRRELEVANT'.

Return your final classification in the 'evaluation' field.`;
}

export async function searchAndEvaluate({
  query,
  existingUrls,
  model,
}: {
  query: string;
  existingUrls: string[];
  model: SupportedModel;
}): Promise<{ relevantResults: SearchResult[]; usage: TokenUsage }> {
  
  const searchResults = await performSearch(query);
  if (searchResults.length === 0) {
    return { relevantResults: [], usage: { inputTokens: 0, outputTokens: 0 } };
  }

  const evaluationModel = getModelProvider(model);
  let totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  const relevantResults: SearchResult[] = [];

  for (const result of searchResults) {
    try {
        const prompt = createEvaluationPrompt(result, query, existingUrls);
        const { object, usage } = await generateObject({
          model: evaluationModel,
          schema: RelevanceSchema,
          prompt,
        });
        
        totalUsage.inputTokens += usage.promptTokens;
        totalUsage.outputTokens += usage.completionTokens;
        
        // --- FIX: Access the evaluation from the nested object property ---
        const decision = object.evaluation;
        console.log(`EVALUATION: URL: ${result.url}, Relevant: ${decision}`);
        
        if (decision === 'RELEVANT') {
          relevantResults.push(result);
        }
    } catch (error) {
        console.error(`Error evaluating URL ${result.url}:`, error);
        // Continue to the next result even if one fails
    }
  }

  console.log(`EVALUATION COMPLETE for "${query}": Found ${relevantResults.length} relevant results out of ${searchResults.length}`);
  return { relevantResults, usage: totalUsage };
}