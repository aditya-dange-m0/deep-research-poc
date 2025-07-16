

// import { NextResponse } from "next/server";
// import { generateText, generateObject, ToolSet, CoreMessage } from "ai";
// import { openai } from "@ai-sdk/openai";
// import { z } from "zod";

// // Your existing services/utils
// import {
//   initializePineconeIndex,
//   getComposioAppToolsFromPinecone,
// } from "@/lib/pineconeInit";
// import { LLMRoutingResponse } from "@/services/llm_app_router_service";
// import {
//   getComposioAppTools,
//   getComposioTool,
//   getComposioConnectionStatus,
//   executeComposioAction,
//   enableComposioConnection,
// } from "@/lib/agent-backend/composioService";
// import { ComposioToolSet } from "composio-core";

// const AGENT_LLM_MODEL = "gpt-4o-mini";
// const MAX_AGENT_STEPS = 8; // Increased for multi-step operations
// const MAX_CONVERSATION_HISTORY = 10;

// // Enhanced schemas for multi-step planning
// const planningStepSchema = z.object({
//   stepNumber: z.number(),
//   description: z.string(),
//   requiredData: z.array(z.string()),
//   appName: z.string().optional(),
//   toolCategory: z.string(),
//   dependencies: z.array(z.number()),
//   priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
// });

// const executionPlanSchema = z.object({
//   queryAnalysis: z.string(),
//   isQueryClear: z.boolean(),
//   needsInfoGathering: z.boolean(),
//   missingInformation: z.array(z.string()),
//   executionSteps: z.array(planningStepSchema),
//   estimatedComplexity: z.enum(["low", "medium", "high"]),
//   requiresSequentialExecution: z.boolean(),
//   // requiresToolExecution: z
//   //   .boolean()
//   //   .describe(
//   //     "True if the query requires external tools or multi-step execution; false for simple informational or conversational responses"
//   //   ),
//   // confidenceScore: z
//   //   .number()
//   //   .min(0)
//   //   .max(1)
//   //   .describe(
//   //     "A confidence score (0-1) in the clarity and actionability of the query and the generated plan. 1 is absolute certainty."
//   //   ),
// });

// const infoGatheringSchema = z.object({
//   searchQueries: z.array(z.string()),
//   clarificationNeeded: z.array(z.string()),
//   canProceedWithDefaults: z.boolean(),
// });

// type ExecutionPlan = z.infer<typeof executionPlanSchema>;
// type InfoGathering = z.infer<typeof infoGatheringSchema>;

// interface ChatMessage {
//   role: "user" | "assistant" | "system";
//   content: string;
//   timestamp: number;
//   toolCalls?: { name: string; args: any; result?: any }[];
//   executionPlan?: ExecutionPlan;
//   stepResults?: { stepNumber: number; success: boolean; result?: any }[];
// }

// interface ChatRequestBody {
//   userQuery: string;
//   userId: string;
//   conversationHistory?: ChatMessage[];
//   sessionId?: string;
// }

// interface ChatResponse {
//   response: string;
//   executedTools?: {
//     name: string;
//     args: any;
//     result?: any;
//     stepNumber?: number;
//   }[];
//   requiredConnections?: string[];
//   conversationHistory?: ChatMessage[];
//   executionPlan?: ExecutionPlan;
//   error?: string;
// }

// // In-memory conversation store
// const conversationStore = new Map<string, ChatMessage[]>();

// function getConversationKey(userId: string, sessionId?: string): string {
//   return sessionId ? `${userId}:${sessionId}` : userId;
// }

// function getConversationHistory(
//   userId: string,
//   sessionId?: string
// ): ChatMessage[] {
//   const key = getConversationKey(userId, sessionId);
//   return conversationStore.get(key) || [];
// }

// function updateConversationHistory(
//   userId: string,
//   message: ChatMessage,
//   sessionId?: string
// ): void {
//   const key = getConversationKey(userId, sessionId);
//   const history = conversationStore.get(key) || [];
//   history.push(message);

//   if (history.length > MAX_CONVERSATION_HISTORY) {
//     history.splice(0, history.length - MAX_CONVERSATION_HISTORY);
//   }

//   conversationStore.set(key, history);
// }

// // Enhanced Planning Service
// class EnhancedPlanningService {
//   async createExecutionPlan(
//     userQuery: string,
//     conversationHistory: ChatMessage[]
//   ): Promise<ExecutionPlan> {
//     const contextualInfo = conversationHistory
//       .slice(-3)
//       .map((msg) => `${msg.role}: ${msg.content.substring(0, 100)}`)
//       .join("\n");

//     const prompt = `You are an intelligent query planner. Analyze the user's request and create a detailed execution plan.

// Context from recent conversation:
// ${contextualInfo}

// Current Query: "${userQuery}"

// Your task is to:
// 1. Understand what the user is asking for
// 2. Determine if this is a simple query or requires multi-step execution
// 3. Break down complex requests into logical, sequential steps
// 4. Identify what data/information is needed for each step
// 5. Assess if the query is clear and actionable
// 6. Determine if information gathering is needed before execution

// Consider:
// - Does this query reference previous conversation context?
// - Are there ambiguous terms that need clarification?
// - Does this require sequential steps or can be done in parallel?
// - What apps/tools might be needed for each step?

// Create a comprehensive execution plan.`;

//     try {
//       const { object } = await generateObject({
//         model: openai(AGENT_LLM_MODEL),
//         system:
//           "You are a helpful planning assistant that provides structured analysis.",
//         prompt: prompt,
//         schema: executionPlanSchema,
//         temperature: 0.1,
//         maxTokens: 1000,
//       });

//       console.log(`Execution Plan created for query "${userQuery}":`, {
//         complexity: object.estimatedComplexity,
//         steps: object.executionSteps.length,
//         needsInfoGathering: object.needsInfoGathering,
//       });

//       return object;
//     } catch (error) {
//       console.error("Error creating execution plan:", error);
//       // Return a simple fallback plan
//       return {
//         queryAnalysis: "Simple query that can be handled directly",
//         isQueryClear: true,
//         needsInfoGathering: false,
//         missingInformation: [],
//         executionSteps: [
//           {
//             stepNumber: 1,
//             description: "Handle user query directly",
//             requiredData: [],
//             toolCategory: "general",
//             dependencies: [],
//             priority: "medium" as const,
//           },
//         ],
//         estimatedComplexity: "low" as const,
//         requiresSequentialExecution: false,
//       };
//     }
//   }

