// // src/app/api/chat/route.ts
// import { NextResponse } from "next/server";
// import { generateText, generateObject, ToolSet, CoreMessage } from "ai";
// import { openai } from "@ai-sdk/openai";
// import { z } from "zod";
// import { getModelProvider } from "@/lib/models";

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
// const model = getModelProvider("openai:gpt-4o-mini");
// const model_gemini = getModelProvider("openai:gpt-4o-mini");
// const MAX_AGENT_STEPS = 8;
// const MAX_CONVERSATION_HISTORY = 10;
// const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// // Consolidated schema for single LLM call
// const comprehensiveAnalysisSchema = z.object({
//   // Query Analysis
//   queryAnalysis: z.string(),
//   isQueryClear: z.boolean(),
//   confidenceScore: z.number().min(0).max(1),
//   requiresToolExecution: z.boolean(),

//   // Execution Planning
//   executionSteps: z.array(
//     z.object({
//       stepNumber: z.number(),
//       description: z.string(),
//       requiredData: z.array(z.string()),
//       appName: z.string().optional(),
//       toolCategory: z.string(),
//       dependencies: z.array(z.number()),
//       priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
//     })
//   ),
//   estimatedComplexity: z.enum(["low", "medium", "high"]),
//   requiresSequentialExecution: z.boolean(),

//   // Information Gathering
//   needsInfoGathering: z.boolean(),
//   missingInformation: z.array(z.string()),
//   searchQueries: z.array(z.string()),
//   clarificationNeeded: z.array(z.string()),
//   canProceedWithDefaults: z.boolean(),

//   // Conversation Summary
//   conversationSummary: z.object({
//     currentIntent: z.string(),
//     contextualDetails: z.object({
//       gatheredInformation: z.array(z.string()),
//       missingInformation: z.array(z.string()),
//       userPreferences: z.array(z.string()),
//       previousActions: z.array(z.string()),
//     }),
//     conversationState: z.enum([
//       "information_gathering",
//       "ready_to_execute",
//       "executed",
//       "clarification_needed",
//       "completed",
//     ]),
//     keyEntities: z.array(
//       z.object({
//         type: z.string(),
//         value: z.string(),
//         confidence: z.number().min(0).max(1),
//       })
//     ),
//     nextExpectedAction: z.string(),
//     topicShifts: z.array(z.string()),
//   }),

//   // Tool Selection
//   recommendedApps: z.array(z.string()),
//   toolPriorities: z.array(
//     z.object({
//       appName: z.string(),
//       priority: z.number().min(1).max(10),
//       reasoning: z.string(),
//     })
//   ),
// });

// type ComprehensiveAnalysis = z.infer<typeof comprehensiveAnalysisSchema>;

// interface ChatMessage {
//   role: "user" | "assistant" | "system";
//   content: string;
//   timestamp: number;
//   toolCalls?: { name: string; args: any; result?: any }[];
//   analysis?: ComprehensiveAnalysis;
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
//   analysis?: ComprehensiveAnalysis;
//   error?: string;
// }

// // Enhanced caching system
// class ProductionCacheManager {
//   private toolSearchCache = new Map<
//     string,
//     { tools: string[]; timestamp: number }
//   >();
//   private appRoutingCache = new Map<
//     string,
//     { apps: string[]; timestamp: number }
//   >();
//   private connectionStatusCache = new Map<
//     string,
//     { status: any; timestamp: number }
//   >();
//   private analysisCache = new Map<
//     string,
//     { analysis: ComprehensiveAnalysis; timestamp: number }
//   >();

//   private isExpired(timestamp: number): boolean {
//     return Date.now() - timestamp > CACHE_TTL;
//   }

//   // Tool search caching
//   getCachedToolSearch(appName: string, query: string): string[] | null {
//     const key = `${appName}:${query}`;
//     const cached = this.toolSearchCache.get(key);
//     if (cached && !this.isExpired(cached.timestamp)) {
//       console.log(`[Cache] HIT: Tool search for ${appName}:${query}`);
//       return cached.tools;
//     }
//     console.log(`[Cache] MISS: Tool search for ${appName}:${query}`);
//     return null;
//   }

//   setCachedToolSearch(appName: string, query: string, tools: string[]): void {
//     const key = `${appName}:${query}`;
//     this.toolSearchCache.set(key, { tools, timestamp: Date.now() });
//     console.log(`[Cache] SET: Tool search for ${appName}:${query}`);
//   }

//   // App routing caching
//   getCachedAppRouting(query: string): string[] | null {
//     const cached = this.appRoutingCache.get(query);
//     if (cached && !this.isExpired(cached.timestamp)) {
//       console.log(`[Cache] HIT: App routing for ${query}`);
//       return cached.apps;
//     }
//     console.log(`[Cache] MISS: App routing for ${query}`);
//     return null;
//   }

//   setCachedAppRouting(query: string, apps: string[]): void {
//     this.appRoutingCache.set(query, { apps, timestamp: Date.now() });
//     console.log(`[Cache] SET: App routing for ${query}`);
//   }

//   // Connection status caching
//   getCachedConnectionStatus(connectionId: string): any | null {
//     const cached = this.connectionStatusCache.get(connectionId);
//     if (cached && !this.isExpired(cached.timestamp)) {
//       console.log(`[Cache] HIT: Connection status for ${connectionId}`);
//       return cached.status;
//     }
//     console.log(`[Cache] MISS: Connection status for ${connectionId}`);
//     return null;
//   }

