// src/app/api/chat/route.ts
import { NextResponse } from "next/server";
import { generateText, generateObject, ToolSet, CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { getModelProvider } from "@/lib/models";
import Redis from "ioredis";

// Your existing services/utils
import {
  initializePineconeIndex,
  getComposioAppToolsFromPinecone,
} from "@/lib/pineconeInit";
import { LLMRoutingResponse } from "@/services/llm_app_router_service";
import {
  getComposioAppTools,
  getComposioTool,
  getComposioConnectionStatus,
  executeComposioAction,
  enableComposioConnection,
} from "@/lib/agent-backend/composioService";
import { ComposioToolSet } from "composio-core";

const AGENT_LLM_MODEL = "gpt-4o-mini";
const model = getModelProvider("openai:gpt-4o-mini");
const model_gemini = getModelProvider("openai:gpt-4o-mini");
const MAX_AGENT_STEPS = 8;
const MAX_CONVERSATION_HISTORY = 10;
const CACHE_TTL = 300; // 5 minutes in seconds for Redis

// Consolidated schema for single LLM call
const comprehensiveAnalysisSchema = z.object({
  // Query Analysis
  queryAnalysis: z.string(),
  isQueryClear: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  requiresToolExecution: z.boolean(),

  // Execution Planning
  executionSteps: z.array(
    z.object({
      stepNumber: z.number(),
      description: z.string(),
      requiredData: z.array(z.string()),
      appName: z.string().optional(),
      toolCategory: z.string(),
      dependencies: z.array(z.number()),
      priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
    })
  ),
  estimatedComplexity: z.enum(["low", "medium", "high"]),
  requiresSequentialExecution: z.boolean(),

  // Information Gathering
  needsInfoGathering: z.boolean(),
  missingInformation: z.array(z.string()),
  searchQueries: z.array(z.string()),
  clarificationNeeded: z.array(z.string()),
  canProceedWithDefaults: z.boolean(),

  // Conversation Summary
  conversationSummary: z.object({
    currentIntent: z.string(),
    contextualDetails: z.object({
      gatheredInformation: z.array(z.string()),
      missingInformation: z.array(z.string()),
      userPreferences: z.array(z.string()),
      previousActions: z.array(z.string()),
    }),
    conversationState: z.enum([
      "information_gathering",
      "ready_to_execute",
      "executed",
      "clarification_needed",
      "completed",
    ]),
    keyEntities: z.array(
      z.object({
        type: z.string(),
        value: z.string(),
        confidence: z.number().min(0).max(1),
      })
    ),
    nextExpectedAction: z.string(),
    topicShifts: z.array(z.string()),
  }),

  // Tool Selection
  recommendedApps: z.array(z.string()),
  toolPriorities: z.array(
    z.object({
      appName: z.string(),
      priority: z.number().min(1).max(10),
      reasoning: z.string(),
    })
  ),
});

type ComprehensiveAnalysis = z.infer<typeof comprehensiveAnalysisSchema>;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCalls?: { name: string; args: any; result?: any }[];
  analysis?: ComprehensiveAnalysis;
}

interface ChatRequestBody {
  userQuery: string;
  userId: string;
  conversationHistory?: ChatMessage[];
  sessionId?: string;
}

interface ChatResponse {
  response: string;
  executedTools?: {
    name: string;
    args: any;
    result?: any;
    stepNumber?: number;
  }[];
  requiredConnections?: string[];
  conversationHistory?: ChatMessage[];
  analysis?: ComprehensiveAnalysis;
  error?: string;
}

// Redis-based caching system
class RedisCache {
  private redis: Redis;
  private static instance: RedisCache;