//   async gatherMissingInformation(
//     userQuery: string,
//     executionPlan: ExecutionPlan
//   ): Promise<InfoGathering> {
//     if (!executionPlan.needsInfoGathering) {
//       return {
//         searchQueries: [],
//         clarificationNeeded: [],
//         canProceedWithDefaults: true,
//       };
//     }

//     const prompt = `Based on the execution plan, determine what information needs to be gathered.

// Query: "${userQuery}"
// Missing Information: ${executionPlan.missingInformation.join(", ")}
// Analysis: ${executionPlan.queryAnalysis}

// Create specific search queries to find the missing information and identify what clarification is needed.`;

//     try {
//       const { object } = await generateObject({
//         model: openai(AGENT_LLM_MODEL),
//         system: "You are a helpful information gathering assistant.",
//         prompt: prompt,
//         schema: infoGatheringSchema,
//         temperature: 0.1,
//         maxTokens: 500,
//       });

//       return object;
//     } catch (error) {
//       console.error("Error gathering information requirements:", error);
//       return {
//         searchQueries: [],
//         clarificationNeeded: [],
//         canProceedWithDefaults: true,
//       };
//     }
//   }
// }

// // Enhanced Tool Selection Service
// class EnhancedToolSelectionService {
//   async selectToolsForSteps(
//     executionPlan: ExecutionPlan,
//     userQuery: string,
//     req: Request
//   ): Promise<{ stepNumber: number; appName: string; toolNames: string[] }[]> {
//     const stepToolMappings: {
//       stepNumber: number;
//       appName: string;
//       toolNames: string[];
//     }[] = [];

//     for (const step of executionPlan.executionSteps) {
//       if (step.appName) {
//         try {
//           // Use Pinecone to find relevant tools for this specific step
//           const searchQuery = `${step.description} ${
//             step.toolCategory
//           } ${step.requiredData.join(" ")}`;
//           const searchToolsApiUrl = new URL(
//             "/api/agent/tools/search",
//             req.url
//           ).toString();

//           const res = await fetch(searchToolsApiUrl, {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({
//               appName: step.appName,
//               userQuery: searchQuery,
//               topK: 3,
//             }),
//           });

//           if (res.ok) {
//             const pineconeSearchRes = await res.json();
//             const relevantTools = pineconeSearchRes.relevantTools || [];

//             if (relevantTools.length > 0) {
//               stepToolMappings.push({
//                 stepNumber: step.stepNumber,
//                 appName: step.appName,
//                 toolNames: relevantTools,
//               });
//               console.log(
//                 `Step ${step.stepNumber}: Found ${relevantTools.length} tools for ${step.appName}`
//               );
//             }
//           }
//         } catch (error) {
//           console.warn(
//             `Tool search failed for step ${step.stepNumber}:`,
//             error
//           );
//         }
//       }
//     }

//     return stepToolMappings;
//   }
// }

// // Enhanced execution context
// class ExecutionContext {
//   private stepResults: Map<number, any> = new Map();
//   private executionLog: string[] = [];

//   addStepResult(stepNumber: number, result: any): void {
//     this.stepResults.set(stepNumber, result);
//     this.executionLog.push(
//       `Step ${stepNumber} completed: ${
//         typeof result === "object"
//           ? JSON.stringify(result).substring(0, 100)
//           : result
//       }`
//     );
//   }

//   getStepResult(stepNumber: number): any {
//     return this.stepResults.get(stepNumber);
//   }

//   getExecutionSummary(): string {
//     return this.executionLog.join("\n");
//   }

//   enrichParametersWithContext(parameters: any, step: any): any {
//     if (!parameters || typeof parameters !== "object") {
//       return parameters;
//     }

//     const enriched = { ...parameters };

//     // Replace context references
//     for (const [key, value] of Object.entries(enriched)) {
//       if (typeof value === "string" && value.startsWith("$step_")) {
//         const stepNumber = parseInt(value.substring(6));
//         const stepResult = this.getStepResult(stepNumber);
//         if (stepResult) {
//           enriched[key] = stepResult;
//         }
//       }
//     }

//     return enriched;
//   }
// }

// function buildEnhancedContextualPrompt(
//   userQuery: string,
//   conversationHistory: ChatMessage[],
//   executionPlan: ExecutionPlan,
//   hasTools: boolean
// ): string {
//   const currentDate = new Date().toISOString().split("T")[0];

//   let prompt = `You are an advanced AI assistant with comprehensive knowledge and specialized tool access. You excel at handling complex, multi-step requests through careful planning and execution.

// **Today's Date:** ${currentDate}

// **Execution Plan Analysis:**
// - Query Complexity: ${executionPlan.estimatedComplexity}
// - Steps Required: ${executionPlan.executionSteps.length}
// - Sequential Execution: ${
//     executionPlan.requiresSequentialExecution ? "Yes" : "No"
//   }
// - Clear Query: ${executionPlan.isQueryClear ? "Yes" : "No"}

// **Execution Steps:**
// ${executionPlan.executionSteps
//   .map(
//     (step) =>
//       `${step.stepNumber}. ${step.description} (Priority: ${step.priority})`
//   )
//   .join("\n")}

// **Multi-Step Execution Protocol:**

// **For Sequential Operations:**
// 1. Execute steps in order based on dependencies
// 2. Use results from previous steps to inform next steps
// 3. Provide progress updates: "Step X completed. Proceeding to Step Y..."
// 4. Handle errors gracefully with alternatives

// **For Information Gathering:**
// - Search BEFORE create/update/delete operations
// - Resolve vague references by searching
// - Validate prerequisites before proceeding

// **Tool Usage Strategy:**
// - For complex operations: Break into subtasks
// - For missing data: Search first, then ask for clarification
// - For errors: Try alternatives, provide partial results
// - For dependencies: Ensure prerequisite steps complete first`;