//   setCachedConnectionStatus(connectionId: string, status: any): void {
//     this.connectionStatusCache.set(connectionId, {
//       status,
//       timestamp: Date.now(),
//     });
//     console.log(`[Cache] SET: Connection status for ${connectionId}`);
//   }

//   // Analysis caching
//   getCachedAnalysis(queryHash: string): ComprehensiveAnalysis | null {
//     const cached = this.analysisCache.get(queryHash);
//     if (cached && !this.isExpired(cached.timestamp)) {
//       console.log(`[Cache] HIT: Analysis for hash ${queryHash}`);
//       return cached.analysis;
//     }
//     console.log(`[Cache] MISS: Analysis for hash ${queryHash}`);
//     return null;
//   }

//   setCachedAnalysis(queryHash: string, analysis: ComprehensiveAnalysis): void {
//     this.analysisCache.set(queryHash, { analysis, timestamp: Date.now() });
//     console.log(`[Cache] SET: Analysis for hash ${queryHash}`);
//   }

//   // Cleanup expired entries
//   cleanup(): void {
//     const now = Date.now();
//     let cleanedCount = 0;
//     [
//       this.toolSearchCache,
//       this.appRoutingCache,
//       this.connectionStatusCache,
//       this.analysisCache,
//     ].forEach((cache) => {
//       for (const [key, value] of cache.entries()) {
//         if (now - value.timestamp > CACHE_TTL) {
//           cache.delete(key);
//           cleanedCount++;
//         }
//       }
//     });
//     if (cleanedCount > 0) {
//       console.log(`[Cache] Cleaned up ${cleanedCount} expired entries.`);
//     }
//   }
// }

// // Global cache instance
// const cacheManager = new ProductionCacheManager();

// // Cleanup cache every 10 minutes
// setInterval(() => {
//   cacheManager.cleanup();
// }, 10 * 60 * 1000);

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
//   console.log(`[Conversation] Retrieving history for key: ${key}`);
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
//     const removedCount = history.splice(
//       0,
//       history.length - MAX_CONVERSATION_HISTORY
//     ).length;
//     console.log(
//       `[Conversation] Trimmed history for key ${key}, removed ${removedCount} messages.`
//     );
//   }

//   conversationStore.set(key, history);
//   console.log(
//     `[Conversation] Updated history for key ${key}, current length: ${history.length}`
//   );
// }

// // Performance monitoring singleton
// class PerformanceMonitor {
//   private static instance: PerformanceMonitor;
//   private metrics: Map<string, number[]> = new Map();

//   static getInstance(): PerformanceMonitor {
//     if (!PerformanceMonitor.instance) {
//       PerformanceMonitor.instance = new PerformanceMonitor();
//     }
//     return PerformanceMonitor.instance;
//   }

//   trackOperation(operationName: string, duration: number): void {
//     if (!this.metrics.has(operationName)) {
//       this.metrics.set(operationName, []);
//     }

//     const times = this.metrics.get(operationName)!;
//     times.push(duration);

//     // Keep only last 100 measurements
//     if (times.length > 100) {
//       times.shift();
//     }
//   }

//   getAverageTime(operationName: string): number {
//     const times = this.metrics.get(operationName);
//     if (!times || times.length === 0) return 0;

//     return times.reduce((sum, time) => sum + time, 0) / times.length;
//   }

//   getMetrics(): Record<string, { avg: number; count: number }> {
//     const result: Record<string, { avg: number; count: number }> = {};

//     this.metrics.forEach((times, operation) => {
//       result[operation] = {
//         avg: this.getAverageTime(operation),
//         count: times.length,
//       };
//     });

//     return result;
//   }
// }

// // Optimized single-call analysis service
// class OptimizedAnalysisService {
//   private performanceMonitor = PerformanceMonitor.getInstance();

//   private generateQueryHash(query: string, history: ChatMessage[]): string {
//     const historySnippet = history
//       .slice(-3)
//       .map((m) => m.content.substring(0, 50))
//       .join("|");
//     const hash = `${query}:${historySnippet}`;
//     // A simple hash function for demonstration, in production consider a more robust one
//     return btoa(unescape(encodeURIComponent(hash))); // Base64 encode for simple hashing
//   }

//   async performComprehensiveAnalysis(
//     userQuery: string,
//     conversationHistory: ChatMessage[],
//     currentSummary: any = null
//   ): Promise<ComprehensiveAnalysis> {
//     const startTime = Date.now();

//     // Check cache first
//     const queryHash = this.generateQueryHash(userQuery, conversationHistory);
//     const cached = cacheManager.getCachedAnalysis(queryHash);
//     if (cached) {
//       const duration = Date.now() - startTime;
//       console.log(
//         `[Analysis] Using cached comprehensive analysis. Duration: ${duration}ms`
//       );
//       return cached;
//     }

//     const contextualInfo = conversationHistory
//       .slice(-3)
//       .map((msg) => `${msg.role}: ${msg.content.substring(0, 100)}`)
//       .join("\n");

//     const summaryContext = currentSummary
//       ? `Previous Context: ${JSON.stringify(currentSummary, null, 2)}`
//       : "No previous context available.";

//     const prompt = `You are an advanced AI orchestrator that performs comprehensive query analysis in a single pass. Analyze the user's request holistically and provide all necessary information for execution.

//       ${summaryContext}

//       Recent Conversation Context:
//       ${contextualInfo}

