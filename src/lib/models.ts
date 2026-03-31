import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { LanguageModel } from "ai";
import { SupportedModel } from "./types";

// Memoize the provider to avoid re-creating it on every call
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
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
    case "google":
      return google(modelName as any);
    default:
      console.warn(
        `Unsupported model platform: ${platform}. Defaulting to gemini-3-flash-preview.`
      );
      return google("gemini-3-flash-preview");
  }
}