//   // Add conversation context
//   if (conversationHistory.length > 0) {
//     prompt += `\n\n**Previous Context:**\n`;
//     conversationHistory.slice(-3).forEach((msg) => {
//       if (msg.role === "user") {
//         prompt += `User: ${msg.content}\n`;
//       } else if (msg.role === "assistant") {
//         prompt += `Assistant: ${msg.content.substring(0, 150)}${
//           msg.content.length > 150 ? "..." : ""
//         }\n`;
//       }
//     });
//   }

//   prompt += `\n\n**Current Request:** "${userQuery}"\n`;

//   if (hasTools) {
//     prompt += `\n**Available Tools:** You have access to specialized tools. Execute the planned steps systematically.`;
//   }

//   if (executionPlan.requiresSequentialExecution) {
//     prompt += `\n\n**IMPORTANT:** This request requires sequential execution. Complete each step before moving to the next, and use results from previous steps to inform subsequent actions.`;
//   }

//   return prompt;
// }

// export async function POST(req: Request) {
//   try {
//     const body = await req.json();
//     const { userQuery, userId, conversationHistory, sessionId } =
//       body.body || body;

//     if (!userQuery || !userId) {
//       return NextResponse.json(
//         {
//           response: "Missing userQuery or userId in request body.",
//           error: "INVALID_REQUEST",
//         },
//         { status: 400 }
//       );
//     }

//     const trimmedQuery = userQuery.trim();
//     const trimmedUserId = userId.trim();

//     if (!trimmedQuery || !trimmedUserId) {
//       return NextResponse.json(
//         {
//           response: "userQuery or userId cannot be empty.",
//           error: "INVALID_REQUEST",
//         },
//         { status: 400 }
//       );
//     }

//     console.log(`--- Enhanced Chat Request for user ${userId} ---`);
//     console.log(`Query: "${userQuery}"`);

//     // Initialize services
//     await initializePineconeIndex();
//     const planningService = new EnhancedPlanningService();
//     const toolSelectionService = new EnhancedToolSelectionService();
//     const executionContext = new ExecutionContext();

//     // Get conversation history
//     const existingHistory =
//       conversationHistory || getConversationHistory(userId, sessionId);
//     console.log(`Conversation history length: ${existingHistory.length}`);

//     // Phase 1: Create execution plan
//     console.log("Phase 1: Creating execution plan...");
//     const executionPlan = await planningService.createExecutionPlan(
//       userQuery,
//       existingHistory
//     );

//     // Phase 2: Information gathering if needed
//     console.log("Phase 2: Checking information gathering needs...");
//     const infoGathering = await planningService.gatherMissingInformation(
//       userQuery,
//       executionPlan
//     );

//     if (
//       infoGathering.clarificationNeeded.length > 0 &&
//       !infoGathering.canProceedWithDefaults
//     ) {
//       // Return clarification request
//       const clarificationResponse = `I need clarification on the following points to proceed:\n\n${infoGathering.clarificationNeeded
//         .map((item, idx) => `${idx + 1}. ${item}`)
//         .join(
//           "\n"
//         )}\n\nPlease provide this information so I can assist you better.`;

//       return NextResponse.json({
//         response: clarificationResponse,
//         executionPlan,
//         conversationHistory: existingHistory,
//       });
//     }

//     // Phase 3: Enhanced tool routing and selection
//     console.log("Phase 3: Enhanced tool routing...");
//     let fetchedComposioTools: ToolSet = {};
//     let hasTools = false;
//     let requiredConnections: string[] = [];
//     let stepToolMappings: {
//       stepNumber: number;
//       appName: string;
//       toolNames: string[];
//     }[] = [];

//     // Use existing routing service for app identification
//     try {
//       const routeAppsApiUrl = new URL(
//         "/api/agent/route-apps",
//         req.url
//       ).toString();
//       const routingRes = await fetch(routeAppsApiUrl, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ userQuery }),
//       });

//       if (routingRes.ok) {
//         const { appNames } = (await routingRes.json()) as LLMRoutingResponse;
//         console.log(`Routing identified apps: ${JSON.stringify(appNames)}`);

//         if (appNames.length > 0) {
//           // Enhanced tool selection based on execution plan
//           stepToolMappings = await toolSelectionService.selectToolsForSteps(
//             executionPlan,
//             userQuery,
//             req
//           );

//           // Prepare tools for all identified apps and steps
//           const toolResult = await prepareEnhancedTools(
//             appNames,
//             stepToolMappings,
//             userQuery,
//             userId,
//             req
//           );

//           fetchedComposioTools = toolResult.tools;
//           hasTools = Object.keys(fetchedComposioTools).length > 0;
//           requiredConnections = toolResult.requiredConnections;

//           console.log(
//             `Enhanced tools prepared: ${hasTools}, Tool count: ${
//               Object.keys(fetchedComposioTools).length
//             }`
//           );
//         }
//       }
//     } catch (error) {
//       console.warn(
//         "Enhanced tool routing failed, proceeding with general knowledge:",
//         error
//       );
//     }

//     // Phase 4: Generate contextual prompt with execution plan
//     const contextualPrompt = buildEnhancedContextualPrompt(
//       userQuery,
//       existingHistory,
//       executionPlan,
//       hasTools
//     );

//     // Phase 5: Execute with enhanced multi-step capability
//     console.log("Phase 5: Executing with enhanced multi-step capability...");
//     const currentLlmResponse = await generateText({
//       model: openai(AGENT_LLM_MODEL),
//       prompt: contextualPrompt,
//       tools: hasTools ? fetchedComposioTools : undefined,
//       toolChoice: hasTools ? "auto" : undefined,
//       temperature: 0.3,
//       maxSteps: MAX_AGENT_STEPS,
//       maxTokens: 4000,
//       onStepFinish: (step) => {
//         console.log("Step completed:", {
//           toolCalls: step.toolCalls?.length || 0,
//           text: step.text?.substring(0, 100) || "No text",
//         });
//       },
//     });

//     console.log(
//       `Response generated. Tool calls: ${
//         currentLlmResponse.toolCalls?.length || 0
//       }`
//     );
//     console.log(`Steps used: ${currentLlmResponse.steps?.length || 1}`);