//       Current Query: "${userQuery}"

//       Perform a comprehensive analysis covering:

//       1. **Query Understanding & Confidence**
//         - Analyze what the user is asking for
//         - Determine clarity and actionability
//         - Assign confidence score (0-1)
//         - Identify if tools are needed

//       2. **Execution Planning**
//         - Break down into logical steps
//         - Identify dependencies and priorities
//         - Determine if sequential execution is needed
//         - Estimate complexity level

//       3. **Information Gathering**
//         - Identify missing information
//         - Generate search queries if needed
//         - Determine clarification requirements
//         - Assess if defaults can be used

//       4. **Conversation Summary Update**
//         - Update current intent and state
//         - Track gathered and missing information
//         - Identify key entities and preferences
//         - Determine next expected action

//       5. **Tool & App Recommendations**
//         - Recommend relevant apps for execution
//         - Prioritize tools based on query requirements
//         - Provide reasoning for each recommendation

//       Provide a complete analysis that enables efficient execution without additional LLM calls.`;

//     try {
//       console.log("[Analysis] Calling LLM for comprehensive analysis...");
//       const { object } = await generateObject({
//         // model: openai(AGENT_LLM_MODEL),
//         model: model_gemini,
//         system:
//           "You are a comprehensive analysis assistant that provides complete query analysis in a single pass.",
//         prompt: prompt,
//         schema: comprehensiveAnalysisSchema,
//         temperature: 0.1,
//         maxTokens: 2000,
//       });

//       // Cache the result
//       cacheManager.setCachedAnalysis(queryHash, object);

//       const duration = Date.now() - startTime;
//       console.log(
//         `[Analysis] Comprehensive analysis completed for query "${userQuery}" in ${duration}ms:`,
//         {
//           duration,
//           confidence: object.confidenceScore,
//           steps: object.executionSteps.length,
//           apps: object.recommendedApps,
//           needsTools: object.requiresToolExecution,
//         }
//       );
//       console.log(
//         `[Analysis] Full analysis object: ${JSON.stringify(object, null, 2)}`
//       );

//       return object;
//     } catch (error) {
//       const duration = Date.now() - startTime;
//       console.error(
//         `[Analysis] Error in comprehensive analysis after ${duration}ms:`,
//         error
//       );
//       // Return minimal fallback
//       return {
//         queryAnalysis: "Basic query analysis - fallback due to error",
//         isQueryClear: true,
//         confidenceScore: 0.1, // Lower confidence on error
//         requiresToolExecution: false,
//         executionSteps: [
//           {
//             stepNumber: 1,
//             description: "Handle user query conversationally (fallback)",
//             requiredData: [],
//             toolCategory: "general",
//             dependencies: [],
//             priority: "medium" as const,
//           },
//         ],
//         estimatedComplexity: "low" as const,
//         requiresSequentialExecution: false,
//         needsInfoGathering: false,
//         missingInformation: [],
//         searchQueries: [],
//         clarificationNeeded: [],
//         canProceedWithDefaults: true,
//         conversationSummary: {
//           currentIntent: "User interaction (fallback)",
//           contextualDetails: {
//             gatheredInformation: [],
//             missingInformation: [],
//             userPreferences: [],
//             previousActions: [],
//           },
//           conversationState: "information_gathering",
//           keyEntities: [],
//           nextExpectedAction: "Continue conversation (fallback)",
//           topicShifts: [],
//         },
//         recommendedApps: [],
//         toolPriorities: [],
//       };
//     }
//   }
// }

// // Optimized tool preparation service
// class OptimizedToolService {
//   async prepareToolsForExecution(
//     analysis: ComprehensiveAnalysis,
//     userQuery: string,
//     userId: string,
//     req: Request,
//     // Add toolNames from the initial routing response
//     initialToolNames: string[]
//   ): Promise<{ tools: ToolSet; requiredConnections: string[] }> {
//     const { recommendedApps, toolPriorities } = analysis;

//     console.log(
//       `[Tools] Starting tool preparation. Recommended Apps from Analysis: ${JSON.stringify(
//         recommendedApps
//       )}. Initial Tool Names from Routing: ${JSON.stringify(initialToolNames)}`
//     );

//     if (recommendedApps.length === 0) {
//       console.log(
//         "[Tools] No recommended apps from analysis. Returning empty tools."
//       );
//       return { tools: {}, requiredConnections: [] };
//     }

//     // Get app routing with caching
//     let appNames = cacheManager.getCachedAppRouting(userQuery);
//     if (!appNames) {
//       try {
//         console.log("[Tools] Fetching app routing from API...");
//         const routeAppsApiUrl = new URL(
//           "/api/agent/route-apps",
//           req.url
//         ).toString();
//         const routingRes = await fetch(routeAppsApiUrl, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ userQuery }),
//         });

//         if (routingRes.ok) {
//           const { appNames: routedApps } =
//             (await routingRes.json()) as LLMRoutingResponse;
//           appNames = routedApps;
//           cacheManager.setCachedAppRouting(userQuery, appNames);
//           console.log(
//             `[Tools] App routing API returned: ${JSON.stringify(appNames)}`
//           );
//         } else {
//           console.warn(
//             `[Tools] App routing API failed (${routingRes.status}). Falling back to analysis recommendations.`
//           );
//           appNames = recommendedApps; // Fallback to analysis recommendations
//         }
//       } catch (error) {
//         console.warn(
//           "[Tools] App routing fetch error, using analysis recommendations:",
//           error
//         );
//         appNames = recommendedApps;
//       }
//     } else {
//       console.log(
//         `[Tools] Using cached app routing: ${JSON.stringify(appNames)}`
//       );
//     }