  private constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      keepAlive: 30000,
    });

    this.redis.on('error', (err) => {
      console.error('[Redis] Connection Error:', err);
    });
    this.redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });
  }

  static getInstance(): RedisCache {
    if (!RedisCache.instance) {
      RedisCache.instance = new RedisCache();
    }
    return RedisCache.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn(`[Redis] GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = CACHE_TTL): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.warn(`[Redis] SET error for key ${key}:`, error);
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    try {
      const values = await this.redis.mget(...keys);
      return values.map(v => v ? JSON.parse(v) : null);
    } catch (error) {
      console.warn(`[Redis] MGET error:`, error);
      return new Array(keys.length).fill(null);
    }
  }

  async mset(keyValuePairs: { key: string; value: any; ttl?: number }[]): Promise<void> {
    if (keyValuePairs.length === 0) return;
    try {
      const pipeline = this.redis.pipeline();
      keyValuePairs.forEach(({ key, value, ttl = CACHE_TTL }) => {
        pipeline.setex(key, ttl, JSON.stringify(value));
      });
      await pipeline.exec();
    } catch (error) {
      console.warn(`[Redis] MSET error:`, error);
    }
  }
}

// Enhanced Redis-based caching system
class RedisCacheManager {
  private redisCache: RedisCache;

  constructor() {
    this.redisCache = RedisCache.getInstance();
  }

  // Tool search caching
  async getCachedToolSearch(appName: string, query: string): Promise<string[] | null> {
    const key = `tool_search:${appName}:${this.hashString(query)}`;
    const cached = await this.redisCache.get<string[]>(key);
    if (cached) {
      console.log(`[Cache] HIT: Tool search for ${appName}:${query}`);
      return cached;
    }
    console.log(`[Cache] MISS: Tool search for ${appName}:${query}`);
    return null;
  }

  async setCachedToolSearch(appName: string, query: string, tools: string[]): Promise<void> {
    const key = `tool_search:${appName}:${this.hashString(query)}`;
    await this.redisCache.set(key, tools);
    console.log(`[Cache] SET: Tool search for ${appName}:${query}`);
  }

  // App routing caching
  async getCachedAppRouting(query: string): Promise<string[] | null> {
    const key = `app_routing:${this.hashString(query)}`;
    const cached = await this.redisCache.get<string[]>(key);
    if (cached) {
      console.log(`[Cache] HIT: App routing for ${query}`);
      return cached;
    }
    console.log(`[Cache] MISS: App routing for ${query}`);
    return null;
  }

  async setCachedAppRouting(query: string, apps: string[]): Promise<void> {
    const key = `app_routing:${this.hashString(query)}`;
    await this.redisCache.set(key, apps);
    console.log(`[Cache] SET: App routing for ${query}`);
  }

  // Connection status caching
  async getCachedConnectionStatus(connectionId: string): Promise<any | null> {
    const key = `connection_status:${connectionId}`;
    const cached = await this.redisCache.get<any>(key);
    if (cached) {
      console.log(`[Cache] HIT: Connection status for ${connectionId}`);
      return cached;
    }
    console.log(`[Cache] MISS: Connection status for ${connectionId}`);
    return null;
  }

  async setCachedConnectionStatus(connectionId: string, status: any): Promise<void> {
    const key = `connection_status:${connectionId}`;
    await this.redisCache.set(key, status);
    console.log(`[Cache] SET: Connection status for ${connectionId}`);
  }

  // Analysis caching
  async getCachedAnalysis(queryHash: string): Promise<ComprehensiveAnalysis | null> {
    const key = `analysis:${queryHash}`;
    const cached = await this.redisCache.get<ComprehensiveAnalysis>(key);
    if (cached) {
      console.log(`[Cache] HIT: Analysis for hash ${queryHash}`);
      return cached;
    }
    console.log(`[Cache] MISS: Analysis for hash ${queryHash}`);
    return null;
  }

  async setCachedAnalysis(queryHash: string, analysis: ComprehensiveAnalysis): Promise<void> {
    const key = `analysis:${queryHash}`;
    await this.redisCache.set(key, analysis);
    console.log(`[Cache] SET: Analysis for hash ${queryHash}`);
  }

  // Helper method to create consistent hash keys
  private hashString(str: string): string {
    // Simple hash function for demonstration, in production consider a more robust one
    return btoa(unescape(encodeURIComponent(str))).replace(/[/+=]/g, '_');
  }

  // No cleanup method needed - Redis handles TTL automatically
}

// Global cache instance
const cacheManager = new RedisCacheManager();

// In-memory conversation store (could also be moved to Redis if needed)
const conversationStore = new Map<string, ChatMessage[]>();

function getConversationKey(userId: string, sessionId?: string): string {
  return sessionId ? `${userId}:${sessionId}` : userId;
}

function getConversationHistory(
  userId: string,
  sessionId?: string
): ChatMessage[] {
  const key = getConversationKey(userId, sessionId);
  console.log(`[Conversation] Retrieving history for key: ${key}`);
  return conversationStore.get(key) || [];
}

function updateConversationHistory(
  userId: string,
  message: ChatMessage,
  sessionId?: string
): void {
  const key = getConversationKey(userId, sessionId);
  const history = conversationStore.get(key) || [];
  history.push(message);

  if (history.length > MAX_CONVERSATION_HISTORY) {
    const removedCount = history.splice(
      0,
      history.length - MAX_CONVERSATION_HISTORY
    ).length;
    console.log(
      `[Conversation] Trimmed history for key ${key}, removed ${removedCount} messages.`
    );
  }

  conversationStore.set(key, history);
  console.log(
    `[Conversation] Updated history for key ${key}, current length: ${history.length}`
  );
}

// Performance monitoring singleton
class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  trackOperation(operationName: string, duration: number): void {
    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }
    
    const times = this.metrics.get(operationName)!;
    times.push(duration);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
  }

  getAverageTime(operationName: string): number {
    const times = this.metrics.get(operationName);
    if (!times || times.length === 0) return 0;
    
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  getMetrics(): Record<string, { avg: number, count: number }> {
    const result: Record<string, { avg: number, count: number }> = {};
    
    this.metrics.forEach((times, operation) => {
      result[operation] = {
        avg: this.getAverageTime(operation),
        count: times.length
      };
    });
    
    return result;
  }
}

// Optimized single-call analysis service
class OptimizedAnalysisService {
  private performanceMonitor = PerformanceMonitor.getInstance();
  
  private generateQueryHash(query: string, history: ChatMessage[]): string {
    const historySnippet = history
      .slice(-3)
      .map((m) => m.content.substring(0, 50))
      .join("|");
    const hash = `${query}:${historySnippet}`;
    // A simple hash function for demonstration, in production consider a more robust one
    return btoa(unescape(encodeURIComponent(hash))); // Base64 encode for simple hashing
  }

  async performComprehensiveAnalysis(
    userQuery: string,
    conversationHistory: ChatMessage[],
    currentSummary: any = null
  ): Promise<ComprehensiveAnalysis> {
    const startTime = Date.now();
    
    // Check cache first
    const queryHash = this.generateQueryHash(userQuery, conversationHistory);
    const cached = await cacheManager.getCachedAnalysis(queryHash);
    if (cached) {
      const duration = Date.now() - startTime;
      console.log(`[Analysis] Using cached comprehensive analysis. Duration: ${duration}ms`);
      return cached;
    }

    const contextualInfo = conversationHistory
      .slice(-3)
      .map((msg) => `${msg.role}: ${msg.content.substring(0, 100)}`)
      .join("\n");

    const summaryContext = currentSummary
      ? `Previous Context: ${JSON.stringify(currentSummary, null, 2)}`
      : "No previous context available.";

    const prompt = `You are an advanced AI orchestrator that performs comprehensive query analysis in a single pass. Analyze the user's request holistically and provide all necessary information for execution.

      ${summaryContext}

      Recent Conversation Context:
      ${contextualInfo}

      Current Query: "${userQuery}"

      Perform a comprehensive analysis covering:

      1. **Query Understanding & Confidence**
        - Analyze what the user is asking for
        - Determine clarity and actionability
        - Assign confidence score (0-1)
        - Identify if tools are needed

      2. **Execution Planning**
        - Break down into logical steps
        - Identify dependencies and priorities
        - Determine if sequential execution is needed
        - Estimate complexity level

      3. **Information Gathering**
        - Identify missing information
        - Generate search queries if needed
        - Determine clarification requirements
        - Assess if defaults can be used

      4. **Conversation Summary Update**
        - Update current intent and state
        - Track gathered and missing information
        - Identify key entities and preferences
        - Determine next expected action

      5. **Tool & App Recommendations**
        - Recommend relevant apps for execution
        - Prioritize tools based on query requirements
        - Provide reasoning for each recommendation

      Provide a complete analysis that enables efficient execution without additional LLM calls.`;

    try {
      console.log("[Analysis] Calling LLM for comprehensive analysis...");
      const { object } = await generateObject({
        model: model_gemini,
        system:
          "You are a comprehensive analysis assistant that provides complete query analysis in a single pass.",
        prompt: prompt,
        schema: comprehensiveAnalysisSchema,
        temperature: 0.1,
        maxTokens: 2000,
      });

      // Cache the result
      await cacheManager.setCachedAnalysis(queryHash, object);

      const duration = Date.now() - startTime;
      console.log(
        `[Analysis] Comprehensive analysis completed for query "${userQuery}" in ${duration}ms:`,
        {
          duration,
          confidence: object.confidenceScore,
          steps: object.executionSteps.length,
          apps: object.recommendedApps,
          needsTools: object.requiresToolExecution,
        }
      );
      console.log(
        `[Analysis] Full analysis object: ${JSON.stringify(object, null, 2)}`
      );

      return object;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Analysis] Error in comprehensive analysis after ${duration}ms:`, error);
      // Return minimal fallback
      return {
        queryAnalysis: "Basic query analysis - fallback due to error",
        isQueryClear: true,
        confidenceScore: 0.1, // Lower confidence on error
        requiresToolExecution: false,
        executionSteps: [
          {
            stepNumber: 1,
            description: "Handle user query conversationally (fallback)",
            requiredData: [],
            toolCategory: "general",
            dependencies: [],
            priority: "medium" as const,
          },
        ],
        estimatedComplexity: "low" as const,
        requiresSequentialExecution: false,
        needsInfoGathering: false,
        missingInformation: [],
        searchQueries: [],
        clarificationNeeded: [],
        canProceedWithDefaults: true,
        conversationSummary: {
          currentIntent: "User interaction (fallback)",
          contextualDetails: {
            gatheredInformation: [],
            missingInformation: [],
            userPreferences: [],
            previousActions: [],
          },
          conversationState: "information_gathering",
          keyEntities: [],
          nextExpectedAction: "Continue conversation (fallback)",
          topicShifts: [],
        },
        recommendedApps: [],
        toolPriorities: [],
      };
    }
  }
}