//     const responseText =
//       currentLlmResponse.text ||
//       "I've processed your request using enhanced multi-step planning.";
//     const toolCalls = currentLlmResponse.toolCalls || [];

//     // Track step results
//     const stepResults = toolCalls.map((tool, idx) => ({
//       stepNumber: idx + 1,
//       success: true,
//       toolCallId: tool.toolCallId,
//     }));

//     // Create enhanced assistant message
//     const assistantMessage: ChatMessage = {
//       role: "assistant",
//       content: responseText,
//       timestamp: Date.now(),
//       toolCalls: toolCalls.map((tool) => ({
//         name: tool.toolName,
//         args: tool.args,
//         toolCallId: tool.toolCallId,
//       })),
//       executionPlan,
//       stepResults,
//     };

//     // Add user message
//     const userMessage: ChatMessage = {
//       role: "user",
//       content: userQuery,
//       timestamp: Date.now(),
//     };

//     // Update conversation history
//     updateConversationHistory(userId, userMessage, sessionId);
//     updateConversationHistory(userId, assistantMessage, sessionId);

//     // Prepare enhanced response
//     const response: ChatResponse = {
//       response: responseText,
//       executedTools: toolCalls.map((tool, idx) => ({
//         name: tool.toolName,
//         args: tool.args,
//         toolCallId: tool.toolCallId,
//         stepNumber: idx + 1,
//       })),
//       requiredConnections:
//         requiredConnections.length > 0 ? requiredConnections : undefined,
//       conversationHistory: getConversationHistory(userId, sessionId),
//       executionPlan,
//     };

//     console.log("Enhanced response generated successfully");
//     return NextResponse.json(response);
//   } catch (error: any) {
//     console.error("Enhanced API Error in chat orchestration:", error);
//     return NextResponse.json(
//       {
//         response:
//           "I encountered an error while processing your request with enhanced planning. Please try again.",
//         error: error.message,
//       },
//       { status: 500 }
//     );
//   }
// }

// async function prepareEnhancedTools(
//   appNames: string[],
//   stepToolMappings: {
//     stepNumber: number;
//     appName: string;
//     toolNames: string[];
//   }[],
//   userQuery: string,
//   userId: string,
//   req: Request
// ): Promise<{ tools: ToolSet; requiredConnections: string[] }> {
//   let fetchedComposioTools: ToolSet = {};
//   const appsNeedingConnection: string[] = [];

//   // Mock function - replace with your actual implementation
//   async function getConnectedAccountIdForUserAndApp(
//     userId: string,
//     appName: string
//   ): Promise<string> {
//     const mockConnectedAccountMap: { [key: string]: string } = {
//       GMAIL: "mock_gmail_conn_id_123",
//       GOOGLECALENDAR: "mock_calendar_conn_id_123",
//       GOOGLEDRIVE: "mock_drive_conn_id_123",
//       NOTION: "mock_notion_conn_id_123",
//       GOOGLEDOCS: "8e0f132c-a72b-46a2-951a-8c57b859e532",
//     };
//     return mockConnectedAccountMap[appName] || "";
//   }

//   // Process each app
//   for (const appName of appNames) {
//     const connectedAccountId = await getConnectedAccountIdForUserAndApp(
//       userId,
//       appName
//     );

//     if (!connectedAccountId) {
//       appsNeedingConnection.push(appName);
//       continue;
//     }

//     // Verify connection status
//     const connectionStatusResult = await getComposioConnectionStatus(
//       connectedAccountId
//     );
//     if (
//       connectionStatusResult.status !== "INITIATED" &&
//       connectionStatusResult.status !== "ACTIVE"
//     ) {
//       appsNeedingConnection.push(appName);
//       continue;
//     }

//     // Get tools for this app from step mappings
//     const appStepMappings = stepToolMappings.filter(
//       (mapping) => mapping.appName === appName
//     );
//     const allToolsForApp = appStepMappings.flatMap(
//       (mapping) => mapping.toolNames
//     );
//     const uniqueToolsForApp = [...new Set(allToolsForApp)];

//     if (uniqueToolsForApp.length === 0) {
//       // Fallback to semantic search if no specific tools found
//       try {
//         const searchToolsApiUrl = new URL(
//           "/api/agent/tools/search",
//           req.url
//         ).toString();
//         const res = await fetch(searchToolsApiUrl, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ appName, userQuery, topK: 5 }),
//         });

//         if (res.ok) {
//           const pineconeSearchRes = await res.json();
//           uniqueToolsForApp.push(...pineconeSearchRes.relevantTools);
//         }
//       } catch (error) {
//         console.warn(`Semantic search fallback failed for ${appName}:`, error);
//       }
//     }

//     // Fetch tools if available
//     if (uniqueToolsForApp.length > 0) {
//       try {
//         const tools = (await getComposioTool(uniqueToolsForApp)) as ToolSet;
//         fetchedComposioTools = { ...fetchedComposioTools, ...tools };
//         console.log(
//           `Enhanced: Fetched ${Object.keys(tools).length} tools for ${appName}`
//         );
//       } catch (error) {
//         console.error(`Error fetching enhanced tools for ${appName}:`, error);
//       }
//     }
//   }

//   return {
//     tools: fetchedComposioTools,
//     requiredConnections: appsNeedingConnection,
//   };
// }












// // src/app/api/chat/route.ts
// import { NextResponse } from 'next/server';
// import { generateText, generateObject,ToolSet,CoreMessage } from 'ai';
// import { openai } from '@ai-sdk/openai';

// // Your existing services/utils
// import { initializePineconeIndex, getComposioAppToolsFromPinecone } from '@/lib/pineconeInit'; // Renamed initializePineconeClient to initializePineconeIndex as per your code
// import { LLMRoutingResponse } from '@/services/llm_app_router_service'; // Assuming Zod version
// import {
//   getComposioAppTools, // To get all tools for an app (when semantic search is needed)
//   getComposioTool,    // To get specific tool definitions (when top tools are identified)
//   getComposioConnectionStatus,
//   executeComposioAction,
//   enableComposioConnection
// } from '@/lib/agent-backend/composioService'; // Corrected path to Composio service
// // import { Tool } from '@/types/types'; // Import your Tool type
// import { ComposioToolSet } from "composio-core";
// const AGENT_LLM_MODEL = 'gpt-4o-mini'; // Or a more capable model like 'gpt-4o' for complex reasoning
// const MAX_AGENT_STEPS = 5;