//     // Prioritize apps based on analysis
//     const prioritizedApps = appNames
//       .map((app) => ({
//         name: app,
//         priority: toolPriorities.find((p) => p.appName === app)?.priority || 5,
//       }))
//       .sort((a, b) => b.priority - a.priority)
//       .slice(0, 3) // Limit to top 3 apps for performance
//       .map((app) => app.name);
//     console.log(
//       `[Tools] Prioritized apps for execution (top 3): ${JSON.stringify(
//         prioritizedApps
//       )}`
//     );

//     let fetchedComposioTools: ToolSet = {};
//     const appsNeedingConnection: string[] = [];

//     // Process apps in parallel for better performance
//     const toolPromises = prioritizedApps.map(async (appName) => {
//       console.log(`[Tools] Processing app: ${appName}`);
//       const connectedAccountId = await this.getConnectedAccountIdForUserAndApp(
//         userId,
//         appName
//       );

//       if (!connectedAccountId) {
//         appsNeedingConnection.push(appName);
//         console.warn(
//           `[Tools] App ${appName} is NOT connected for user ${userId}.`
//         );
//         return null;
//       }
//       console.log(
//         `[Tools] App ${appName} has connected account ID: ${connectedAccountId}`
//       );

//       // Check connection status with caching
//       let connectionStatus =
//         cacheManager.getCachedConnectionStatus(connectedAccountId);
//       if (!connectionStatus) {
//         console.log(
//           `[Tools] Fetching connection status for ${appName} (${connectedAccountId})...`
//         );
//         connectionStatus = await getComposioConnectionStatus(
//           connectedAccountId
//         );
//         cacheManager.setCachedConnectionStatus(
//           connectedAccountId,
//           connectionStatus
//         );
//         console.log(
//           `[Tools] Connection status for ${appName}: ${JSON.stringify(
//             connectionStatus.status
//           )}`
//         );
//       } else {
//         console.log(
//           `[Tools] Using cached connection status for ${appName}: ${JSON.stringify(
//             connectionStatus.status
//           )}`
//         );
//       }

//       if (
//         connectionStatus.status !== "INITIATED" &&
//         connectionStatus.status !== "ACTIVE"
//       ) {
//         appsNeedingConnection.push(appName);
//         console.warn(
//           `[Tools] Composio reports ${appName} connection ${connectedAccountId} is NOT active/initiated. Skipping tool collection.`
//         );
//         return null;
//       }
//       console.log(`[Tools] App ${appName} connection is ACTIVE.`);

//       // --- START: Prioritize initialToolNames for fetching tools ---
//       let toolsToFetchForApp: string[] = [];
//       const specificToolsFromRouting = initialToolNames.filter((t) =>
//         t.startsWith(`${appName}_`)
//       );

//       if (specificToolsFromRouting.length > 0) {
//         toolsToFetchForApp = specificToolsFromRouting;
//         console.log(
//           `[Tools] Using specific tool names from initial routing for ${appName}: ${JSON.stringify(
//             toolsToFetchForApp
//           )}`
//         );
//       } else {
//         // Fallback to semantic search if no specific tools were identified by initial routing
//         let relevantTools = cacheManager.getCachedToolSearch(
//           appName,
//           userQuery
//         );
//         if (!relevantTools) {
//           try {
//             console.log(
//               `[Tools] Performing semantic search for tools in ${appName} with query: "${userQuery}"`
//             );
//             const searchToolsApiUrl = new URL(
//               "/api/agent/tools/search",
//               req.url
//             ).toString();
//             const res = await fetch(searchToolsApiUrl, {
//               method: "POST",
//               headers: { "Content-Type": "application/json" },
//               body: JSON.stringify({ appName, userQuery, topK: 5 }),
//             });

//             if (res.ok) {
//               const pineconeSearchRes = await res.json();
//               relevantTools = pineconeSearchRes.relevantTools || [];
//               cacheManager.setCachedToolSearch(
//                 appName,
//                 userQuery,
//                 relevantTools ?? []
//               );
//               console.log(
//                 `[Tools] Semantic search for ${appName} returned: ${JSON.stringify(
//                   relevantTools
//                 )}`
//               );
//             } else {
//               console.warn(
//                 `[Tools] Semantic search failed for ${appName} (${res.status}).`
//               );
//               relevantTools = [];
//             }
//           } catch (error) {
//             console.warn(
//               `[Tools] Semantic search error for ${appName}:`,
//               error
//             );
//             relevantTools = [];
//           }
//         } else {
//           console.log(
//             `[Tools] Using cached relevant tools for ${appName}: ${JSON.stringify(
//               relevantTools
//             )}`
//           );
//         }
//         toolsToFetchForApp = relevantTools ?? [];
//       }
//       // --- END: Prioritize initialToolNames for fetching tools ---

//       if (toolsToFetchForApp.length > 0) {
//         try {
//           console.log(
//             `[Tools] Fetching full tool definitions for ${appName}: ${JSON.stringify(
//               toolsToFetchForApp
//             )}`
//           );
//           const tools = (await getComposioTool(toolsToFetchForApp)) as ToolSet;
//           console.log(
//             `[Tools] Fetched ${Object.keys(tools).length} tools for ${appName}.`
//           );
//           return { appName, tools };
//         } catch (error) {
//           console.error(
//             `[Tools] Error fetching full tool definitions for ${appName}:`,
//             error
//           );
//           return null;
//         }
//       }

