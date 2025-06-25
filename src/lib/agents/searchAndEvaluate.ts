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
- Published Date (if available): ${searchResult.publishedAt || 'Not available'}

**URLs of sources already collected in this research session:**
${existingUrls.length > 0 ? existingUrls.join('\n') : 'None'}

**Evaluation Criteria:**
1.  **Direct Relevance:** Does the title and snippet CLEARLY indicate that the content will DIRECTLY answer or provide significant, specific insight into the "User's Current Query"? Avoid broad or tangentially related topics.
2.  **Source Quality:**
    *   Prioritize authoritative sources such as academic papers, official documentation, reputable news organizations, and well-known industry reports.
    *   Treat user-generated content (forums, personal blogs unless by a recognized expert, social media discussions) with caution. It should only be 'RELEVANT' if it provides unique, verifiable information not found elsewhere.
    *   Is the source an advertisement or primarily trying to sell a product rather than inform? If so, it's 'IRRELEVANT'.
3.  **Uniqueness:** Is the URL a new source, not already present in the list of collected sources? (A different page on an already used domain is acceptable if the content is distinct and relevant).
4.  **Timeliness (Consider if applicable to the query):** If the query implies a need for recent information (e.g., "latest trends in X", "current status of Y"), does the published date (if available) support its relevance? Older, foundational content can still be relevant for general knowledge.

**Decision:**
- Classify as 'RELEVANT' ONLY IF it meets criteria for Direct Relevance, Source Quality, and Uniqueness. Timeliness is a factor to weigh.
- Otherwise, classify as 'IRRELEVANT'. This includes duplicates, off-topic content, advertisements, or low-quality/unreliable sources.

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