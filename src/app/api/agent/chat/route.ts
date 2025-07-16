// src/app/api/chat/route.ts
import { NextResponse } from "next/server";
import { generateText, generateObject, ToolSet, CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

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
const MAX_AGENT_STEPS = 8;
const MAX_CONVERSATION_HISTORY = 10;

// Enhanced schemas for multi-step planning with confidence scoring
const planningStepSchema = z.object({
  stepNumber: z.number(),
  description: z.string(),
  requiredData: z.array(z.string()),
  appName: z.string().optional(),
  toolCategory: z.string(),
  dependencies: z.array(z.number()),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
});

const executionPlanSchema = z.object({
  queryAnalysis: z.string(),
  isQueryClear: z.boolean(),
  needsInfoGathering: z.boolean(),
  missingInformation: z.array(z.string()),
  executionSteps: z.array(planningStepSchema),
  estimatedComplexity: z.enum(["low", "medium", "high"]),
  requiresSequentialExecution: z.boolean(),
  requiresToolExecution: z
    .boolean()
    .describe(
      "True if the query requires external tools or multi-step execution; false for simple informational or conversational responses"
    ),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "A confidence score (0-1) in the clarity and actionability of the query and the generated plan. 1 is absolute certainty."
    ),
});

const conversationSummarySchema = z.object({
  currentIntent: z.string().describe("The user's current primary intent or goal"),
  contextualDetails: z.object({
    gatheredInformation: z.array(z.string()).describe("Information already collected"),
    missingInformation: z.array(z.string()).describe("Information still needed"),
    userPreferences: z.array(z.string()).describe("User preferences mentioned"),
    previousActions: z.array(z.string()).describe("Actions taken in conversation"),
  }),
  conversationState: z.enum(["information_gathering", "ready_to_execute", "executed", "clarification_needed", "completed"]),
  keyEntities: z.array(z.object({
    type: z.string().describe("Type of entity (person, date, location, etc.)"),
    value: z.string().describe("The actual value"),
    confidence: z.number().min(0).max(1).describe("Confidence in this entity"),
  })),
  nextExpectedAction: z.string().describe("What the system should do next"),
  topicShifts: z.array(z.string()).describe("Any topic changes detected"),
});

const infoGatheringSchema = z.object({
  searchQueries: z.array(z.string()),
  clarificationNeeded: z.array(z.string()),
  canProceedWithDefaults: z.boolean(),
});

type ExecutionPlan = z.infer<typeof executionPlanSchema>;
type ConversationSummary = z.infer<typeof conversationSummarySchema>;
type InfoGathering = z.infer<typeof infoGatheringSchema>;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCalls?: { name: string; args: any; result?: any }[];
  executionPlan?: ExecutionPlan;
  stepResults?: { stepNumber: number; success: boolean; result?: any }[];
  conversationSummary?: ConversationSummary;
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
  executionPlan?: ExecutionPlan;
  conversationSummary?: ConversationSummary;
  error?: string;
}

// In-memory conversation store
const conversationStore = new Map<string, ChatMessage[]>();
const conversationSummaryStore = new Map<string, ConversationSummary>();

function getConversationKey(userId: string, sessionId?: string): string {
  return sessionId ? `${userId}:${sessionId}` : userId;
}

function getConversationHistory(userId: string, sessionId?: string): ChatMessage[] {
  const key = getConversationKey(userId, sessionId);
  return conversationStore.get(key) || [];
}

function getConversationSummary(userId: string, sessionId?: string): ConversationSummary | null {
  const key = getConversationKey(userId, sessionId);
  return conversationSummaryStore.get(key) || null;
}

function updateConversationHistory(userId: string, message: ChatMessage, sessionId?: string): void {
  const key = getConversationKey(userId, sessionId);
  const history = conversationStore.get(key) || [];
  history.push(message);

  if (history.length > MAX_CONVERSATION_HISTORY) {
    history.splice(0, history.length - MAX_CONVERSATION_HISTORY);
  }

  conversationStore.set(key, history);
}

function updateConversationSummary(userId: string, summary: ConversationSummary, sessionId?: string): void {
  const key = getConversationKey(userId, sessionId);
  conversationSummaryStore.set(key, summary);
}

