import { SearchResult, TokenUsage } from "@/lib/types";
import { getModelProvider } from "@/lib/models";
import { generateObject } from "ai";
import { z } from "zod";

// We use a simple enum schema for a clear, cheap evaluation from the LLM.
const RelevanceSchema = z.enum(["RELEVANT", "IRRELEVANT"]);

/**
 * Creates a tailored prompt for the AI to evaluate a single search result.
 * @param searchResult The search result to evaluate.
 * @param query The user's query that the result should be relevant to.
 * @param existingUrls A list of URLs already approved to check for duplicates.
 * @returns A string prompt for the language model.
 */
function createEvaluationPrompt(
  searchResult: SearchResult,
  query: string,
  existingUrls: string[]
): string {
  return `You are a meticulous research assistant. Your task is to evaluate if a search result is relevant to a user's query and if it's a unique source.

**User's Query:** "${query}"

**Search Result to Evaluate:**
- Title: "${searchResult.title}"
- URL: ${searchResult.url}
- Snippet: "${searchResult.snippet}"

**Existing Approved URLs:**
${existingUrls.length > 0 ? existingUrls.join("\n") : "None"}

**Evaluation Criteria:**
1.  **Relevance:** Is the content described in the title and snippet likely to directly answer or provide significant insight into the user's query?
2.  **Uniqueness:** Is the URL a new source, not already present in the "Existing Approved URLs"?

**Decision:**
- If the result is highly relevant AND unique, classify it as 'RELEVANT'.
- If it is a duplicate, off-topic, an ad, or a low-quality source, classify it as 'IRRELEVANT'.

Return ONLY 'RELEVANT' or 'IRRELEVANT'.`;
}

/**
 * Filters search results for relevance and uniqueness using an AI model.
 * @returns An object containing the filtered, relevant search results and token usage.
 */
export async function checkRelevance({
  searchResults,
  query,
  existingUrls,
}: {
  searchResults: SearchResult[];
  query: string;
  existingUrls: string[];
}): Promise<{ relevantResults: SearchResult[]; usage: TokenUsage }> {
  const model = getModelProvider("openai:gpt-4o-mini"); // Use a fast model for this
  const evaluations: Promise<{
    result: SearchResult | null;
    usage: TokenUsage;
  }>[] = [];

  for (const result of searchResults) {
    const evaluationTask = async () => {
      const prompt = createEvaluationPrompt(result, query, existingUrls);
      const { object, usage } = await generateObject({
        model,
        schema: RelevanceSchema,
        prompt,
      });

      console.log(`EVALUATION: URL: ${result.url}, Relevant: ${object}`);

      const tokenUsage = {
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
      };
      return {
        result: object === "RELEVANT" ? result : null,
        usage: tokenUsage,
      };
    };
    evaluations.push(evaluationTask());
  }

  const results = await Promise.all(evaluations);

  const relevantResults = results
    .map((r) => r.result)
    .filter((r): r is SearchResult => r !== null);
  const totalUsage = results.reduce(
    (acc, r) => {
      acc.inputTokens += r.usage.inputTokens;
      acc.outputTokens += r.usage.outputTokens;
      return acc;
    },
    { inputTokens: 0, outputTokens: 0 }
  );

  console.log(
    `RELEVANCE_CHECK_COMPLETE: Found ${relevantResults.length} relevant results out of ${searchResults.length}`
  );
  return { relevantResults, usage: totalUsage };
}
