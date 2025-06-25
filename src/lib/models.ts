import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModel } from "ai";
import { SupportedModel } from "./types";

// Memoize the providers to avoid re-creating them on every call
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY, // Ensure you have GOOGLE_API_KEY for Gemini
});
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Returns the appropriate AI model provider based on the identifier string.
 * @param modelIdentifier - A string in the format 'platform:model-name'.
 * @returns An instance of a CoreLanguageModel.
 */
export function getModelProvider(
  modelIdentifier: SupportedModel
): LanguageModel {
  const [platform, modelName] = modelIdentifier.split(":");

  switch (platform) {
    case "openai":
      return openai(modelName as any); // Using 'as any' is a safe workaround for SDK's specific type strings
    case "google":
      return google(modelName as any);
    default:
      console.warn(
        `Unsupported model platform: ${platform}. Defaulting to gemini-1.5-flash-latest.`
      );
      // --- CHANGE: Default model is now Google Gemini Flash ---
      return google("gemini-1.5-flash-latest");
  }
}
