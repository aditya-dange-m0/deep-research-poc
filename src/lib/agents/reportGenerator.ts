import {
  Learning,
  ResearchReport,
  TokenUsage,
  SupportedModel,
} from "@/lib/types";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { getModelProvider } from "@/lib/models";

// Zod schema for the final report structure, ensuring type-safe AI output
const ReportSchema = z.object({
  title: z
    .string()
    .describe(
      "A clear, concise title for the report that reflects the user's query."
    ),
  summary: z
    .string()
    .describe(
      "A 2-4 sentence executive summary of the key findings in markdown format."
    ),
  sections: z
    .array(
      z.object({
        title: z
          .string()
          .describe("The title of a relevant section of the report."),
        content: z
          .string()
          .describe(
            "The full content of the section in markdown format, with citations like [1], [2] where necessary."
          ),
      })
    )
    .describe("The main sections of the report, organized by theme."),
  usedSources: z
    .array(z.string())
    .describe(
      "An array of the source URLs that were actually cited in the report content."
    ),
});

// Adapted from your reference code to create a powerful system prompt
function generateReportSystemPrompt(
  learnings: Learning[],
  userQuery: string
): string {
  const sourcesText = learnings
    .map(
      (learning, index) =>
        `Source [${index + 1}]:
URL: ${learning.url}
Key Learning: ${learning.learning}`
    )
    .join("\n---\n"); // Keep original separator for clarity

  return `You are a highly skilled, expert Research Analyst AI. Your ultimate task is to synthesize all provided research "Learnings" into a comprehensive, insightful, and perfectly structured report in JSON format. Your report must directly and thoroughly address the user's original research request.

**User's Original Research Request:**
"${userQuery}"

**Available Research Learnings (Analyzed from Various Sources):**
${sourcesText}

---

**STRICT GUIDELINES FOR REPORT GENERATION:**

1.  **Comprehensive Synthesis & Direct Answer:**
    * Thoroughly analyze and synthesize *all* relevant information from the "Available Research Learnings" to directly answer the "User's Original Research Request."
    * Do not just summarize individual learnings; integrate them cohesively to form a unified, coherent narrative. Connect concepts and draw insights.
    * If the user's request has multiple facets, ensure all are addressed.

2.  **Objectivity, Depth, and Tone:**
    * Maintain an objective, analytical, and professional tone throughout the report. Avoid speculative language, personal opinions, or conversational fillers.
    * The content must be rich in factual detail and provide depth of understanding. Aim for clarity and conciseness without sacrificing comprehensiveness.
    * Use **Markdown** for all content (summary and sections). This includes headings, bold text, bullet points, numbered lists, and code blocks where appropriate to enhance readability and structure.

3.  **Strict JSON Output Format:**
    * Adhere ABSOLUTELY to the specified JSON schema:
        \`\`\`json
        {
          "title": "...", // A precise, engaging title for the entire report.
          "summary": "...", // A concise (2-4 sentence) executive summary of the report's main findings. Must be in Markdown.
          "sections": [
            {
              "title": "...", // A clear heading for the section.
              "content": "..." // The full content of the section, in Markdown, with citations.
            }
          ],
          "usedSources": ["url1", "url2", "..."] // ONLY the full URLs of sources ACTUALLY CITED in the report.
        }
        \`\`\`

4.  **Accurate and Transparent Citations:**
    * Every specific fact, statistic, direct quote, or distinct piece of information derived from a source MUST be cited.
    * Cite sources by their numbered index from the "Available Research Learnings" (e.g., [1], [3]).
    * Place citations immediately after the relevant sentence or fact, not at the end of a paragraph if multiple sources are used within it.
    * If a section is primarily based on one source, cite it clearly.

5.  **Source Utilization & Relevance:**
    * You are NOT required to use every single provided learning. Only include information that is directly relevant and contributes meaningfully to answering the "User's Original Research Request."
    * The usedSources array in the final JSON MUST contain the exact URLs corresponding *only* to the numbered sources you have actually cited within the report's summary or sections. If source [1] and [3] are cited, then usedSources should contain [learnings[0].url, learnings[2].url].

6.  **Handling Gaps or Discrepancies:**
    * If there are notable gaps in the information to fully answer the query, or if conflicting information is present across sources, briefly mention this limitation in a neutral, objective manner within the report if it significantly impacts the answer. Do not speculate or invent information.

---

Begin generating the comprehensive research report in the specified JSON format now. Ensure the output is a valid JSON object.`;
}

/**
 * Generates a final report by synthesizing all collected learnings.
 * @returns An object containing the generated report and the token usage.
 */
export async function generateReport({
  learnings,
  query,
  model,
}: {
  learnings: Learning[];
  query: string;
  model: SupportedModel;
}): Promise<{ report: ResearchReport; usage: TokenUsage }> {
  console.log(
    `REPORT_GENERATION_START: Synthesizing ${learnings.length} learnings for query "${query}"`
  );

  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  const systemPrompt = generateReportSystemPrompt(learnings, query);

  const { object, usage: modelUsage } = await generateObject({
    model: getModelProvider(model), //openai('gpt-4o-mini'),
    schema: ReportSchema,
    prompt: systemPrompt,
  });

  usage = {
    inputTokens: modelUsage.promptTokens,
    outputTokens: modelUsage.completionTokens,
  };

  console.log(
    `REPORT_GENERATION_COMPLETE: Input tokens: ${usage.inputTokens}, Output tokens: ${usage.outputTokens}`
  );
  return { report: object, usage };
}