// Optimized tool preparation service
class OptimizedToolService {
  async prepareToolsForExecution(
    analysis: ComprehensiveAnalysis,
    userQuery: string,
    userId: string,
    req: Request,
    // Add toolNames from the initial routing response
    initialToolNames: string[]
  ): Promise<{ tools: ToolSet; requiredConnections: string[] }> {
    const { recommendedApps, toolPriorities } = analysis;

    console.log(
      `[Tools] Starting tool preparation. Recommended Apps from Analysis: ${JSON.stringify(
        recommendedApps
      )}. Initial Tool Names from Routing: ${JSON.stringify(initialToolNames)}`
    );

    if (recommendedApps.length === 0) {
      console.log(
        "[Tools] No recommended apps from analysis. Returning empty tools."
      );
      return { tools: {}, requiredConnections: [] };
    }

    // Get app routing with caching
    let appNames = await cacheManager.getCachedAppRouting(userQuery);
    if (!appNames) {
      try {
        console.log("[Tools] Fetching app routing from API...");
        const routeAppsApiUrl = new URL(
          "/api/agent/route-apps",
          req.url
        ).toString();
        const routingRes = await fetch(routeAppsApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userQuery }),
        });

        if (routingRes.ok) {
          const { appNames: routedApps } =
            (await routingRes.json()) as LLMRoutingResponse;
          appNames = routedApps;
          await cacheManager.setCachedAppRouting(userQuery, appNames);
          console.log(
            `[Tools] App routing API returned: ${JSON.stringify(appNames)}`
          );
        } else {
          console.warn(
            `[Tools] App routing API failed (${routingRes.status}). Falling back to analysis recommendations.`
          );
          appNames = recommendedApps; // Fallback to analysis recommendations
        }
      } catch (error) {
        console.warn(
          "[Tools] App routing fetch error, using analysis recommendations:",
          error
        );
        appNames = recommendedApps;
      }
    } else {
      console.log(
        `[Tools] Using cached app routing: ${JSON.stringify(appNames)}`
      );
    }

    // Prioritize apps based on analysis
    const prioritizedApps = appNames
      .map((app) => ({
        name: app,
        priority: toolPriorities.find((p) => p.appName === app)?.priority || 5,
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3) // Limit to top 3 apps for performance
      .map((app) => app.name);
    console.log(
      `[Tools] Prioritized apps for execution (top 3): ${JSON.stringify(
        prioritizedApps
      )}`
    );

    let fetchedComposioTools: ToolSet = {};
    const appsNeedingConnection: string[] = [];

    // Process apps in parallel for better performance
    const toolPromises = prioritizedApps.map(async (appName) => {
      console.log(`[Tools] Processing app: ${appName}`);
      const connectedAccountId = await this.getConnectedAccountIdForUserAndApp(
        userId,
        appName
      );

      if (!connectedAccountId) {
        appsNeedingConnection.push(appName);
        console.warn(
          `[Tools] App ${appName} is NOT connected for user ${userId}.`
        );
        return null;
      }
      console.log(
        `[Tools] App ${appName} has connected account ID: ${connectedAccountId}`
      );

      // Check connection status with caching
      let connectionStatus = await cacheManager.getCachedConnectionStatus(connectedAccountId);
      if (!connectionStatus) {
        console.log(
          `[Tools] Fetching connection status for ${appName} (${connectedAccountId})...`
        );
        connectionStatus = await getComposioConnectionStatus(
          connectedAccountId
        );
        await cacheManager.setCachedConnectionStatus(
          connectedAccountId,
          connectionStatus
        );
        console.log(
          `[Tools] Connection status for ${appName}: ${JSON.stringify(
            connectionStatus.status
          )}`
        );
      } else {
        console.log(
          `[Tools] Using cached connection status for ${appName}: ${JSON.stringify(
            connectionStatus.status
          )}`
        );
      }

      if (
        connectionStatus.status !== "INITIATED" &&
        connectionStatus.status !== "ACTIVE"
      ) {
        appsNeedingConnection.push(appName);
        console.warn(
          `[Tools] Composio reports ${appName} connection ${connectedAccountId} is NOT active/initiated. Skipping tool collection.`
        );
        return null;
      }
      console.log(`[Tools] App ${appName} connection is ACTIVE.`);

      // --- START: Prioritize initialToolNames for fetching tools ---
      let toolsToFetchForApp: string[] = [];
      const specificToolsFromRouting = initialToolNames.filter((t) =>
        t.startsWith(`${appName}_`)
      );

      if (specificToolsFromRouting.length > 0) {
        toolsToFetchForApp = specificToolsFromRouting;
        console.log(
          `[Tools] Using specific tool names from initial routing for ${appName}: ${JSON.stringify(
            toolsToFetchForApp
          )}`
        );
      } else {
        // Fallback to semantic search if no specific tools were identified by initial routing
        let relevantTools = await cacheManager.getCachedToolSearch(
          appName,
          userQuery
        );
        if (!relevantTools) {
          try {
            console.log(
              `[Tools] Performing semantic search for tools in ${appName} with query: "${userQuery}"`
            );
            const searchToolsApiUrl = new URL(
              "/api/agent/tools/search",
              req.url
            ).toString();
            const res = await fetch(searchToolsApiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ appName, userQuery, topK: 5 }),
            });

            if (res.ok) {
              const pineconeSearchRes = await res.json();
              relevantTools = pineconeSearchRes.relevantTools || [];
              await cacheManager.setCachedToolSearch(
                appName,
                userQuery,
                relevantTools ?? []
              );
              console.log(
                `[Tools] Semantic search for ${appName} returned: ${JSON.stringify(
                  relevantTools
                )}`
              );
            } else {
              console.warn(
                `[Tools] Semantic search failed for ${appName} (${res.status}).`
              );
              relevantTools = [];
            }
          } catch (error) {
            console.warn(
              `[Tools] Semantic search error for ${appName}:`,
              error
            );
            relevantTools = [];
          }
        } else {
          console.log(
            `[Tools] Using cached relevant tools for ${appName}: ${JSON.stringify(
              relevantTools
            )}`
          );
        }
        toolsToFetchForApp = relevantTools ?? [];
      }
      // --- END: Prioritize initialToolNames for fetching tools ---

      if (toolsToFetchForApp.length > 0) {
        try {
          console.log(
            `[Tools] Fetching full tool definitions for ${appName}: ${JSON.stringify(
              toolsToFetchForApp
            )}`
          );
          const tools = (await getComposioTool(toolsToFetchForApp)) as ToolSet;
          console.log(
            `[Tools] Fetched ${Object.keys(tools).length} tools for ${appName}.`
          );
          return { appName, tools };
        } catch (error) {
          console.error(
            `[Tools] Error fetching full tool definitions for ${appName}:`,
            error
          );
          return null;
        }
      }

      console.log(`[Tools] No relevant tools found or fetched for ${appName}.`);
      return null;
    });

    // Wait for all tool fetching to complete
    const toolResults = await Promise.allSettled(toolPromises);

    toolResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        fetchedComposioTools = {
          ...fetchedComposioTools,
          ...result.value.tools,
        };
      }
    });

    console.log(
      `[Tools] Total tools prepared for LLM: ${
        Object.keys(fetchedComposioTools).length
      }`
    );
    console.log(
      `[Tools] Apps requiring connection: ${JSON.stringify(
        appsNeedingConnection
      )}`
    );

    return {
      tools: fetchedComposioTools,
      requiredConnections: appsNeedingConnection,
    };
  }

  private async getConnectedAccountIdForUserAndApp(
    userId: string,
    appName: string
  ): Promise<string> {
    // Mock implementation - replace with your actual logic
    const mockConnectedAccountMap: { [key: string]: string } = {
      GMAIL: "76a0dd9f-907d-4b16-8c76-44e17b31b180",
      GOOGLECALENDAR: "c9e13275-ed69-4e56-855b-f9399e3e412a", // Example: A real ID for testing
      GOOGLEDRIVE: "mock_drive_conn_id_123",
      NOTION: "mock_notion_conn_id_123",
      GOOGLEDOCS: "8e0f132c-a72b-46a2-951a-8c57b859e532", // Example: A real ID for testing
    };
    const accountId = mockConnectedAccountMap[appName];
    console.log(
      `[Mock Connection] getConnectedAccountIdForUserAndApp for ${appName}: ${
        accountId ? "Found" : "Not Found"
      }`
    );
    return accountId || "";
  }
}