// Enhanced Planning Service with Dynamic Conversation Summary
class EnhancedPlanningService {
  async createExecutionPlan(
    userQuery: string,
    conversationHistory: ChatMessage[],
    currentSummary: ConversationSummary | null
  ): Promise<ExecutionPlan> {
    const contextualInfo = conversationHistory
      .slice(-3)
      .map((msg) => `${msg.role}: ${msg.content.substring(0, 100)}`)
      .join("\n");

    const summaryContext = currentSummary 
      ? `Current Conversation Summary:
        - Intent: ${currentSummary.currentIntent}
        - State: ${currentSummary.conversationState}
        - Gathered Info: ${currentSummary.contextualDetails.gatheredInformation.join(", ")}
        - Missing Info: ${currentSummary.contextualDetails.missingInformation.join(", ")}
        - Key Entities: ${currentSummary.keyEntities.map(e => `${e.type}: ${e.value}`).join(", ")}
        - Next Expected Action: ${currentSummary.nextExpectedAction}`
      : "No previous conversation summary available.";

    const prompt = `You are an intelligent query planner with access to conversation context. Analyze the user's request and create a detailed execution plan.

${summaryContext}

Context from recent conversation:
${contextualInfo}

Current Query: "${userQuery}"

Your task is to:
1. Understand what the user is asking for in context of the conversation
2. Determine if this is a simple query or requires multi-step execution
3. Generate a confidence score (0-1) for query clarity and actionability
4. Break down complex requests into logical, sequential steps
5. Identify what data/information is needed for each step
6. Assess if the query requires external tools or can be handled conversationally
7. Determine if information gathering is needed before execution

Consider:
- Does this query reference previous conversation context?
- Are there ambiguous terms that need clarification?
- How confident are you about the user's intent (0-1 scale)?
- Does this require sequential steps or can be done in parallel?
- What apps/tools might be needed for each step?
- Is this a simple conversational query or does it require tool execution?

Create a comprehensive execution plan with a confidence score.`;

    try {
      const { object } = await generateObject({
        model: openai(AGENT_LLM_MODEL),
        system: "You are a helpful planning assistant that provides structured analysis with confidence scoring.",
        prompt: prompt,
        schema: executionPlanSchema,
        temperature: 0.1,
        maxTokens: 1000,
      });

      console.log(`Execution Plan created for query "${userQuery}":`, {
        complexity: object.estimatedComplexity,
        steps: object.executionSteps.length,
        needsInfoGathering: object.needsInfoGathering,
        confidenceScore: object.confidenceScore,
        requiresToolExecution: object.requiresToolExecution,
      });

      return object;
    } catch (error) {
      console.error("Error creating execution plan:", error);
      // Return a simple fallback plan with low confidence
      return {
        queryAnalysis: "Simple query that can be handled directly",
        isQueryClear: true,
        needsInfoGathering: false,
        missingInformation: [],
        executionSteps: [
          {
            stepNumber: 1,
            description: "Handle user query directly",
            requiredData: [],
            toolCategory: "general",
            dependencies: [],
            priority: "medium" as const,
          },
        ],
        estimatedComplexity: "low" as const,
        requiresSequentialExecution: false,
        requiresToolExecution: false,
        confidenceScore: 0.1,
      };
    }
  }

  async updateConversationSummary(
    userQuery: string,
    assistantResponse: string,
    currentSummary: ConversationSummary | null,
    executionPlan: ExecutionPlan,
    toolCalls: any[]
  ): Promise<ConversationSummary> {
    const prompt = `You are a conversation summary manager. Update the conversation summary based on the latest interaction.

Current Summary: ${currentSummary ? JSON.stringify(currentSummary, null, 2) : "None"}

Latest User Query: "${userQuery}"
Assistant Response: "${assistantResponse}"
Execution Plan: ${JSON.stringify(executionPlan, null, 2)}
Tool Calls Made: ${toolCalls.length}

Update the conversation summary to reflect:
1. The current intent and state
2. Information gathered and still missing
3. Key entities mentioned
4. Next expected action
5. Any topic shifts detected

Keep the summary concise but comprehensive.`;

    try {
      const { object } = await generateObject({
        model: openai(AGENT_LLM_MODEL),
        system: "You are a helpful conversation summary manager that maintains context across interactions.",
        prompt: prompt,
        schema: conversationSummarySchema,
        temperature: 0.1,
        maxTokens: 800,
      });

      return object;
    } catch (error) {
      console.error("Error updating conversation summary:", error);
      // Return a basic summary if update fails
      return {
        currentIntent: "User interaction in progress",
        contextualDetails: {
          gatheredInformation: [],
          missingInformation: [],
          userPreferences: [],
          previousActions: [],
        },
        conversationState: "information_gathering",
        keyEntities: [],
        nextExpectedAction: "Continue conversation",
        topicShifts: [],
      };
    }
  }