//       console.log(`[Tools] No relevant tools found or fetched for ${appName}.`);
//       return null;
//     });

//     // Wait for all tool fetching to complete
//     const toolResults = await Promise.allSettled(toolPromises);

//     toolResults.forEach((result) => {
//       if (result.status === "fulfilled" && result.value) {
//         fetchedComposioTools = {
//           ...fetchedComposioTools,
//           ...result.value.tools,
//         };
//       }
//     });

//     console.log(
//       `[Tools] Total tools prepared for LLM: ${
//         Object.keys(fetchedComposioTools).length
//       }`
//     );
//     console.log(
//       `[Tools] Apps requiring connection: ${JSON.stringify(
//         appsNeedingConnection
//       )}`
//     );

//     return {
//       tools: fetchedComposioTools,
//       requiredConnections: appsNeedingConnection,
//     };
//   }

//   private async getConnectedAccountIdForUserAndApp(
//     userId: string,
//     appName: string
//   ): Promise<string> {
//     // Mock implementation - replace with your actual logic
//     const mockConnectedAccountMap: { [key: string]: string } = {
//       GMAIL: "mock_gmail_conn_id_123",
//       GOOGLECALENDAR: "c9e13275-ed69-4e56-855b-f9399e3e412a", // Example: A real ID for testing
//       GOOGLEDRIVE: "mock_drive_conn_id_123",
//       NOTION: "mock_notion_conn_id_123",
//       GOOGLEDOCS: "8e0f132c-a72b-46a2-951a-8c57b859e532", // Example: A real ID for testing
//     };
//     const accountId = mockConnectedAccountMap[appName];
//     console.log(
//       `[Mock Connection] getConnectedAccountIdForUserAndApp for ${appName}: ${
//         accountId ? "Found" : "Not Found"
//       }`
//     );
//     return accountId || "";
//   }
// }

// // Optimized execution context
// class OptimizedExecutionContext {
//   private stepResults: Map<number, any> = new Map();
//   private executionLog: string[] = [];

//   addStepResult(stepNumber: number, result: any): void {
//     this.stepResults.set(stepNumber, result);
//     this.executionLog.push(
//       `Step ${stepNumber}: ${this.truncateResult(result)}`
//     );
//     console.log(
//       `[Execution Context] Added step ${stepNumber} result: ${this.truncateResult(
//         result
//       )}`
//     );
//   }

//   private truncateResult(result: any): string {
//     if (typeof result === "string") {
//       return result.length > 100 ? result.substring(0, 100) + "..." : result;
//     }
//     try {
//       const jsonString = JSON.stringify(result);
//       return jsonString.length > 100
//         ? jsonString.substring(0, 100) + "..."
//         : jsonString;
//     } catch (e) {
//       return "[Unstringifiable Object]";
//     }
//   }

//   getStepResult(stepNumber: number): any {
//     const result = this.stepResults.get(stepNumber);
//     console.log(
//       `[Execution Context] Retrieved step ${stepNumber} result: ${this.truncateResult(
//         result
//       )}`
//     );
//     return result;
//   }

//   getExecutionSummary(): string {
//     const summary = this.executionLog.join(" → ");
//     console.log(`[Execution Context] Full execution summary: ${summary}`);
//     return summary;
//   }

//   enrichParametersWithContext(parameters: any): any {
//     if (!parameters || typeof parameters !== "object") {
//       return parameters;
//     }

//     const enriched = { ...parameters };
//     let changed = false;
//     for (const [key, value] of Object.entries(enriched)) {
//       if (typeof value === "string" && value.startsWith("$step_")) {
//         const stepNumber = parseInt(value.substring(6));
//         const stepResult = this.getStepResult(stepNumber);
//         if (stepResult !== undefined) {
//           // Check for undefined, not just truthy
//           enriched[key] = stepResult;
//           changed = true;
//           console.log(
//             `[Execution Context] Enriched parameter '${key}' with result from step ${stepNumber}.`
//           );
//         } else {
//           console.warn(
//             `[Execution Context] Could not enrich parameter '${key}': Step ${stepNumber} result not found.`
//           );
//         }
//       }
//     }
//     if (changed) {
//       console.log(
//         `[Execution Context] Parameters enriched. Original: ${JSON.stringify(
//           parameters
//         )}, Enriched: ${JSON.stringify(enriched)}`
//       );
//     } else {
//       console.log(`[Execution Context] No parameters needed enrichment.`);
//     }
//     return enriched;
//   }
// }

// // Optimized prompt builder
// function buildOptimizedPrompt(
//   userQuery: string,
//   analysis: ComprehensiveAnalysis,
//   conversationHistory: ChatMessage[],
//   hasTools: boolean
// ): string {
//   const currentDate = new Date().toISOString().split("T")[0];
//   const { conversationSummary, executionSteps, confidenceScore } = analysis;

//   let prompt = `You are an advanced AI assistant optimized for efficient execution. Your primary goal is to accurately complete tasks and report their outcomes.

// **Context Summary:**
// - Date: ${currentDate}
// - Query Confidence: ${confidenceScore.toFixed(2)}
// - Current Intent: ${conversationSummary.currentIntent}
// - Conversation State: ${conversationSummary.conversationState}
// - Tools Available: ${hasTools ? "Yes" : "No"}

