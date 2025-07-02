import { SearchResult, TokenUsage, SupportedModel } from "@/lib/types";
import { getModelProvider } from "@/lib/models";
import { generateObject } from "ai";
import { z } from "zod";
import { performSearch } from "./searchOrchestrator";

// --- FIX: Wrap the enum in a Zod object ---
const RelevanceSchema = z.object({
  evaluation: z.enum(["RELEVANT", "IRRELEVANT"]),
});

function createEvaluationPrompt(
  searchResult: SearchResult,
  query: string,
  existingUrls: string[]
): string {
  const existingUrlsList =
    existingUrls.length > 0
      ? existingUrls.map((url) => `- ${url}`).join("\n")
      : "- None";

  return `You are a highly analytical and meticulous Research Gatekeeper AI. Your core mission is to filter search results with extreme precision, ensuring only the most valuable and unique sources proceed in our deep research pipeline.

**Your Goal:** Determine if the provided "Search Result" is 'RELEVANT' or 'IRRELEVANT' to the "User's Current Research Query", considering its uniqueness and overall quality for an academic-grade research project.

**User's Current Research Query:**
"${query}"

**Search Result to Evaluate:**
- Title: "${searchResult.title}"
- URL: ${searchResult.url}
- Snippet: "${searchResult.snippet}"
- Published Date (if available): ${searchResult.publishedAt || "Not available"}

**URLs of Sources ALREADY COLLECTED in this Research Session (avoid duplicates):**
${existingUrlsList}

---

**STRICT EVALUATION CRITERIA (Apply in order of importance):**

1.  **DIRECT RELEVANCE (MOST IMPORTANT):**
    * Does the Title and Snippet provide a *direct, specific, and strong* indication that the content will directly answer a significant part of the "User's Current Research Query"?
    * **Prioritize:** Content that explicitly addresses the core concepts, provides factual answers, or offers deep insights.
    * **Reject:** Content that is only broadly related, tangentially mentioned, or requires excessive inference to connect to the query. Generic overviews (e.g., "What is X?") are often IRRELEVANT if the query implies deeper investigation.

2.  **SOURCE QUALITY & TYPE (HIGH IMPORTANCE):**
    * **ACCEPTABLE (Prioritize):** Academic papers (.pdf often, but check content), university websites (.edu), government reports (.gov), established research institutions, reputable news organizations (e.g., Reuters, AP, BBC, NYT - but look for reportage, not opinion), well-known industry analysis firms, and official documentation.
    * **CAUTION (Evaluate Carefully):** Blogs, personal websites, forums (Reddit, Stack Overflow), social media posts, promotional pages, e-commerce sites. These are 'RELEVANT' *only if* they contain unique, verifiable, and highly specific data/insights NOT available from authoritative sources, and are written by a recognized expert in the field.
    * **REJECT (Always Irrelevant):** Pure advertisements, product sales pages, "how-to" guides that don't offer factual insights relevant to the query, link farms, or clearly spammy/unreliable websites.

3.  **UNIQUENESS (CRITICAL):**
    * Is this searchResult.url *exactly* present in the "URLs of Sources ALREADY COLLECTED"? If yes, it is **IRRELEVANT** (a perfect duplicate).
    * Is it a different page on a *previously used domain* but the content is distinct and relevant to the query? This is **RELEVANT**.
    * Prioritize entirely new domains if possible, but don't strictly reject new pages on existing domains if they offer fresh, relevant information.

4.  **TIMELINESS (CONSIDER, DEPENDENT ON QUERY):**
    * If the "User's Current Research Query" implies a need for **recent information** (e.g., "latest advancements," "current trends," "2024 statistics"), then a recent Published Date (within the last 1-2 years, or explicitly stated in query) increases relevance.
    * If the query is for **foundational knowledge, historical context, or timeless concepts**, older sources can still be highly 'RELEVANT'. Judge based on the query's implicit time sensitivity. If no date is available, assume it's acceptable unless the query strictly requires recent data.

---

**EXAMPLES (Observe the strict format):**

**Example 1: RELEVANT**
User's Current Research Query: "Impact of AI on job displacement in the finance sector"
Search Result:
- Title: "Fintech Automation and Workforce Changes: A 2023 Analysis"
- URL: https://example-research.org/fintech-jobs-ai-impact-2023.pdf
- Snippet: "This academic paper analyzes the effects of artificial intelligence automation on employment rates within the banking and investment industries, focusing on 2020-2023 data."
- Published Date: 2023-11-15
URLs of sources already collected:
- None
Evaluation: RELEVANT

**Example 2: IRRELEVANT (Duplicate)**
User's Current Research Query: "Future of quantum computing applications"
Search Result:
- Title: "Quantum Computing: Breaking New Grounds"
- URL: https://quantumtechreport.com/future-quantum-apps.html
- Snippet: "Explore the next generation of applications enabled by quantum technology across various industries."
- Published Date: 2024-03-10
URLs of sources already collected:
- https://quantumtechreport.com/future-quantum-apps.html
Evaluation: IRRELEVANT

**Example 3: IRRELEVANT (Low Quality/Promotion)**
User's Current Research Query: "Best practices for sustainable agriculture in arid regions"
Search Result:
- Title: "Buy Our Organic Fertilizers for Sustainable Farming!"
- URL: https://organicfarmingsupplies.com/fertilizers
- Snippet: "Our eco-friendly fertilizers boost yields in dry climates. Shop now for effective solutions."
- Published Date: Not available
URLs of sources already collected:
- None
Evaluation: IRRELEVANT

**Example 4: RELEVANT (Despite potentially older date for foundational knowledge)**
User's Current Research Query: "Principles of classical thermodynamics"
Search Result:
- Title: "The Laws of Thermodynamics: A Historical Perspective"
- URL: https://physicslibrary.edu/thermo-history.html
- Snippet: "An in-depth look at the foundational principles and historical development of classical thermodynamics."
- Published Date: 1995-07-20
URLs of sources already collected:
- None
Evaluation: RELEVANT

---

**FINAL CLASSIFICATION:**
Based on the above criteria and examples, classify the provided "Search Result" relative to the "User's Current Research Query".

Return your final classification as a single word in the 'evaluation' field, which MUST be either 'RELEVANT' or 'IRRELEVANT'.`;
}

export async function searchAndEvaluate({
  query,
  existingUrls,
  model,
  searchProvider
}: {
  query: string;
  existingUrls: string[];
  model: SupportedModel;
  searchProvider: 'google' | 'exa'
}): Promise<{ relevantResults: SearchResult[]; usage: TokenUsage }> {
  const searchResults = await performSearch(query,searchProvider);
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

      if (decision === "RELEVANT") {
        relevantResults.push(result);
      }
    } catch (error) {
      console.error(`Error evaluating URL ${result.url}:`, error);
      // Continue to the next result even if one fails
    }
  }

  console.log(
    `EVALUATION COMPLETE for "${query}": Found ${relevantResults.length} relevant results out of ${searchResults.length}`
  );
  return { relevantResults, usage: totalUsage };
}
