import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { TokenUsage, SupportedModel } from "@/lib/types";
import { getModelProvider } from "@/lib/models";

export async function generateSubQueries({
  query,
  breadth,
  model,
}: {
  query: string;
  breadth: number;
  model: SupportedModel;
}): Promise<{ queries: string[]; usage: TokenUsage }> {
  const prompt = `**Role:** You are a world-class Senior Research Analyst. You are the first step in a complex AI-powered research pipeline. Your primary responsibility is to break down a broad, high-level user request into a set of specific, actionable, and diverse search queries that will be fed to a web search engine.

**Objective:** Decompose the following user's "Core Research Topic" into exactly ${breadth} distinct sub-queries. These sub-queries must be designed to collectively cover the most critical angles of the topic, ensuring a comprehensive investigation.

**Core Research Topic:** "${query}"

**Rules and Constraints:**
1.  **Specificity:** Each sub-query must be a concrete question or topic suitable for a search engine. Avoid vague or overly broad queries. For example, instead of "AI history," a better query would be "Key milestones in the development of neural networks."
2.  **Diversity of Angles:** The set of sub-queries should explore different facets of the topic. Consider these potential angles:
    *   **Technical Aspects:** How does it work? What are the underlying technologies?
    *   **Applications/Use Cases:** Where is it being used? What are its practical benefits?
    *   **Challenges/Limitations:** What are the current problems, criticisms, or obstacles?
    *   **Future Trends:** What are the future predictions, ongoing research, or potential developments?
    *   **Key Players/Entities:** Who are the major companies, researchers, or organizations involved?
    *   **Economic/Social Impact:** What are the effects on markets, society, or regulations?
3.  **No Redundancy:** Each sub-query must be unique and not overlap significantly with the others.
4.  **Actionability:** The queries should be phrased in a way that is likely to yield factual, high-quality search results (e.g., reports, articles, documentation) rather than just opinion pieces or forums.
5.  **Simplicity:** Do not add any conversational text, pleasantries, or explanations. Your entire output should consist of the queries themselves.

**Output Format:**
-   Provide exactly ${breadth} queries.
-   Each query must be on a new, separate line.
-   Do not use numbers, bullet points, or any other formatting characters (like hyphens or asterisks).

**Example:**
If the Core Research Topic is "The impact of solid-state batteries on the EV industry" and breadth is 3, a good output would be:
> Solid-state battery manufacturing challenges and breakthroughs
> Comparison of energy density between solid-state and lithium-ion batteries
> Major automotive companies investing in solid-state battery technology

Begin generation now.`;

  const { text, usage } = await generateText({
    model: getModelProvider(model), //openai('gpt-4o-mini'),
    prompt: prompt,
  });

  const queries = text
    .split("\n")
    .map((q) => q.trim())
    .filter((q) => q.length > 0);
  console.log(
    `SUB_QUERIES_GENERATED for "${query}": Input tokens: ${usage.promptTokens}, Output tokens: ${usage.completionTokens}`
  );

  return {
    queries,
    usage: {
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
    },
  };
}