// interface ChatRequestBody {
//   userQuery: string;
//   userId: string;
//   // If you maintain chat history, add: chatHistory?: { role: 'user' | 'assistant' | 'tool', content: string }[];
// }

// interface ChatResponse {
//   response: string;
//   executedTools?: { 
//     name: string; 
//     args: any;  // Changed from output to args to match the actual data structure
//   }[];
//   requiredConnections?: string[]; // List of appNames that need connection
//   error?: string;
// }

// export async function POST(req: Request) {
//   try {
//     // Parse and validate the request body
//     const body = await req.json();
//     console.log('Received request body:', body);

//     const { userQuery, userId } = body.body || body; // Try both locations due to how Vercel AI SDK sends data
//     console.log('Extracted data:', { userQuery, userId });

//     if (!userQuery || !userId) {
//       console.error('Invalid request body:', { body, userQuery, userId });
//       return NextResponse.json(
//         { 
//           response: 'Missing userQuery or userId in request body.',
//           error: 'INVALID_REQUEST'
//         },
//         { status: 400 }
//       );
//     }

//     // Trim and validate the values
//     const trimmedQuery = userQuery.trim();
//     const trimmedUserId = userId.trim();

//     if (!trimmedQuery || !trimmedUserId) {
//       console.error('Empty values after trimming:', { trimmedQuery, trimmedUserId });
//       return NextResponse.json(
//         { 
//           response: 'userQuery or userId cannot be empty.',
//           error: 'INVALID_REQUEST'
//         },
//         { status: 400 }
//       );
//     }

//     console.log(`--- Chat Request for user ${userId} ---`);
//     console.log(`Query: "${userQuery}"`);

//     // 1. Initialize services (Pinecone index)
//     await initializePineconeIndex();

//     // 2. Initial App Routing (using /api/agent/route-apps)
//     const routeAppsApiUrl = new URL('/api/agent/route-apps', req.url).toString();
//     const routingRes = await fetch(routeAppsApiUrl, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ userQuery }),
//     });

//     if (!routingRes.ok) {
//       const errorData = await routingRes.json();
//       throw new Error(`Failed to route apps: ${errorData.message || routingRes.statusText}`);
//     }
//     const { appNames, toolNames } = (await routingRes.json()) as LLMRoutingResponse;
//     console.log(`  Routing Decisions - Apps: ${JSON.stringify(appNames)}, Tools (top): ${JSON.stringify(toolNames)}`);

//     if (appNames.length === 0) {
//       return NextResponse.json({ response: "I couldn't identify any relevant applications for your request." }, { status: 200 });
//     }

//     // 3. Gather Full Tool Definitions & Check Connections
//     let fetchedComposioTools: ToolSet = {};
//     const appsNeedingConnection: string[] = [];
//     const connectedAppsData: { appName: string; connectedAccountId: string; }[] = [];

//     // --- MOCK: getConnectedAccountIdForUserAndApp ---
//     // In a real app, this would query your persistent storage
//     // to retrieve the connectedAccountId associated with userId and appName.
//     async function getConnectedAccountIdForUserAndApp(userId: string, appName: string): Promise<string> {
//       // For POC, return a consistent mock ID.
//       const mockConnectedAccountMap: { [key: string]: string } = {
//         'GMAIL': 'mock_gmail_conn_id_123',
//         'GOOGLECALENDAR': 'mock_calendar_conn_id_123',
//         'GOOGLEDRIVE': 'mock_drive_conn_id_123',
//         'NOTION': 'mock_notion_conn_id_123',
//         'GOOGLEDOCS': '8e0f132c-a72b-46a2-951a-8c57b859e532',
//         // Add more mocks as needed for testing
//       };
//       return mockConnectedAccountMap[`${appName}`];
//     }
//     // --- END MOCK ---

//     for (const appName of appNames) {
//       const connectedAccountId:string = await getConnectedAccountIdForUserAndApp(userId, appName);
//       // const connectedID = await enableComposioConnection(connectedAccountId,appName)
//       // console.log(`connectedID : ${connectedID?.connectionStatus}`)
//       if (!connectedAccountId) {
//         appsNeedingConnection.push(appName);
//         console.warn(`  App ${appName} is NOT connected for user ${userId}. Skipping tool collection.`);
//         continue;
//       }

//       // Verify connection status with Composio using the connectedAccountId
//       const connectionStatusResult = await getComposioConnectionStatus(connectedAccountId);
//       console.warn(`connectionStatusResult : ${JSON.stringify(connectionStatusResult.status)}`)
//       if (connectionStatusResult.status !== 'INITIATED' && connectionStatusResult.status !== 'ACTIVE') {
//         appsNeedingConnection.push(appName);
//         console.warn(`  Composio reports ${appName} connection ${connectedAccountId} is NOT active/connected. Skipping tool collection.`);
//         continue;
//       }

//       connectedAppsData.push({ appName, connectedAccountId });
//       console.log(`  App ${appName} is CONNECTED with ID: ${connectedAccountId}.`);

//       let toolsToFetchForApp: string[] = [];
//       const hasSpecificTools = toolNames.some(t => t.startsWith(`${appName}_`));

//       if (hasSpecificTools) {
//         // LLM suggested specific top tools, filter them for this app
//         toolsToFetchForApp = toolNames.filter(t => t.startsWith(`${appName}_`));
//         console.log(`Fetching specific top tools: ${JSON.stringify(toolsToFetchForApp)}`);
//       } else {
//         // LLM suggested no specific tools or a broader search is needed for this app
//         console.log(`    No specific top tools suggested for ${appName}. Performing semantic search...`);
//         const pineconeSearchRes = await (async () => {
//           const searchToolsApiUrl = new URL('/api/agent/tools/search', req.url).toString();
//           const res = await fetch(searchToolsApiUrl, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ appName, userQuery, topK: 5 }), // Fetch top 5
//           });
//           if (!res.ok) {
//             const errorData = await res.json();
//             throw new Error(`Failed semantic search for ${appName}: ${errorData.message || res.statusText}`);
//           }
//           return res.json();
//         })();
//         toolsToFetchForApp = pineconeSearchRes.relevantTools;
//         console.log(`    Semantic search for ${appName} returned: ${JSON.stringify(toolsToFetchForApp)}`);
//       }