// Optimized execution context
class OptimizedExecutionContext {
  private stepResults: Map<number, any> = new Map();
  private executionLog: string[] = [];

  addStepResult(stepNumber: number, result: any): void {
    this.stepResults.set(stepNumber, result);
    this.executionLog.push(
      `Step ${stepNumber}: ${this.truncateResult(result)}`
    );
    console.log(
      `[Execution Context] Added step ${stepNumber} result: ${this.truncateResult(
        result
      )}`
    );
  }

  private truncateResult(result: any): string {
    if (typeof result === "string") {
      return result.length > 100 ? result.substring(0, 100) + "..." : result;
    }
    try {
      const jsonString = JSON.stringify(result);
      return jsonString.length > 100
        ? jsonString.substring(0, 100) + "..."
        : jsonString;
    } catch (e) {
      return "[Unstringifiable Object]";
    }
  }

  getStepResult(stepNumber: number): any {
    const result = this.stepResults.get(stepNumber);
    console.log(
      `[Execution Context] Retrieved step ${stepNumber} result: ${this.truncateResult(
        result
      )}`
    );
    return result;
  }

  getExecutionSummary(): string {
    const summary = this.executionLog.join(" → ");
    console.log(`[Execution Context] Full execution summary: ${summary}`);
    return summary;
  }

