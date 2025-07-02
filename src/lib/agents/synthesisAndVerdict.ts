import { Learning, TokenUsage, SupportedModel, FactCheckReport } from '@/lib/types';
import { getModelProvider } from '@/lib/models';
import { generateObject } from 'ai';
import { z } from 'zod';

const VerdictSchema = z.object({
  verdict: z.enum(['True', 'Mostly True', 'Misleading', 'False', 'Unverifiable']),
  summary: z.string().describe("A concise, neutral summary of the findings. Explain *why* you reached your verdict, referencing the evidence."),
  supportingEvidence: z.array(z.string()).describe("A list of URLs for sources that support the final verdict."),
  refutingEvidence: z.array(z.string()).describe("A list of URLs for sources that contradict or are inconsistent with the verdict."),
});

export async function renderVerdict({
  claim,
  learnings,
  model,
}: {
  claim: string;
  learnings: Learning[];
  model: SupportedModel;
}): Promise<{ report: FactCheckReport; usage: TokenUsage }> {
  
  const evidenceText = learnings.map((l) => `- Source: ${l.url}\n  Finding: "${l.learning}"`).join('\n');

  const prompt = `You are a lead fact-checker for a major news organization, renowned for your impartiality and critical thinking. You have been tasked with rendering a final verdict on a claim based on a dossier of evidence collected by your research team.

**Original Claim to Verify:** "${claim}"

**Collected Evidence (Dossier):**
${evidenceText}

**Your Task:**
Analyze the collected evidence to determine the validity of the original claim.
1.  **Weigh the Evidence:** Compare and contrast the findings. Look for consensus among reputable sources. Identify any contradictions.
2.  **Form a Conclusion:** Based on the balance of evidence, decide on a final verdict.
3.  **Justify Your Verdict:** Write a concise summary explaining your reasoning. Briefly mention the strongest pieces of evidence that led to your conclusion.
4.  **Structure Your Output:** Adhere strictly to the required JSON format.

The final verdict MUST be one of: 'True', 'Mostly True', 'Misleading', 'False', or 'Unverifiable'.`;
  
  const { object, usage } = await generateObject({
    model: getModelProvider(model),
    schema: VerdictSchema,
    prompt,
  });
  
  return {
    report: object,
    usage: { inputTokens: usage.promptTokens, outputTokens: usage.completionTokens },
  };
}