import { getModelProvider } from "@/lib/models";
import { generateText } from "ai";
import { SupportedModel, TokenUsage } from "@/lib/types";

export async function translateText({
  text,
  targetLanguage,
  model,
}: {
  text: string;
  targetLanguage: string;
  model: SupportedModel;
}): Promise<{ translatedText: string; usage: TokenUsage }> {
  const prompt = `You are an expert translator. Your sole task is to translate the given text into the specified target language accurately and naturally. Do not add any commentary, notes, or explanations. Only provide the translated text as your response.

**Target Language:** ${targetLanguage}

**Text to Translate:**
---
${text}
---

**Translated Text:**`;

  // Use a fast and cost-effective model for translation
  const translationModel = getModelProvider("openai:gpt-4o-mini");

  const { text: translatedText, usage } = await generateText({
    model: translationModel,
    prompt: prompt,
  });

  return {
    translatedText: translatedText.trim(),
    usage: {
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
    },
  };
}
