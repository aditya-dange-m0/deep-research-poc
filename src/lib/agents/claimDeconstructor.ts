import { getModelProvider } from "@/lib/models";
import { generateText } from "ai";
import { SupportedModel, TokenUsage } from "@/lib/types";

export async function deconstructClaim({
  claim,
  model,
}: {
  claim: string;
  model: SupportedModel;
}): Promise<{ queries: string[]; usage: TokenUsage }> {
  const prompt = `**Role:** You are a highly skeptical, unbiased investigative journalist and a meticulous fact-checker. Your primary mission is to rigorously verify a given claim or headline by generating a set of precise, neutral, and fact-finding search queries. Your ultimate goal is to gather comprehensive, balanced evidence from multiple perspectives to determine the veracity of the claim.

---

**Claim to Investigate:** "${claim}"

---

**Instructions for Query Generation:**

Generate exactly 3 concise, high-quality search queries. Each query must be distinct and designed to independently explore a critical facet of the claim, ensuring a thorough and balanced investigation. Aim for queries that will lead to authoritative and factual information, covering the following key angles:

1.  **Primary Source & Original Context:** Focus on finding the absolute original source of the claim (e.g., the specific study, official report, raw data, or direct statement). Queries should aim to verify the claim's origin, methodology, and direct wording.
    * *Example Focus:* "original study [keywords from claim]", "report by [entity mentioned in claim] [year]", "official data [subject of claim]"

2.  **Confirming & Corroborating Evidence:** Develop queries to find reputable, independent sources that confirm, support, or provide additional evidence for the claim. This includes scientific consensus, peer reviews, follow-up studies, or expert analyses that align with the claim.
    * *Example Focus:* "evidence supporting [claim subject]", "meta-analysis [claim topic]", "expert consensus on [claim]"

3.  **Refuting Evidence, Criticisms & Nuance:** Formulate queries to actively seek out reputable sources that challenge, contradict, debunk, or provide critical perspectives on the claim. This includes studies with conflicting findings, critiques of methodology, alternative explanations, or discussions of limitations and biases.
    * *Example Focus:* "debunking [claim]", "criticism of [claim's subject] research", "studies contradicting [claim's core idea]", "limitations of [claim's research type]"

---

**Output Rules:**

* Provide **exactly 3 queries**.
* Each query must be on its own **new, separate line**.
* **Do not use any numbering, bullet points, hyphens, asterisks, or any other formatting characters.**
* Queries must be strictly neutral, objective, and non-leading. Avoid any language that implies a bias towards or against the claim.
* Prioritize specific keywords likely to appear in authoritative research, official reports, and academic journals.
* **Crucially, do not include any conversational text, pleasantries, introductory phrases, or concluding remarks. Your output must consist solely of the raw queries.**

---

**Example of Expected Output (Claim: "Study shows eating chocolate daily reduces stress"):**
chocolate daily stress reduction original study
meta-analysis chocolate mental health benefits
studies debunking chocolate stress claims

---

**Generate the neutral search queries now:**`;

  const { text, usage } = await generateText({
    model: getModelProvider(model),
    prompt,
  });

  const queries = text
    .split("\n")
    .map((q) => q.trim())
    .filter((q) => q.length > 0);
  return {
    queries,
    usage: {
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
    },
  };
}