// **Execution Plan (${executionSteps.length} steps):**
// ${executionSteps
//   .map((step, i) => `${i + 1}. ${step.description} (${step.priority})`)
//   .join("\n")}

// **Key Context:**
// - Gathered: ${
//     conversationSummary.contextualDetails.gatheredInformation.join(", ") ||
//     "None"
//   }
// - Missing: ${
//     conversationSummary.contextualDetails.missingInformation.join(", ") ||
//     "None"
//   }
// - Entities: ${
//     conversationSummary.keyEntities
//       .map((e) => `${e.type}:${e.value}`)
//       .join(", ") || "None"
//   }`;

//   if (conversationHistory.length > 0) {
//     prompt += `\n\n**Recent History:**\n${conversationHistory
//       .slice(-2)
//       .map(
//         (msg) =>
//           `${msg.role}: ${msg.content.substring(0, 100)}${
//             msg.content.length > 100 ? "..." : ""
//           }`
//       )
//       .join("\n")}`;
//   }

//   prompt += `\n\n**Current Query:** "${userQuery}"`;

//   if (hasTools) {
//     prompt += `\n\n**Tool Execution Strategy:**
// - Execute steps systematically.
// - Use context from previous steps.
// - Provide clear progress updates.
// - **Crucially, accurately report the success or failure of each tool execution.** If a tool fails, state what failed and why, and suggest next steps.`;
//   }

//   prompt += `\n\n**Next Action:** ${conversationSummary.nextExpectedAction}`;

//   console.log(
//     `[Prompt Builder] Generated prompt (truncated): ${prompt.substring(
//       0,
//       500
//     )}...`
//   );
//   return prompt;
// }

// // Main API handler
// export async function POST(req: Request) {
//   const startTime = Date.now();

//   try {
//     const body = await req.json();
//     console.log(
//       `[API] Received raw request body: ${JSON.stringify(body).substring(
//         0,
//         200
//       )}...`
//     );
//     const { userQuery, userId, conversationHistory, sessionId } =
//       body.body || body;

//     // Input validation
//     if (!userQuery?.trim() || !userId?.trim()) {
//       console.error("[API] Validation Error: Missing userQuery or userId.");
//       return NextResponse.json(
//         {
//           response: "Missing userQuery or userId in request body.",
//           error: "INVALID_REQUEST",
//         },
//         { status: 400 }
//       );
//     }

//     console.log(
//       `🚀 Production Chat Request - User: ${userId}, Query: "${userQuery}", Session: ${
//         sessionId || "N/A"
//       }`
//     );

//     // Initialize services
//     console.log("[API] Initializing Pinecone index...");
//     await initializePineconeIndex();
//     const analysisService = new OptimizedAnalysisService();
//     const toolService = new OptimizedToolService();
//     const executionContext = new OptimizedExecutionContext(); // Instance of the context manager

//     // Get conversation history
//     const existingHistory =
//       conversationHistory || getConversationHistory(userId, sessionId);
//     const lastSummary =
//       existingHistory.length > 0
//         ? existingHistory[existingHistory.length - 1]?.analysis
//             ?.conversationSummary
//         : null;
//     console.log(
//       `[API] Existing conversation history length: ${existingHistory.length}`
//     );
//     if (lastSummary) {
//       console.log(
//         `[API] Last conversation summary intent: ${lastSummary.currentIntent}`
//       );
//     }

//     // Phase 1: Single comprehensive analysis (replaces 3 separate LLM calls)
//     console.log("📊 Phase 1: Comprehensive Analysis");
//     const analysis = await analysisService.performComprehensiveAnalysis(
//       userQuery,
//       existingHistory,
//       lastSummary
//     );

//     let finalResponseText: string;
//     let finalExecutedTools: any[] = [];
//     let finalRequiredConnections: string[] = [];

//     // Phase 2: Route based on confidence and requirements
//     if (analysis.confidenceScore >= 0.8 && analysis.requiresToolExecution) {
//       console.log("🔧 Phase 2: High-confidence tool execution path.");

//       // Initial app routing to get toolNames
//       let initialToolNames: string[] = [];
//       try {
//         const routeAppsApiUrl = new URL(
//           "/api/agent/route-apps",
//           req.url
//         ).toString();
//         const routingRes = await fetch(routeAppsApiUrl, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ userQuery }),
//         });
//         if (routingRes.ok) {
//           const { toolNames } = (await routingRes.json()) as LLMRoutingResponse;
//           initialToolNames = toolNames;
//           console.log(
//             `[API] Initial routing identified specific tool names: ${JSON.stringify(
//               initialToolNames
//             )}`
//           );
//         } else {
//           console.warn(
//             `[API] Initial routing API failed (${routingRes.status}). Proceeding without specific tool names from routing.`
//           );
//         }
//       } catch (error) {
//         console.warn(
//           `[API] Error during initial routing for tool names:`,
//           error
//         );
//       }

//       // Prepare tools optimally, passing initialToolNames
//       const toolResult = await toolService.prepareToolsForExecution(
//         analysis,
//         userQuery,
//         userId,
//         req,
//         initialToolNames // Pass the toolNames from initial routing
//       );

//       const hasTools = Object.keys(toolResult.tools).length > 0;
//       finalRequiredConnections = toolResult.requiredConnections;
//       console.log(
//         `[API] Tools prepared. Has tools: ${hasTools}. Required connections: ${JSON.stringify(
//           finalRequiredConnections
//         )}`
//       );