//       if (toolsToFetchForApp.length > 0) {
        
//         // Fetch full tool definitions using getComposioTool
//         fetchedComposioTools = await getComposioTool(toolsToFetchForApp) as ToolSet;
//         console.log(fetchedComposioTools)
//         // Composio's getTools returns an array of objects. We need to format them for AI SDK/OpenAI.
//         // Ensure that `tool.parameters` is the direct JSON schema object.
//         // fetchedComposioTools.forEach(tool => {
//         //   toolsForAgentLLM.push({
//         //     name: tool.name, // Use 'name' property from Composio tool as AI SDK expects it
//         //     description: tool.description,
//         //     parameters: tool.parameters, // This should already be the JSON Schema object
//         //   });
//         // });
//       }
//     }

//     // if (appsNeedingConnection.length > 0) {
//     //   const responseMessage = `To help with your request, please connect your ${appsNeedingConnection.join(', ')} account(s). You can initiate the connection via the API: \`/api/agent/connect/initiate\`.`;
//     //   return NextResponse.json({ response: responseMessage, requiredConnections: appsNeedingConnection }, { status: 200 });
//     // }

//     // Check if there are any tools by inspecting the keys of the object
//     const hasTools = Object.keys(fetchedComposioTools).length > 0;
//     console.log("hasTools ::::",hasTools)
//     if (!hasTools) { // Use the hasTools boolean
//       return NextResponse.json({ response: "I couldn't find any relevant tools for your request that are currently connected." }, { status: 200 });
//     }

//     // console.log(`  Final tools prepared for Agent LLM: ${fetchedComposioTools.map(t => t.description).join(', ')}`);

//     // 4. Tool-Calling LLM Decision & Execution (using Vercel AI SDK with maxSteps)
// // Define the enhanced system instruction and prompt structure
// const enhancedPrompt = `You are a highly capable AI assistant designed to understand user requests, utilize available tools efficiently, and provide concise, helpful responses.

// **Your Task:**
// 1.  **Analyze the User's Request:** Carefully understand the intent and requirements of the user's query.
// 2.  **Tool Selection (if necessary):** Determine if any of the provided tools are needed to fulfill the request. If so, select the appropriate tool(s).
// 3.  **Tool Execution:** Call the chosen tool(s) with the correct parameters. If multiple tools are required, execute them sequentially or in parallel as appropriate for the task.
// 4.  **Response Generation:** After tool execution (or if no tool is needed), synthesize the information and provide a clear, concise, and helpful natural language response to the user, summarizing the outcome or directly answering their query.

// ---

// **Original User Query:** "${userQuery}"`; // Integrates userQuery directly into the prompt

//     console.log("fetchedComposioTools ::::",fetchedComposioTools)
//     console.log("Before reduce - fetchedComposioTools content:", fetchedComposioTools);
//     console.log("Before reduce - Is fetchedComposioTools an array?", Array.isArray(fetchedComposioTools));

//     // Call generateText ONCE, letting it manage the multi-step process with maxSteps
//     const currentLlmResponse = await generateText({
//       model: openai(AGENT_LLM_MODEL),
//       prompt: enhancedPrompt,
//       tools: hasTools ? fetchedComposioTools : undefined,
//       toolChoice: 'auto',
//       temperature: 0.5,
//       maxSteps: MAX_AGENT_STEPS,
//     });

//     // Extract response text and tool information
//     const responseText = currentLlmResponse.text || "I've processed your request using the available tools.";
//     const toolCalls = currentLlmResponse.toolCalls || [];

//     // Create a structured response
//     const response: ChatResponse = {
//       response: responseText,
//       executedTools: toolCalls.map(tool => ({
//         name: tool.toolName,
//         args: tool.args
//       }))
//     };

//     // Log the response for debugging
//     console.log('Final response:', JSON.stringify(response, null, 2));

//     // Return a regular JSON response
//     return NextResponse.json(response);
//   } catch (error: any) {
//     console.error('API Error in chat orchestration:', error);
//     return NextResponse.json(
//       { response: 'An internal error occurred while processing your request.', error: error.message },
//       { status: 500 }
//     );
//   }
// }



// // src/app/api/chat/route.ts
// import { NextResponse } from 'next/server';
// import { generateText, generateObject, ToolSet, CoreMessage } from 'ai';
// import { openai } from '@ai-sdk/openai';

// // Your existing services/utils
// import { initializePineconeIndex, getComposioAppToolsFromPinecone } from '@/lib/pineconeInit';
// import { LLMRoutingResponse } from '@/services/llm_app_router_service';
// import {
//   getComposioAppTools,
//   getComposioTool,
//   getComposioConnectionStatus,
//   executeComposioAction,
//   enableComposioConnection
// } from '@/lib/agent-backend/composioService';
// import { ComposioToolSet } from "composio-core";

// const AGENT_LLM_MODEL = 'gpt-4o-mini';
// const MAX_AGENT_STEPS = 5;
// const MAX_CONVERSATION_HISTORY = 10; // Keep last 10 messages

// interface ChatMessage {
//   role: 'user' | 'assistant' | 'system';
//   content: string;
//   timestamp: number;
//   toolCalls?: { name: string; args: any; result?: any }[];
// }

// interface ChatRequestBody {
//   userQuery: string;
//   userId: string;
//   conversationHistory?: ChatMessage[];
//   sessionId?: string;
// }

// interface ChatResponse {
//   response: string;
//   executedTools?: { 
//     name: string; 
//     args: any;
//     result?: any;
//   }[];
//   requiredConnections?: string[];
//   conversationHistory?: ChatMessage[];
//   error?: string;
// }

// // In-memory conversation store (replace with your preferred storage)
// const conversationStore = new Map<string, ChatMessage[]>();

// function getConversationKey(userId: string, sessionId?: string): string {
//   return sessionId ? `${userId}:${sessionId}` : userId;
// }