  enrichParametersWithContext(parameters: any): any {
    if (!parameters || typeof parameters !== "object") {
      return parameters;
    }

    const enriched = { ...parameters };
    let changed = false;
    for (const [key, value] of Object.entries(enriched)) {
      if (typeof value === "string" && value.startsWith("$step_")) {
        const stepNumber = parseInt(value.substring(6));
        const stepResult = this.getStepResult(stepNumber);
        if (stepResult !== undefined) {
          // Check for undefined, not just truthy
          enriched[key] = stepResult;
          changed = true;
          console.log(
            `[Execution Context] Enriched parameter '${key}' with result from step ${stepNumber}.`
          );
        } else {
          console.warn(
            `[Execution Context] Could not enrich parameter '${key}': Step ${stepNumber} result not found.`
          );
        }
      }
    }
    if (changed) {
      console.log(
        `[Execution Context] Parameters enriched. Original: ${JSON.stringify(
          parameters
        )}, Enriched: ${JSON.stringify(enriched)}`
      );
    } else {
      console.log(`[Execution Context] No parameters needed enrichment.`);
    }
    return enriched;
  }
}

// Optimized prompt builder
function buildOptimizedPrompt(
  userQuery: string,
  analysis: ComprehensiveAnalysis,
  conversationHistory: ChatMessage[],
  hasTools: boolean
): string {
  const currentDate = new Date().toISOString().split("T")[0];
  const { conversationSummary, executionSteps, confidenceScore } = analysis;

  let prompt = `You are an advanced AI assistant optimized for efficient execution. Your primary goal is to accurately complete tasks and report their outcomes.

**Context Summary:**
- Date: ${currentDate}
- Query Confidence: ${confidenceScore.toFixed(2)}
- Current Intent: ${conversationSummary.currentIntent}
- Conversation State: ${conversationSummary.conversationState}
- Tools Available: ${hasTools ? "Yes" : "No"}

**Execution Plan (${executionSteps.length} steps):**
${executionSteps
  .map((step, i) => `${i + 1}. ${step.description} (${step.priority})`)
  .join("\n")}

**Key Context:**
- Gathered: ${
    conversationSummary.contextualDetails.gatheredInformation.join(", ") ||
    "None"
  }
- Missing: ${
    conversationSummary.contextualDetails.missingInformation.join(", ") ||
    "None"
  }
- Entities: ${
    conversationSummary.keyEntities
      .map((e) => `${e.type}:${e.value}`)
      .join(", ") || "None"
  }`;

  if (conversationHistory.length > 0) {
    prompt += `\n\n**Recent History:**\n${conversationHistory
      .slice(-2)
      .map(
        (msg) =>
          `${msg.role}: ${msg.content.substring(0, 100)}${
            msg.content.length > 100 ? "..." : ""
          }`
      )
      .join("\n")}`;
  }

  prompt += `\n\n**Current Query:** "${userQuery}"`;

  if (hasTools) {
    prompt += `\n\n**Tool Execution Strategy:**
- Execute steps systematically.
- Use context from previous steps.
- Provide clear progress updates.
- **Crucially, accurately report the success or failure of each tool execution.** If a tool fails, state what failed and why, and suggest next steps.`;
  }

  prompt += `\n\n**Next Action:** ${conversationSummary.nextExpectedAction}`;

  console.log(
    `[Prompt Builder] Generated prompt (truncated): ${prompt.substring(
      0,
      500
    )}...`
  );
  return prompt;
}