//       if (hasTools) {
//         // Execute with tools
//         const optimizedPrompt = buildOptimizedPrompt(
//           userQuery,
//           analysis,
//           existingHistory,
//           true
//         );
//         console.log("[API] Calling generateText with tools...");

//         const executionResult = await generateText({
//           // model: openai(AGENT_LLM_MODEL),
//           model: model,
//           prompt: optimizedPrompt,
//           tools: toolResult.tools,
//           toolChoice: "auto",
//           temperature: 0.3,
//           maxSteps: MAX_AGENT_STEPS,
//           maxTokens: 3000,
//         });

//         finalExecutedTools = executionResult.toolCalls || [];
//         console.log(
//           `[API] generateText returned ${finalExecutedTools.length} tool calls.`
//         );

//         let hadToolFailure = false;
//         let failedToolNames: string[] = [];
//         let toolExecutionDetails: string[] = [];

//         // Check the results of each tool call
//         if (finalExecutedTools.length > 0) {
//           for (const toolCall of finalExecutedTools) {
//             console.log(
//               `[Tool Execution] Tool: ${
//                 toolCall.toolName
//               }, Args: ${JSON.stringify(
//                 toolCall.args
//               )}, Result: ${JSON.stringify(toolCall.result)}`
//             );
//             // Assuming toolCall.result is populated by the AI SDK with the outcome
//             // and that a failed tool execution would have an 'error' property or similar
//             if (
//               toolCall.result &&
//               typeof toolCall.result === "object" &&
//               "error" in toolCall.result
//             ) {
//               console.error(
//                 `[Tool Execution] FAILURE for ${toolCall.toolName}:`,
//                 toolCall.result.error
//               );
//               hadToolFailure = true;
//               failedToolNames.push(toolCall.toolName);
//               toolExecutionDetails.push(
//                 `${toolCall.toolName} failed: ${toolCall.result.error}`
//               );
//             } else if (
//               toolCall.result &&
//               typeof toolCall.result === "object" &&
//               "success" in toolCall.result &&
//               toolCall.result.success === false
//             ) {
//               // Another common pattern for reporting failure
//               console.error(
//                 `[Tool Execution] FAILURE for ${toolCall.toolName}: Success property is false.`
//               );
//               hadToolFailure = true;
//               failedToolNames.push(toolCall.toolName);
//               toolExecutionDetails.push(`${toolCall.toolName} failed.`);
//             } else {
//               console.log(`[Tool Execution] SUCCESS for ${toolCall.toolName}.`);
//               toolExecutionDetails.push(`${toolCall.toolName} succeeded.`);
//             }
//             // Add result to execution context for potential future steps (though not used in this simplified flow)
//             executionContext.addStepResult(
//               toolCall.toolCallId,
//               toolCall.result
//             );
//           }
//         }

//         if (hadToolFailure) {
//           finalResponseText = `I attempted to complete your request, but encountered issues with the following actions: ${failedToolNames.join(
//             ", "
//           )}. Details: ${toolExecutionDetails.join(
//             "; "
//           )}. Please check the details for each action. I might need more information or the connection might be problematic.`;
//           console.warn(
//             `[API] Final response indicates tool failure: ${finalResponseText}`
//           );
//         } else {
//           finalResponseText =
//             executionResult.text ||
//             "Task completed successfully using specialized tools.";
//           console.log(
//             `[API] Final response indicates successful tool execution: ${finalResponseText}`
//           );
//         }
//       } else {
//         finalResponseText =
//           finalRequiredConnections.length > 0
//             ? `I need access to ${finalRequiredConnections.join(
//                 ", "
//               )} to help with this request. Please connect these apps first.`
//             : "I understand your request but don't have access to the required tools at the moment.";
//         console.log(
//           `[API] No tools available or connected. Response: ${finalResponseText}`
//         );
//       }
//     } else if (analysis.confidenceScore >= 0.4) {
//       console.log("❓ Phase 2: Medium-confidence clarification path.");

//       if (analysis.clarificationNeeded.length > 0) {
//         finalResponseText = `I need clarification on:\n\n${analysis.clarificationNeeded
//           .map((item, idx) => `${idx + 1}. ${item}`)
//           .join("\n")}\n\nPlease provide these details.`;
//         console.log(`[API] Clarification needed: ${finalResponseText}`);
//       } else {
//         finalResponseText = `I understand you're asking about "${userQuery}". Let me help you with that based on my understanding.`;
//         console.log(
//           `[API] Proceeding with general understanding for medium confidence query.`
//         );

//         // Simple execution without tools
//         const simplePrompt = buildOptimizedPrompt(
//           userQuery,
//           analysis,
//           existingHistory,
//           false
//         );
//         const simpleResult = await generateText({
//           // model: openai(AGENT_LLM_MODEL),
//           model: model,
//           prompt: simplePrompt,
//           temperature: 0.4,
//           maxTokens: 1500,
//         });

//         finalResponseText = simpleResult.text || finalResponseText;
//         console.log(
//           `[API] Conversational response for medium confidence: ${finalResponseText.substring(
//             0,
//             100
//           )}...`
//         );
//       }
//     } else {
//       console.log("💬 Phase 2: Low-confidence conversational response path.");

//       const conversationalPrompt = `You are a helpful AI assistant.

