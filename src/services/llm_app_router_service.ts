// services/llm_app_router_service.ts (Conceptual improvement using Zod)
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod'; // You would need to install Zod: npm install zod

import { getTopToolDescriptionsForApp, getAllAvailableAppNames } from '../data/top_tools_registry';

// Define your output schema using Zod
export const llmRoutingSchema = z.object({
  appNames: z.array(z.string()).describe("List of relevant application names."),
  toolNames: z.array(z.string()).describe("List of specific tool names that are necessary from those apps' top tools."),
});

// Infer the TypeScript type from the Zod schema
export type LLMRoutingResponse = z.infer<typeof llmRoutingSchema>;

const LLM_MODEL = 'gpt-4o-mini';

export async function routeAppsWithLLM(
  userQuery: string
): Promise<LLMRoutingResponse> {
  const availableAppNames = getAllAvailableAppNames();
  const appContext = availableAppNames.map(appName => ({
    appName: appName,
    topTools: getTopToolDescriptionsForApp(appName),
  }));

  // The prompt would be slightly simpler as the schema handles the structure
  const prompt = `You are an intelligent routing assistant. Your task is to analyze a user's query and identify which applications and *specific tools* from their "top tools" list are absolutely necessary to fulfill the user's request.

For each relevant application, examine its available "top tools" (provided with descriptions).
If the user's query can be fulfilled directly by one or more of these "top tools", include only those *specific tool names*.
If the user's query is relevant to an app but clearly requires a tool *not* in its "top tools" list, or if the intent is too complex for the top tools, then *do not* include any tools for that app.
If an app is not relevant at all, do not include it in the response.

Available Apps and Their Top Tools with Descriptions:
${JSON.stringify(appContext, null, 2)}

User Query: "${userQuery}"`;

  try {
    const { object } = await generateObject({
      model: openai(LLM_MODEL),
      system: 'You are a helpful assistant that provides JSON responses.',
      prompt: prompt,
      schema: llmRoutingSchema, // Pass the Zod schema here
      temperature: 0.1,
      maxTokens: 500,
    });

    // The 'object' is already parsed and validated by Zod
    const relevantAppNames = object.appNames.filter(name => availableAppNames.includes(name));
    const relevantToolNames = object.toolNames.filter(toolName =>
      availableAppNames.some(appName => getTopToolDescriptionsForApp(appName)[toolName])
    );

    console.log(`LLM Routing Results for query "${userQuery}":`, {
      appNames: relevantAppNames,
      toolNames: relevantToolNames
    });

    return { appNames: relevantAppNames, toolNames: relevantToolNames };

  } catch (error) {
    console.error('Error calling LLM for app routing (with structured output):', error);
    return { appNames: [], toolNames: [] };
  }
}



// // services/llm_app_router_service.ts
// import { generateText, streamText } from "ai"; // Vercel AI SDK
// import { openai } from "@ai-sdk/openai"; // Specific provider

// import {
//   getTopToolDescriptionsForApp,
//   getAllAvailableAppNames,
// } from "../data/top_tools_registry"; // Import the new registry function
// // Initialize LLM client (Vercel AI SDK handles API Key via env vars)
// // Ensure OPENAI_API_KEY (or similar) is set in your .env file
// const LLM_MODEL = "gpt-4o-mini"; // The specified model

// // Define the expected structured output from the LLM
// export interface LLMRoutingResponse {
//   appNames: string[]; // List of relevant app names
//   toolNames: string[]; // List of relevant tool names from those apps' top tools
// }

// /**
//  * Uses an LLM to analyze a query and suggest relevant apps and specific top tools.
//  * It will only return tools from the provided top tools list if they are directly relevant.
//  * @param userQuery The natural language query from the user.
//  * @returns A Promise resolving to an LLMRoutingResponse object.
//  */
// export async function routeAppsWithLLM(
//   userQuery: string
// ): Promise<LLMRoutingResponse> {
//   // Get all available app names and their top tool descriptions
//   const availableAppNames = getAllAvailableAppNames();
//   const appContext = availableAppNames.map((appName) => ({
//     appName: appName,
//     topTools: getTopToolDescriptionsForApp(appName),
//   }));

//   // Craft a detailed prompt for the LLM
//   // We'll instruct it to only select tools it deems necessary from the provided list.
//   const prompt = `You are an intelligent routing assistant. Your task is to analyze a user's query and identify which applications and *specific tools* from their "top tools" list are absolutely necessary to fulfill the user's request.

// For each relevant application, examine its available "top tools" (provided with descriptions).
// If the user's query can be fulfilled directly by one or more of these "top tools", include only those *specific tool names*.
// If the user's query is relevant to an app but clearly requires a tool *not* in its "top tools" list, or if the intent is too complex for the top tools, then *do not* include any tools for that app.
// If an app is not relevant at all, do not include it in the response.

// Your response must be a JSON object with two properties: 'appNames' (an array of relevant application names) and 'toolNames' (an array of specific tool names from the 'top tools' list that are necessary).
// Ensure both arrays only contain unique entries.

// Available Apps and Their Top Tools with Descriptions:
// ${JSON.stringify(appContext, null, 2)}

// User Query: "${userQuery}"

// Your Response (JSON object):`;

//   try {
//     // Use Vercel AI SDK's generateText for structured output
//     const { text } = await generateText({
//       model: openai(LLM_MODEL), // Specify the model from your provider
//       system: "You are a helpful assistant that provides JSON responses.",
//       prompt: prompt,
//       temperature: 0.1, // Keep it low for more deterministic JSON output
//       maxTokens: 500, // Adjust based on expected output size
//       // Vercel AI SDK automatically attempts JSON parsing if the prompt suggests it.
//       // For more strict parsing, you can use Zod schemas with `experimental_streamObject` or `experimental_generateObject`
//       // but for simple arrays, instructing the LLM is often enough.
//     });

//     if (!text) {
//       console.warn("LLM returned no content for app routing.");
//       return { appNames: [], toolNames: [] };
//     }

//     // Attempt to parse the JSON response
//     const parsedResponse: LLMRoutingResponse = JSON.parse(text);

//     // Basic validation of the parsed response
//     const relevantAppNames = Array.isArray(parsedResponse.appNames)
//       ? parsedResponse.appNames.filter((name) =>
//           availableAppNames.includes(name)
//         ) // Filter to only known apps
//       : [];

//     const relevantToolNames = Array.isArray(parsedResponse.toolNames)
//       ? parsedResponse.toolNames.filter(
//           (toolName) =>
//             availableAppNames.some(
//               (appName) => getTopToolDescriptionsForApp(appName)[toolName]
//             ) // Ensure tool is a known top tool
//         )
//       : [];

//     console.log(`LLM Routing Results for query "${userQuery}":`, {
//       appNames: relevantAppNames,
//       toolNames: relevantToolNames,
//     });

//     return { appNames: relevantAppNames, toolNames: relevantToolNames };
//   } catch (error) {
//     console.error("Error calling LLM for app routing:", error);
//     // Return empty arrays on error
//     return { appNames: [], toolNames: [] };
//   }
// }