  async gatherMissingInformation(
    userQuery: string,
    executionPlan: ExecutionPlan
  ): Promise<InfoGathering> {
    if (!executionPlan.needsInfoGathering) {
      return {
        searchQueries: [],
        clarificationNeeded: [],
        canProceedWithDefaults: true,
      };
    }

    const prompt = `Based on the execution plan, determine what information needs to be gathered.

Query: "${userQuery}"
Missing Information: ${executionPlan.missingInformation.join(", ")}
Analysis: ${executionPlan.queryAnalysis}

Create specific search queries to find the missing information and identify what clarification is needed.`;

    try {
      const { object } = await generateObject({
        model: openai(AGENT_LLM_MODEL),
        system: "You are a helpful information gathering assistant.",
        prompt: prompt,
        schema: infoGatheringSchema,
        temperature: 0.1,
        maxTokens: 500,
      });

      return object;
    } catch (error) {
      console.error("Error gathering information requirements:", error);
      return {
        searchQueries: [],
        clarificationNeeded: [],
        canProceedWithDefaults: true,
      };
    }
  }
}

// Enhanced Tool Selection Service (unchanged)
class EnhancedToolSelectionService {
  async selectToolsForSteps(
    executionPlan: ExecutionPlan,
    userQuery: string,
    req: Request
  ): Promise<{ stepNumber: number; appName: string; toolNames: string[] }[]> {
    const stepToolMappings: {
      stepNumber: number;
      appName: string;
      toolNames: string[];
    }[] = [];

    for (const step of executionPlan.executionSteps) {
      if (step.appName) {
        try {
          const searchQuery = `${step.description} ${step.toolCategory} ${step.requiredData.join(" ")}`;
          const searchToolsApiUrl = new URL("/api/agent/tools/search", req.url).toString();

          const res = await fetch(searchToolsApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appName: step.appName,
              userQuery: searchQuery,
              topK: 3,
            }),
          });

          if (res.ok) {
            const pineconeSearchRes = await res.json();
            const relevantTools = pineconeSearchRes.relevantTools || [];

            if (relevantTools.length > 0) {
              stepToolMappings.push({
                stepNumber: step.stepNumber,
                appName: step.appName,
                toolNames: relevantTools,
              });
              console.log(`Step ${step.stepNumber}: Found ${relevantTools.length} tools for ${step.appName}`);
            }
          }
        } catch (error) {
          console.warn(`Tool search failed for step ${step.stepNumber}:`, error);
        }
      }
    }

    return stepToolMappings;
  }
}

// Enhanced execution context (unchanged)
class ExecutionContext {
  private stepResults: Map<number, any> = new Map();
  private executionLog: string[] = [];

  addStepResult(stepNumber: number, result: any): void {
    this.stepResults.set(stepNumber, result);
    this.executionLog.push(
      `Step ${stepNumber} completed: ${
        typeof result === "object" ? JSON.stringify(result).substring(0, 100) : result
      }`
    );
  }

  getStepResult(stepNumber: number): any {
    return this.stepResults.get(stepNumber);
  }

  getExecutionSummary(): string {
    return this.executionLog.join("\n");
  }