// User Query: "${userQuery}"
// Context: ${analysis.conversationSummary.currentIntent}

// Provide a helpful, conversational response. If unclear, ask for clarification politely.`;

//       const conversationalResult = await generateText({
//         // model: openai(AGENT_LLM_MODEL),
//         model: model,
//         prompt: conversationalPrompt,
//         temperature: 0.5,
//         maxTokens: 1000,
//       });

//       finalResponseText =
//         conversationalResult.text ||
//         "I'm here to help! Could you provide more details about what you need?";
//       console.log(
//         `[API] Conversational response for low confidence: ${finalResponseText.substring(
//           0,
//           100
//         )}...`
//       );
//     }

//     // Phase 3: Update conversation history
//     console.log("[API] Updating conversation history.");
//     const userMessage: ChatMessage = {
//       role: "user",
//       content: userQuery,
//       timestamp: Date.now(),
//     };

//     const assistantMessage: ChatMessage = {
//       role: "assistant",
//       content: finalResponseText,
//       timestamp: Date.now(),
//       toolCalls: finalExecutedTools.map((tool) => ({
//         name: tool.toolName,
//         args: tool.args,
//         toolCallId: tool.toolCallId,
//         result: tool.result, // Include the tool result in the history message
//       })),
//       analysis,
//     };

//     updateConversationHistory(userId, userMessage, sessionId);
//     updateConversationHistory(userId, assistantMessage, sessionId);

//     // Prepare response
//     const response: ChatResponse = {
//       response: finalResponseText,
//       executedTools: finalExecutedTools.map((tool, idx) => ({
//         name: tool.toolName,
//         args: tool.args,
//         toolCallId: tool.toolCallId,
//         stepNumber: idx + 1,
//         result: tool.result, // Include the tool result in the final response
//       })),
//       requiredConnections:
//         finalRequiredConnections.length > 0
//           ? finalRequiredConnections
//           : undefined,
//       conversationHistory: getConversationHistory(userId, sessionId),
//       analysis,
//     };

//     const processingTime = Date.now() - startTime;
//     console.log(
//       `✅ Request completed in ${processingTime}ms. Final Response: ${JSON.stringify(
//         response
//       ).substring(0, 500)}...`
//     );

//     return NextResponse.json(response);
//   } catch (error: any) {
//     const processingTime = Date.now() - startTime;
//     console.error(`❌ API Error after ${processingTime}ms:`, error);

//     return NextResponse.json(
//       {
//         response:
//           "I encountered an error while processing your request. Please try again.",
//         error: error.message,
//       },
//       { status: 500 }
//     );
//   }
// }

// // **OPTIMIZATION 2: Redis Cache Manager**
// // class RedisCache {
// //   private redis: Redis;
// //   private static instance: RedisCache;

// //   private constructor() {
// //     this.redis = new Redis({
// //       host: process.env.REDIS_HOST || 'localhost',
// //       port: parseInt(process.env.REDIS_PORT || '6379', 10), // Specify radix for parseInt
// //       retryStrategy: (times) => { // Enhanced retry strategy
// //         const delay = Math.min(times * 50, 2000); // Exponential backoff, max 2 seconds
// //         return delay;
// //       },
// //       maxRetriesPerRequest: 2,
// //       lazyConnect: true,
// //       keepAlive: 30000,
// //     });

// //     this.redis.on('error', (err) => {
// //       console.error('[Redis] Connection Error:', err);
// //     });
// //     this.redis.on('connect', () => {
// //       console.log('[Redis] Connected successfully');
// //     });
// //   }

// //   static getInstance(): RedisCache {
// //     if (!RedisCache.instance) {
// //       RedisCache.instance = new RedisCache();
// //     }
// //     return RedisCache.instance;
// //   }

// //   async get<T>(key: string): Promise<T | null> {
// //     try {
// //       // Ensure connection is ready before command
// //       // await this.redis.connect();
// //       const value = await this.redis.get(key);
// //       return value ? JSON.parse(value) : null;
// //     } catch (error) {
// //       console.warn(`[Redis] GET error for key ${key}:`, error);
// //       return null;
// //     }
// //   }

// //   async set(key: string, value: any, ttlSeconds: number = CACHE_TTL): Promise<void> {
// //     try {
// //       // await this.redis.connect();
// //       await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
// //     } catch (error) {
// //       console.warn(`[Redis] SET error for key ${key}:`, error);
// //     }
// //   }

// //   async mget<T>(keys: string[]): Promise<(T | null)[]> {
// //     if (keys.length === 0) return [];
// //     try {
// //       // await this.redis.connect();
// //       const values = await this.redis.mget(...keys);
// //       return values.map(v => v ? JSON.parse(v) : null);
// //     } catch (error) {
// //       console.warn(`[Redis] MGET error:`, error);
// //       return new Array(keys.length).fill(null);
// //     }
// //   }

// //   async mset(keyValuePairs: { key: string; value: any; ttl?: number }[]): Promise<void> {
// //     if (keyValuePairs.length === 0) return;
// //     try {
// //       // await this.redis.connect();
// //       const pipeline = this.redis.pipeline();
// //       keyValuePairs.forEach(({ key, value, ttl = CACHE_TTL }) => {
// //         pipeline.setex(key, ttl, JSON.stringify(value));
// //       });
// //       await pipeline.exec();
// //     } catch (error) {
// //       console.warn(`[Redis] MSET error:`, error);
// //     }
// //   }
// // }




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
