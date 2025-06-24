import { Learning, ResearchReport, TokenUsage } from '@/lib/types';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Zod schema for the final report structure, ensuring type-safe AI output
const ReportSchema = z.object({
  title: z.string().describe("A clear, concise title for the report that reflects the user's query."),
  summary: z.string().describe("A 2-4 sentence executive summary of the key findings in markdown format."),
  sections: z.array(z.object({
    title: z.string().describe("The title of a relevant section of the report."),
    content: z.string().describe("The full content of the section in markdown format, with citations like [1], [2] where necessary."),
  })).describe("The main sections of the report, organized by theme."),
  usedSources: z.array(z.string()).describe("An array of the source URLs that were actually cited in the report content."),
});

// Adapted from your reference code to create a powerful system prompt
function generateReportSystemPrompt(learnings: Learning[], userQuery: string): string {
  // FIX: Added a semicolon inside the map function.
  const sourcesText = learnings.map((learning, index) => 
    `[${index + 1}] URL: ${learning.url}\nContent: ${learning.learning}`
  ).join('\n---\n');

  return `You are a research analyst. Your task is to synthesize the provided research learnings into a comprehensive, well-structured report in a JSON format. The user's original request was: "${userQuery}".

Analyze the following sources, which are provided as numbered learnings from different URLs:
${sourcesText}

Based ONLY on the information in the provided sources, generate a report that directly addresses the user's request. Follow these rules:
1.  **Structure:** Adhere strictly to the requested JSON format: {title, summary, sections, usedSources}.
2.  **Content:** The report must be written in an objective, analytical tone. Use markdown for formatting (bold, lists, etc.).
3.  **Citations:** When you use a specific fact, statistic, or quote from a source, cite it by its number in square brackets, e.g., [1], [3].
4.  **Relevance:** You do not need to use every source. Only cite the sources that are necessary to support the report's claims.
5.  **usedSources Array:** In the final JSON, the 'usedSources' array must contain the full URLs of ONLY the sources you cited. For example, if you cited [1] and [3], this array should contain the URLs corresponding to those sources.
`;
}

/**
 * Generates a final report by synthesizing all collected learnings.
 * @returns An object containing the generated report and the token usage.
 */
export async function generateReport({
  learnings,
  query,
}: {
  learnings: Learning[];
  query: string;
}): Promise<{ report: ResearchReport; usage: TokenUsage }> {
  console.log(`REPORT_GENERATION_START: Synthesizing ${learnings.length} learnings for query "${query}"`);

  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  const systemPrompt = generateReportSystemPrompt(learnings, query);

  const { object, usage: modelUsage } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: ReportSchema,
    prompt: systemPrompt,
  });
  
  usage = {
      inputTokens: modelUsage.promptTokens,
      outputTokens: modelUsage.completionTokens,
  };

  console.log(`REPORT_GENERATION_COMPLETE: Input tokens: ${usage.inputTokens}, Output tokens: ${usage.outputTokens}`);
  return { report: object, usage };
}