  enrichParametersWithContext(parameters: any, step: any): any {
    if (!parameters || typeof parameters !== "object") {
      return parameters;
    }

    const enriched = { ...parameters };

    for (const [key, value] of Object.entries(enriched)) {
      if (typeof value === "string" && value.startsWith("$step_")) {
        const stepNumber = parseInt(value.substring(6));
        const stepResult = this.getStepResult(stepNumber);
        if (stepResult) {
          enriched[key] = stepResult;
        }
      }
    }

    return enriched;
  }
}

function buildEnhancedContextualPrompt(
  userQuery: string,
  conversationHistory: ChatMessage[],
  executionPlan: ExecutionPlan,
  conversationSummary: ConversationSummary | null,
  hasTools: boolean
): string {
  const currentDate = new Date().toISOString().split("T")[0];

  let prompt = `You are an advanced AI assistant with comprehensive knowledge and specialized tool access. You excel at handling complex, multi-step requests through careful planning and execution.

**Today's Date:** ${currentDate}

**Execution Plan Analysis:**
- Query Complexity: ${executionPlan.estimatedComplexity}
- Steps Required: ${executionPlan.executionSteps.length}
- Sequential Execution: ${executionPlan.requiresSequentialExecution ? "Yes" : "No"}
- Clear Query: ${executionPlan.isQueryClear ? "Yes" : "No"}
- Confidence Score: ${executionPlan.confidenceScore.toFixed(2)}

**Execution Steps:**
${executionPlan.executionSteps
  .map((step) => `${step.stepNumber}. ${step.description} (Priority: ${step.priority})`)
  .join("\n")}`;

  // Add conversation summary context
  if (conversationSummary) {
    prompt += `\n\n**Conversation Context:**
- Current Intent: ${conversationSummary.currentIntent}
- Conversation State: ${conversationSummary.conversationState}
- Gathered Information: ${conversationSummary.contextualDetails.gatheredInformation.join(", ") || "None"}
- Missing Information: ${conversationSummary.contextualDetails.missingInformation.join(", ") || "None"}
- Key Entities: ${conversationSummary.keyEntities.map(e => `${e.type}: ${e.value}`).join(", ") || "None"}
- Next Expected Action: ${conversationSummary.nextExpectedAction}`;
  }

  prompt += `\n\n**Multi-Step Execution Protocol:**

**For Sequential Operations:**
1. Execute steps in order based on dependencies
2. Use results from previous steps to inform next steps
3. Provide progress updates: "Step X completed. Proceeding to Step Y..."
4. Handle errors gracefully with alternatives

**For Information Gathering:**
- Search BEFORE create/update/delete operations
- Resolve vague references by searching
- Validate prerequisites before proceeding

**Tool Usage Strategy:**
- For complex operations: Break into subtasks
- For missing data: Search first, then ask for clarification
- For errors: Try alternatives, provide partial results
- For dependencies: Ensure prerequisite steps complete first`;

  // Add conversation context
  if (conversationHistory.length > 0) {
    prompt += `\n\n**Previous Context:**\n`;
    conversationHistory.slice(-3).forEach((msg) => {
      if (msg.role === "user") {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === "assistant") {
        prompt += `Assistant: ${msg.content.substring(0, 150)}${
          msg.content.length > 150 ? "..." : ""
        }\n`;
      }
    });
  }

  prompt += `\n\n**Current Request:** "${userQuery}"\n`;

  if (hasTools) {
    prompt += `\n**Available Tools:** You have access to specialized tools. Execute the planned steps systematically.`;
  }

  if (executionPlan.requiresSequentialExecution) {
    prompt += `\n\n**IMPORTANT:** This request requires sequential execution. Complete each step before moving to the next, and use results from previous steps to inform subsequent actions.`;
  }

  return prompt;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userQuery, userId, conversationHistory, sessionId } = body.body || body;

    if (!userQuery || !userId) {
      return NextResponse.json(
        {
          response: "Missing userQuery or userId in request body.",
          error: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    const trimmedQuery = userQuery.trim();
    const trimmedUserId = userId.trim();

    if (!trimmedQuery || !trimmedUserId) {
      return NextResponse.json(
        {
          response: "userQuery or userId cannot be empty.",
          error: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    console.log(`--- Enhanced Chat Request with Dynamic Summary for user ${userId} ---`);
    console.log(`Query: "${userQuery}"`);

    // Initialize services
    await initializePineconeIndex();
    const planningService = new EnhancedPlanningService();
    const toolSelectionService = new EnhancedToolSelectionService();
    const executionContext = new ExecutionContext();

    // Get conversation history and summary
    const existingHistory = conversationHistory || getConversationHistory(userId, sessionId);
    const currentSummary = getConversationSummary(userId, sessionId);
    console.log(`Conversation history length: ${existingHistory.length}`);
    console.log(`Current summary state: ${currentSummary?.conversationState || "None"}`);

    // Phase 1: Create execution plan with summary context
    console.log("Phase 1: Creating execution plan with conversation summary...");
    const executionPlan = await planningService.createExecutionPlan(
      userQuery,
      existingHistory,
      currentSummary
    );

    // Declare variables for final response
    let finalResponseText: string;
    let finalExecutedTools: any[] = [];
    let finalRequiredConnections: string[] = [];
    let assistantMessageContent: string;

    // Confidence-based routing
    if (executionPlan.confidenceScore >= 0.8 && executionPlan.requiresToolExecution) {
      console.log("High confidence & actionable query - executing full pipeline");
      
      // Phase 2: Information gathering if needed
      console.log("Phase 2: Checking information gathering needs...");
      const infoGathering = await planningService.gatherMissingInformation(userQuery, executionPlan);

      if (infoGathering.clarificationNeeded.length > 0 && !infoGathering.canProceedWithDefaults) {
        finalResponseText = `I need clarification on the following points to proceed:\n\n${infoGathering.clarificationNeeded
          .map((item, idx) => `${idx + 1}. ${item}`)
          .join("\n")}\n\nPlease provide this information so I can assist you better.`;
        assistantMessageContent = finalResponseText;
      } else {
        // Phase 3: Enhanced tool routing and selection
        console.log("Phase 3: Enhanced tool routing...");
        let fetchedComposioTools: ToolSet = {};
        let hasTools = false;
        let stepToolMappings: { stepNumber: number; appName: string; toolNames: string[] }[] = [];

        try {
          const routeAppsApiUrl = new URL("/api/agent/route-apps", req.url).toString();
          const routingRes = await fetch(routeAppsApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userQuery }),
          });

          if (routingRes.ok) {
            const { appNames } = (await routingRes.json()) as LLMRoutingResponse;
            console.log(`Routing identified apps: ${JSON.stringify(appNames)}`);

            if (appNames.length > 0) {
              stepToolMappings = await toolSelectionService.selectToolsForSteps(
                executionPlan,
                userQuery,
                req
              );

              const toolResult = await prepareEnhancedTools(
                appNames,
                stepToolMappings,
                userQuery,
                userId,
                req
              );

              fetchedComposioTools = toolResult.tools;
              hasTools = Object.keys(fetchedComposioTools).length > 0;
              finalRequiredConnections = toolResult.requiredConnections;
            }
          }
        } catch (error) {
          console.warn("Enhanced tool routing failed, proceeding with general knowledge:", error);
        }

        // Phase 4: Generate contextual prompt with execution plan
        const contextualPrompt = buildEnhancedContextualPrompt(
          userQuery,
          existingHistory,
          executionPlan,
          currentSummary,
          hasTools
        );

        // Phase 5: Execute with enhanced multi-step capability
        console.log("Phase 5: Executing with enhanced multi-step capability...");
        const currentLlmResponse = await generateText({
          model: openai(AGENT_LLM_MODEL),
          prompt: contextualPrompt,
          tools: hasTools ? fetchedComposioTools : undefined,
          toolChoice: hasTools ? "auto" : undefined,
          temperature: 0.3,
          maxSteps: MAX_AGENT_STEPS,
          maxTokens: 4000,
        });

        finalResponseText = currentLlmResponse.text || "I've processed your request using enhanced multi-step planning.";
        finalExecutedTools = currentLlmResponse.toolCalls || [];
        assistantMessageContent = finalResponseText;
      }
    } else if (executionPlan.confidenceScore >= 0.4 && executionPlan.confidenceScore < 0.8) {
      console.log("Medium confidence - gathering more information");
      
      const infoGathering = await planningService.gatherMissingInformation(userQuery, executionPlan);
      
      if (infoGathering.clarificationNeeded.length > 0) {
        finalResponseText = `I need some clarification to better assist you:\n\n${infoGathering.clarificationNeeded
          .map((item, idx) => `${idx + 1}. ${item}`)
          .join("\n")}\n\nCould you provide more details?`;
      } else if (infoGathering.searchQueries.length > 0) {
        finalResponseText = `I understand you're asking about "${userQuery}". To provide the most accurate assistance, I might need to search for: ${infoGathering.searchQueries.join(", ")}. Could you provide more specific details or would you like me to proceed with a general response?`;
      } else {
        finalResponseText = `I'm not entirely sure about your request "${userQuery}". Could you rephrase it or provide more context? Alternatively, I can try to help based on my best understanding.`;
      }
      
      assistantMessageContent = finalResponseText;
    } else {
      console.log("Low confidence or non-actionable query - providing conversational response");
      
      // Simple conversational response
      const conversationalPrompt = `You are a helpful AI assistant. The user has asked: "${userQuery}"

${currentSummary ? `Previous conversation context: ${currentSummary.currentIntent}` : ""}

Provide a helpful, conversational response. If this seems like a simple question, answer it directly. If you need more information, ask for clarification politely.`;

      const conversationalResponse = await generateText({
        model: openai(AGENT_LLM_MODEL),
        prompt: conversationalPrompt,
        temperature: 0.5,
        maxTokens: 1000,
      });

      finalResponseText = conversationalResponse.text || "I'm here to help! Could you tell me more about what you need?";
      assistantMessageContent = finalResponseText;
    }

    // Update conversation summary
    console.log("Updating conversation summary...");
    const updatedSummary = await planningService.updateConversationSummary(
      userQuery,
      assistantMessageContent,
      currentSummary,
      executionPlan,
      finalExecutedTools
    );

    // Create enhanced assistant message
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: assistantMessageContent,
      timestamp: Date.now(),
      toolCalls: finalExecutedTools.map((tool) => ({
        name: tool.toolName,
        args: tool.args,
        toolCallId: tool.toolCallId,
      })),
      executionPlan,
      conversationSummary: updatedSummary,
    };

    // Add user message
    const userMessage: ChatMessage = {
      role: "user",
      content: userQuery,
      timestamp: Date.now(),
    };

    // Update conversation history and summary
    updateConversationHistory(userId, userMessage, sessionId);
    updateConversationHistory(userId, assistantMessage, sessionId);
    updateConversationSummary(userId, updatedSummary, sessionId);

    // Prepare enhanced response
    const response: ChatResponse = {
      response: finalResponseText,
      executedTools: finalExecutedTools.map((tool, idx) => ({
        name: tool.toolName,
        args: tool.args,
        toolCallId: tool.toolCallId,
        stepNumber: idx + 1,
      })),
      requiredConnections: finalRequiredConnections.length > 0 ? finalRequiredConnections : undefined,
      conversationHistory: getConversationHistory(userId, sessionId),
      executionPlan,
      conversationSummary: updatedSummary,
    };

    console.log("Enhanced response with dynamic summary generated successfully");
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Enhanced API Error in chat orchestration:", error);
    return NextResponse.json(
      {
        response: "I encountered an error while processing your request. Please try again.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}


async function prepareEnhancedTools(
  appNames: string[],
  stepToolMappings: {
    stepNumber: number;
    appName: string;
    toolNames: string[];
  }[],
  userQuery: string,
  userId: string,
  req: Request
): Promise<{ tools: ToolSet; requiredConnections: string[] }> {
  let fetchedComposioTools: ToolSet = {};
  const appsNeedingConnection: string[] = [];

  // Mock function - replace with your actual implementation
  async function getConnectedAccountIdForUserAndApp(
    userId: string,
    appName: string
  ): Promise<string> {
    const mockConnectedAccountMap: { [key: string]: string } = {
      GMAIL: "mock_gmail_conn_id_123",
      GOOGLECALENDAR: "c9e13275-ed69-4e56-855b-f9399e3e412a",
      GOOGLEDRIVE: "mock_drive_conn_id_123",
      NOTION: "mock_notion_conn_id_123",
      GOOGLEDOCS: "8e0f132c-a72b-46a2-951a-8c57b859e532",
    };
    return mockConnectedAccountMap[appName] || "";
  }

  // Process each app
  for (const appName of appNames) {
    const connectedAccountId = await getConnectedAccountIdForUserAndApp(
      userId,
      appName
    );

    if (!connectedAccountId) {
      appsNeedingConnection.push(appName);
      continue;
    }

    // Verify connection status
    const connectionStatusResult = await getComposioConnectionStatus(
      connectedAccountId
    );
    if (
      connectionStatusResult.status !== "INITIATED" &&
      connectionStatusResult.status !== "ACTIVE"
    ) {
      appsNeedingConnection.push(appName);
      continue;
    }

    // Get tools for this app from step mappings
    const appStepMappings = stepToolMappings.filter(
      (mapping) => mapping.appName === appName
    );
    const allToolsForApp = appStepMappings.flatMap(
      (mapping) => mapping.toolNames
    );
    const uniqueToolsForApp = [...new Set(allToolsForApp)];

    if (uniqueToolsForApp.length === 0) {
      // Fallback to semantic search if no specific tools found
      try {
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
          uniqueToolsForApp.push(...pineconeSearchRes.relevantTools);
        }
      } catch (error) {
        console.warn(`Semantic search fallback failed for ${appName}:`, error);
      }
    }

    // Fetch tools if available
    if (uniqueToolsForApp.length > 0) {
      try {
        const tools = (await getComposioTool(uniqueToolsForApp)) as ToolSet;
        fetchedComposioTools = { ...fetchedComposioTools, ...tools };
        console.log(
          `Enhanced: Fetched ${Object.keys(tools).length} tools for ${appName}`
        );
      } catch (error) {
        console.error(`Error fetching enhanced tools for ${appName}:`, error);
      }
    }
  }

  return {
    tools: fetchedComposioTools,
    requiredConnections: appsNeedingConnection,
  };
}




// // Add this at the top of the file
// const toolSearchCache = new Map<string, string[]>();

// // Modified prepareEnhancedTools function
// async function prepareEnhancedTools(
//     appNames: string[],
//     stepToolMappings: { stepNumber: number; appName: string; toolNames: string[] }[],
//     userQuery: string,
//     userId: string,
//     req: Request
// ): Promise<{ tools: ToolSet; requiredConnections: string[] }> {
//     let fetchedComposioTools: ToolSet = {};
//     const appsNeedingConnection: string[] = [];

//     for (const appName of appNames) {
//         // ... existing connection checks ...

//         // Get tools from step mappings first
//         const appStepMappings = stepToolMappings.filter(
//             (mapping) => mapping.appName === appName
//         );
//         let uniqueToolsForApp = [...new Set(
//             appStepMappings.flatMap((mapping) => mapping.toolNames)
//         )];

//         // Only do search if no tools found and not already cached
//         if (uniqueToolsForApp.length === 0 && !toolSearchCache.has(appName + userQuery)) {
//             try {
//                 const searchToolsApiUrl = new URL("/api/agent/tools/search", req.url).toString();
//                 const res = await fetch(searchToolsApiUrl, {
//                     method: "POST",
//                     headers: { "Content-Type": "application/json" },
//                     body: JSON.stringify({ appName, userQuery, topK: 5 }),
//                 });

//                 if (res.ok) {
//                     const pineconeSearchRes = await res.json();
//                     uniqueToolsForApp = pineconeSearchRes.relevantTools;
//                     toolSearchCache.set(appName + userQuery, uniqueToolsForApp);
//                 }
//             } catch (error) {
//                 console.warn(`Tool search failed for ${appName}:`, error);
//             }
//         } else if (toolSearchCache.has(appName + userQuery)) {
//             uniqueToolsForApp = toolSearchCache.get(appName + userQuery) || [];
//         }

//         // ... rest of the function ...
//     }
    
//     return { tools: fetchedComposioTools, requiredConnections: appsNeedingConnection };
// }