// function getConversationHistory(userId: string, sessionId?: string): ChatMessage[] {
//   const key = getConversationKey(userId, sessionId);
//   return conversationStore.get(key) || [];
// }

// function updateConversationHistory(userId: string, message: ChatMessage, sessionId?: string): void {
//   const key = getConversationKey(userId, sessionId);
//   const history = conversationStore.get(key) || [];
//   history.push(message);
  
//   // Keep only recent messages
//   if (history.length > MAX_CONVERSATION_HISTORY) {
//     history.splice(0, history.length - MAX_CONVERSATION_HISTORY);
//   }
  
//   conversationStore.set(key, history);
// }

// function buildContextualPrompt(userQuery: string, conversationHistory: ChatMessage[], hasTools: boolean): string {
//   const baseSystemPrompt = `You are an advanced AI assistant with comprehensive world knowledge and access to specialized tools when needed.

// **Your Core Capabilities:**
// 1. **Extensive Knowledge**: You have deep knowledge about virtually any topic - science, history, culture, technology, etc.
// 2. **Specialized Tools**: You have access to various applications and services that can perform specific actions
// 3. **Context Awareness**: You maintain conversation context and build meaningful relationships with users
// 4. **Advanced Reasoning**: You can analyze, synthesize, and solve complex problems

// **Tool Usage Philosophy:**
// - Use tools when they provide real-time data, perform specific actions, or access external services
// - For general knowledge, explanations, analysis, and reasoning - rely on your extensive training
// - Examples of tool usage: sending emails, scheduling meetings, searching files, getting current data
// - Examples of knowledge usage: explaining concepts, creative writing, problem-solving, analysis

// **Response Guidelines:**
// - Be helpful, accurate, and naturally conversational
// - Consider previous conversation context
// - If uncertain about something, acknowledge it honestly
// - Provide comprehensive responses that fully address the user's needs
// - Ask follow-up questions when clarification would be helpful`;

//   let contextualPrompt = baseSystemPrompt;

//   // Add conversation context if available
//   if (conversationHistory.length > 0) {
//     contextualPrompt += `\n\n**Previous Conversation Context:**\n`;
//     conversationHistory.slice(-4).forEach((msg, index) => {
//       if (msg.role === 'user') {
//         contextualPrompt += `User: ${msg.content}\n`;
//       } else if (msg.role === 'assistant') {
//         contextualPrompt += `Assistant: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}\n`;
//         if (msg.toolCalls && msg.toolCalls.length > 0) {
//           contextualPrompt += `(Tools used: ${msg.toolCalls.map(t => t.name).join(', ')})\n`;
//         }
//       }
//     });
//   }

//   // Add current query
//   contextualPrompt += `\n\n**Current User Request:** "${userQuery}"\n\n`;

//   // Add tool availability context
//   if (hasTools) {
//     contextualPrompt += `**Available Tools:** You have access to specialized tools for this request. Consider whether they would enhance your response with real-time data or specific actions.\n\n`;
//   }

//   contextualPrompt += `**Your Task:** Respond to the user's request in the most helpful way possible. Use tools if they add value, otherwise rely on your knowledge and reasoning capabilities.`;

//   return contextualPrompt;
// }

// export async function POST(req: Request) {
//   try {
//     const body = await req.json();
//     console.log('Received request body:', body);

//     const { userQuery, userId, conversationHistory, sessionId } = body.body || body;
//     console.log('Extracted data:', { userQuery, userId, sessionId });

//     if (!userQuery || !userId) {
//       console.error('Invalid request body:', { body, userQuery, userId });
//       return NextResponse.json(
//         { 
//           response: 'Missing userQuery or userId in request body.',
//           error: 'INVALID_REQUEST'
//         },
//         { status: 400 }
//       );
//     }

//     const trimmedQuery = userQuery.trim();
//     const trimmedUserId = userId.trim();

//     if (!trimmedQuery || !trimmedUserId) {
//       console.error('Empty values after trimming:', { trimmedQuery, trimmedUserId });
//       return NextResponse.json(
//         { 
//           response: 'userQuery or userId cannot be empty.',
//           error: 'INVALID_REQUEST'
//         },
//         { status: 400 }
//       );
//     }

//     console.log(`--- Chat Request for user ${userId} ---`);
//     console.log(`Query: "${userQuery}"`);

//     // Get conversation history
//     const existingHistory = conversationHistory || getConversationHistory(userId, sessionId);
//     console.log(`Conversation history length: ${existingHistory.length}`);

//     // Add current user message to history
//     const userMessage: ChatMessage = {
//       role: 'user',
//       content: userQuery,
//       timestamp: Date.now()
//     };

//     // Initialize services
//     await initializePineconeIndex();

//     // Always attempt tool routing first - let the routing service decide
//     let fetchedComposioTools: ToolSet = {};
//     let hasTools = false;
//     let requiredConnections: string[] = [];

//     try {
//       const routeAppsApiUrl = new URL('/api/agent/route-apps', req.url).toString();
//       const routingRes = await fetch(routeAppsApiUrl, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ userQuery }),
//       });

//       if (routingRes.ok) {
//         const { appNames, toolNames } = (await routingRes.json()) as LLMRoutingResponse;
//         console.log(`Routing Decisions - Apps: ${JSON.stringify(appNames)}, Tools: ${JSON.stringify(toolNames)}`);

//         if (appNames.length > 0) {
//           const toolResult = await prepareTools(appNames, toolNames, userQuery, userId, req);
//           fetchedComposioTools = toolResult.tools;
//           hasTools = Object.keys(fetchedComposioTools).length > 0;
//           requiredConnections = toolResult.requiredConnections;
//           console.log(`Tools prepared: ${hasTools}, Tool count: ${Object.keys(fetchedComposioTools).length}`);
//         } else {
//           console.log('No apps identified by routing service - proceeding with general knowledge');
//         }
//       } else {
//         console.warn('Tool routing API failed, proceeding with general knowledge');
//       }
//     } catch (error) {
//       console.warn('Tool routing failed, falling back to general knowledge:', error);
//     }