// Main API handler
export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    console.log(
      `[API] Received raw request body: ${JSON.stringify(body).substring(
        0,
        200
      )}...`
    );
    const { userQuery, userId, conversationHistory, sessionId } =
      body.body || body;

    // Input validation
    if (!userQuery?.trim() || !userId?.trim()) {
      console.error("[API] Validation Error: Missing userQuery or userId.");
      return NextResponse.json(
        {
          response: "Missing userQuery or userId in request body.",
          error: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    console.log(
      `🚀 Production Chat Request - User: ${userId}, Query: "${userQuery}", Session: ${
        sessionId || "N/A"
      }`
    );

    // Initialize services
    console.log("[API] Initializing Pinecone index...");
    await initializePineconeIndex();
    const analysisService = new OptimizedAnalysisService();
    const toolService = new OptimizedToolService();
    const executionContext = new OptimizedExecutionContext(); // Instance of the context manager

    // Get conversation history
    const existingHistory =
      conversationHistory || getConversationHistory(userId, sessionId);
    const lastSummary =
      existingHistory.length > 0
        ? existingHistory[existingHistory.length - 1]?.analysis
            ?.conversationSummary
        : null;
    console.log(
      `[API] Existing conversation history length: ${existingHistory.length}`
    );
    if (lastSummary) {
      console.log(
        `[API] Last conversation summary intent: ${lastSummary.currentIntent}`
      );
    }

    // Phase 1: Single comprehensive analysis (replaces 3 separate LLM calls)
    console.log("📊 Phase 1: Comprehensive Analysis");
    const analysis = await analysisService.performComprehensiveAnalysis(
      userQuery,
      existingHistory,
      lastSummary
    );

    let finalResponseText: string;
    let finalExecutedTools: any[] = [];
    let finalRequiredConnections: string[] = [];

    // Phase 2: Route based on confidence and requirements
    if (analysis.confidenceScore >= 0.8 && analysis.requiresToolExecution) {
      console.log("🔧 Phase 2: High-confidence tool execution path.");

      // Initial app routing to get toolNames
      let initialToolNames: string[] = [];
      try {
        const routeAppsApiUrl = new URL(
          "/api/agent/route-apps",
          req.url
        ).toString();
        const routingRes = await fetch(routeAppsApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userQuery }),
        });
        if (routingRes.ok) {
          const { toolNames } = (await routingRes.json()) as LLMRoutingResponse;
          initialToolNames = toolNames;
          console.log(
            `[API] Initial routing identified specific tool names: ${JSON.stringify(
              initialToolNames
            )}`
          );
        } else {
          console.warn(
            `[API] Initial routing API failed (${routingRes.status}). Proceeding without specific tool names from routing.`
          );
        }
      } catch (error) {
        console.warn(
          `[API] Error during initial routing for tool names:`,
          error
        );
      }

      // Prepare tools optimally, passing initialToolNames
      const toolResult = await toolService.prepareToolsForExecution(
        analysis,
        userQuery,
        userId,
        req,
        initialToolNames // Pass the toolNames from initial routing
      );

      const hasTools = Object.keys(toolResult.tools).length > 0;
      finalRequiredConnections = toolResult.requiredConnections;
      console.log(
        `[API] Tools prepared. Has tools: ${hasTools}. Required connections: ${JSON.stringify(
          finalRequiredConnections
        )}`
      );

      if (hasTools) {
        // Execute with tools
        const optimizedPrompt = buildOptimizedPrompt(
          userQuery,
          analysis,
          existingHistory,
          true
        );
        console.log("[API] Calling generateText with tools...");

        const executionResult = await generateText({
          model: model,
          prompt: optimizedPrompt,
          tools: toolResult.tools,
          toolChoice: "auto",
          temperature: 0.3,
          maxSteps: MAX_AGENT_STEPS,
          maxTokens: 3000,
        });

        finalExecutedTools = executionResult.toolCalls || [];
        console.log(
          `[API] generateText returned ${finalExecutedTools.length} tool calls.`
        );

        let hadToolFailure = false;
        let failedToolNames: string[] = [];
        let toolExecutionDetails: string[] = [];

        // Check the results of each tool call
        if (finalExecutedTools.length > 0) {
          for (const toolCall of finalExecutedTools) {
            console.log(
              `[Tool Execution] Tool: ${
                toolCall.toolName
              }, Args: ${JSON.stringify(
                toolCall.args
              )}, Result: ${JSON.stringify(toolCall.result)}`
            );
            // Assuming toolCall.result is populated by the AI SDK with the outcome
            // and that a failed tool execution would have an 'error' property or similar
            if (
              toolCall.result &&
              typeof toolCall.result === "object" &&
              "error" in toolCall.result
            ) {
              console.error(
                `[Tool Execution] FAILURE for ${toolCall.toolName}:`,
                toolCall.result.error
              );
              hadToolFailure = true;
              failedToolNames.push(toolCall.toolName);
              toolExecutionDetails.push(
                `${toolCall.toolName} failed: ${toolCall.result.error}`
              );
            } else if (
              toolCall.result &&
              typeof toolCall.result === "object" &&
              "success" in toolCall.result &&
              toolCall.result.success === false
            ) {
              // Another common pattern for reporting failure
              console.error(
                `[Tool Execution] FAILURE for ${toolCall.toolName}: Success property is false.`
              );
              hadToolFailure = true;
              failedToolNames.push(toolCall.toolName);
              toolExecutionDetails.push(`${toolCall.toolName} failed.`);
            } else {
              console.log(`[Tool Execution] SUCCESS for ${toolCall.toolName}.`);
              toolExecutionDetails.push(`${toolCall.toolName} succeeded.`);
            }
            // Add result to execution context for potential future steps (though not used in this simplified flow)
            executionContext.addStepResult(
              toolCall.toolCallId,
              toolCall.result
            );
          }
        }

        if (hadToolFailure) {
          finalResponseText = `I attempted to complete your request, but encountered issues with the following actions: ${failedToolNames.join(
            ", "
          )}. Details: ${toolExecutionDetails.join(
            "; "
          )}. Please check the details for each action. I might need more information or the connection might be problematic.`;
          console.warn(
            `[API] Final response indicates tool failure: ${finalResponseText}`
          );
        } else {
          finalResponseText =
            executionResult.text ||
            "Task completed successfully using specialized tools.";
          console.log(
            `[API] Final response indicates successful tool execution: ${finalResponseText}`
          );
        }
      } else {
        finalResponseText =
          finalRequiredConnections.length > 0
            ? `I need access to ${finalRequiredConnections.join(
                ", "
              )} to help with this request. Please connect these apps first.`
            : "I understand your request but don't have access to the required tools at the moment.";
        console.log(
          `[API] No tools available or connected. Response: ${finalResponseText}`
        );
      }
    } else if (analysis.confidenceScore >= 0.4) {
      console.log("❓ Phase 2: Medium-confidence clarification path.");

      if (analysis.clarificationNeeded.length > 0) {
        finalResponseText = `I need clarification on:\n\n${analysis.clarificationNeeded
          .map((item, idx) => `${idx + 1}. ${item}`)
          .join("\n")}\n\nPlease provide these details.`;
        console.log(`[API] Clarification needed: ${finalResponseText}`);
      } else {
        finalResponseText = `I understand you're asking about "${userQuery}". Let me help you with that based on my understanding.`;
        console.log(
          `[API] Proceeding with general understanding for medium confidence query.`
        );

        // Simple execution without tools
        const simplePrompt = buildOptimizedPrompt(
          userQuery,
          analysis,
          existingHistory,
          false
        );
        const simpleResult = await generateText({
          model: model,
          prompt: simplePrompt,
          temperature: 0.4,
          maxTokens: 1500,
        });

        finalResponseText = simpleResult.text || finalResponseText;
        console.log(
          `[API] Conversational response for medium confidence: ${finalResponseText.substring(
            0,
            100
          )}...`
        );
      }
    } else {
      console.log("💬 Phase 2: Low-confidence conversational response path.");

      const conversationalPrompt = `You are a helpful AI assistant.

User Query: "${userQuery}"
Context: ${analysis.conversationSummary.currentIntent}

Provide a helpful, conversational response. If unclear, ask for clarification politely.`;

      const conversationalResult = await generateText({
        model: model,
        prompt: conversationalPrompt,
        temperature: 0.5,
        maxTokens: 1000,
      });

      finalResponseText =
        conversationalResult.text ||
        "I'm here to help! Could you provide more details about what you need?";
      console.log(
        `[API] Conversational response for low confidence: ${finalResponseText.substring(
          0,
          100
        )}...`
      );
    }

    // Phase 3: Update conversation history
    console.log("[API] Updating conversation history.");
    const userMessage: ChatMessage = {
      role: "user",
      content: userQuery,
      timestamp: Date.now(),
    };

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: finalResponseText,
      timestamp: Date.now(),
      toolCalls: finalExecutedTools.map((tool) => ({
        name: tool.toolName,
        args: tool.args,
        toolCallId: tool.toolCallId,
        result: tool.result, // Include the tool result in the history message
      })),
      analysis,
    };

    updateConversationHistory(userId, userMessage, sessionId);
    updateConversationHistory(userId, assistantMessage, sessionId);

    // Prepare response
    const response: ChatResponse = {
      response: finalResponseText,
      executedTools: finalExecutedTools.map((tool, idx) => ({
        name: tool.toolName,
        args: tool.args,
        toolCallId: tool.toolCallId,
        stepNumber: idx + 1,
        result: tool.result, // Include the tool result in the final response
      })),
      requiredConnections:
        finalRequiredConnections.length > 0
          ? finalRequiredConnections
          : undefined,
      conversationHistory: getConversationHistory(userId, sessionId),
      analysis,
    };

    const processingTime = Date.now() - startTime;
    console.log(
      `✅ Request completed in ${processingTime}ms. Final Response: ${JSON.stringify(
        response
      ).substring(0, 500)}...`
    );

    return NextResponse.json(response);
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ API Error after ${processingTime}ms:`, error);

    return NextResponse.json(
      {
        response:
          "I encountered an error while processing your request. Please try again.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