//     // Build contextual prompt
//     const contextualPrompt = buildContextualPrompt(userQuery, existingHistory, hasTools);
//     console.log('Generated contextual prompt length:', contextualPrompt.length);

//     // Generate response with appropriate tool configuration
//     const currentLlmResponse = await generateText({
//       model: openai(AGENT_LLM_MODEL),
//       prompt: contextualPrompt,
//       tools: hasTools ? fetchedComposioTools : undefined,
//       toolChoice: hasTools ? 'auto' : undefined, // Let the model decide when to use tools
//       temperature: 0.7,
//       maxSteps: MAX_AGENT_STEPS, // Always allow multiple steps for complex queries
//     });

//     console.log(`Response generated. Tool calls made: ${currentLlmResponse.toolCalls?.length || 0}`);

//     const responseText = currentLlmResponse.text || "I've processed your request.";
//     const toolCalls = currentLlmResponse.toolCalls || [];

//     // Create assistant message
//     const assistantMessage: ChatMessage = {
//       role: 'assistant',
//       content: responseText,
//       timestamp: Date.now(),
//       toolCalls: toolCalls.map(tool => ({
//         name: tool.toolName,
//         args: tool.args
//       }))
//     };

//     // Update conversation history
//     updateConversationHistory(userId, userMessage, sessionId);
//     updateConversationHistory(userId, assistantMessage, sessionId);

//     // Prepare response
//     const response: ChatResponse = {
//       response: responseText,
//       executedTools: toolCalls.map(tool => ({
//         name: tool.toolName,
//         args: tool.args
//       })),
//       requiredConnections: requiredConnections.length > 0 ? requiredConnections : undefined,
//       conversationHistory: getConversationHistory(userId, sessionId)
//     };

//     console.log('Final response generated successfully');
//     return NextResponse.json(response);

//   } catch (error: any) {
//     console.error('API Error in chat orchestration:', error);
//     return NextResponse.json(
//       { 
//         response: 'I encountered an error while processing your request. Please try again.', 
//         error: error.message 
//       },
//       { status: 500 }
//     );
//   }
// }

// // Remove the checkIfGeneralQuery function entirely since it was blocking tool calls

// async function prepareTools(
//   appNames: string[], 
//   toolNames: string[], 
//   userQuery: string, 
//   userId: string, 
//   req: Request
// ): Promise<{ tools: ToolSet; requiredConnections: string[] }> {
//   let fetchedComposioTools: ToolSet = {};
//   const appsNeedingConnection: string[] = [];
//   const connectedAppsData: { appName: string; connectedAccountId: string; }[] = [];

//   // Mock function - replace with your actual implementation
//   async function getConnectedAccountIdForUserAndApp(userId: string, appName: string): Promise<string> {
//     const mockConnectedAccountMap: { [key: string]: string } = {
//       'GMAIL': 'mock_gmail_conn_id_123',
//       'GOOGLECALENDAR': 'c9e13275-ed69-4e56-855b-f9399e3e412a',
//       'GOOGLEDRIVE': 'mock_drive_conn_id_123',
//       'NOTION': 'mock_notion_conn_id_123',
//       'GOOGLEDOCS': '8e0f132c-a72b-46a2-951a-8c57b859e532',
//     };
//     return mockConnectedAccountMap[appName] || '';
//   }

//   for (const appName of appNames) {
//     const connectedAccountId = await getConnectedAccountIdForUserAndApp(userId, appName);
    
//     if (!connectedAccountId) {
//       appsNeedingConnection.push(appName);
//       console.warn(`App ${appName} is NOT connected for user ${userId}. Skipping tool collection.`);
//       continue;
//     }

//     // Verify connection status with Composio
//     const connectionStatusResult = await getComposioConnectionStatus(connectedAccountId);
//     console.log(`Connection status for ${appName} (${connectedAccountId}):`, connectionStatusResult.status);
    
//     if (connectionStatusResult.status !== 'INITIATED' && connectionStatusResult.status !== 'ACTIVE') {
//       appsNeedingConnection.push(appName);
//       console.warn(`Composio reports ${appName} connection ${connectedAccountId} is NOT active. Skipping tool collection.`);
//       continue;
//     }

//     connectedAppsData.push({ appName, connectedAccountId });
//     console.log(`App ${appName} is CONNECTED with ID: ${connectedAccountId}`);

//     let toolsToFetchForApp: string[] = [];
//     const hasSpecificTools = toolNames.some(t => t.startsWith(`${appName}_`));

//     if (hasSpecificTools) {
//       // LLM suggested specific tools, filter them for this app
//       toolsToFetchForApp = toolNames.filter(t => t.startsWith(`${appName}_`));
//       console.log(`Fetching specific tools for ${appName}:`, toolsToFetchForApp);
//     } else {
//       // No specific tools suggested, perform semantic search
//       console.log(`No specific tools suggested for ${appName}. Performing semantic search...`);
//       try {
//         const searchToolsApiUrl = new URL('/api/agent/tools/search', req.url).toString();
//         const res = await fetch(searchToolsApiUrl, {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ appName, userQuery, topK: 5 }),
//         });
        
//         if (res.ok) {
//           const pineconeSearchRes = await res.json();
//           toolsToFetchForApp = pineconeSearchRes.relevantTools;
//           console.log(`Semantic search for ${appName} returned:`, toolsToFetchForApp);
//         } else {
//           console.warn(`Semantic search failed for ${appName}:`, res.statusText);
//         }
//       } catch (error) {
//         console.warn(`Semantic search error for ${appName}:`, error);
//       }
//     }

//     if (toolsToFetchForApp.length > 0) {
//       try {
//         const tools = await getComposioTool(toolsToFetchForApp) as ToolSet;
//         fetchedComposioTools = { ...fetchedComposioTools, ...tools };
//         console.log(`Successfully fetched ${Object.keys(tools).length} tools for ${appName}`);
//       } catch (error) {
//         console.error(`Error fetching tools for ${appName}:`, error);
//       }
//     }
//   }

//   console.log(`Total tools prepared: ${Object.keys(fetchedComposioTools).length}`);
//   console.log(`Apps needing connection: ${appsNeedingConnection.length}`);
  
//   return { tools: fetchedComposioTools, requiredConnections: appsNeedingConnection };
// }
