// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { generateText, generateObject,ToolSet,CoreMessage } from 'ai';
import { openai } from '@ai-sdk/openai';

// Your existing services/utils
import { initializePineconeIndex, getComposioAppToolsFromPinecone } from '@/lib/pineconeInit'; // Renamed initializePineconeClient to initializePineconeIndex as per your code
import { LLMRoutingResponse } from '@/services/llm_app_router_service'; // Assuming Zod version
import {
  getComposioAppTools, // To get all tools for an app (when semantic search is needed)
  getComposioTool,    // To get specific tool definitions (when top tools are identified)
  getComposioConnectionStatus,
  executeComposioAction,
  enableComposioConnection
} from '@/lib/agent-backend/composioService'; // Corrected path to Composio service
// import { Tool } from '@/types/types'; // Import your Tool type
import { ComposioToolSet } from "composio-core";
import { CloudRainWind } from 'lucide-react';
const AGENT_LLM_MODEL = 'gpt-4o-mini'; // Or a more capable model like 'gpt-4o' for complex reasoning
const MAX_AGENT_STEPS = 5;

interface ChatRequestBody {
  userQuery: string;
  userId: string;
  // If you maintain chat history, add: chatHistory?: { role: 'user' | 'assistant' | 'tool', content: string }[];
}

interface ChatResponse {
  response: string;
  executedTools?: { name: string; output: any; }[]; // Store executed tool name and its output
  requiredConnections?: string[]; // List of appNames that need connection
  error?: string;
}

export async function POST(req: Request) {
  try {
    // 1. Initialize services (Pinecone index)
    await initializePineconeIndex();

    const { userQuery, userId } = (await req.json()) as ChatRequestBody;

    if (!userQuery || !userId) {
      return NextResponse.json(
        { response: 'Missing userQuery or userId in request body.' },
        { status: 400 }
      );
    }

    console.log(`--- Chat Request for user ${userId} ---`);
    console.log(`Query: "${userQuery}"`);

    // 2. Initial App Routing (using /api/agent/route-apps)
    const routeAppsApiUrl = new URL('/api/agent/route-apps', req.url).toString();
    const routingRes = await fetch(routeAppsApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userQuery }),
    });

    if (!routingRes.ok) {
      const errorData = await routingRes.json();
      throw new Error(`Failed to route apps: ${errorData.message || routingRes.statusText}`);
    }
    const { appNames, toolNames } = (await routingRes.json()) as LLMRoutingResponse;
    console.log(`  Routing Decisions - Apps: ${JSON.stringify(appNames)}, Tools (top): ${JSON.stringify(toolNames)}`);

    if (appNames.length === 0) {
      return NextResponse.json({ response: "I couldn't identify any relevant applications for your request." }, { status: 200 });
    }

    // 3. Gather Full Tool Definitions & Check Connections
    let fetchedComposioTools: ToolSet = {};
    const appsNeedingConnection: string[] = [];
    const connectedAppsData: { appName: string; connectedAccountId: string; }[] = [];

    // --- MOCK: getConnectedAccountIdForUserAndApp ---
    // In a real app, this would query your persistent storage
    // to retrieve the connectedAccountId associated with userId and appName.
    async function getConnectedAccountIdForUserAndApp(userId: string, appName: string): Promise<string> {
      // For POC, return a consistent mock ID.
      const mockConnectedAccountMap: { [key: string]: string } = {
        'GMAIL': 'mock_gmail_conn_id_123',
        'GOOGLECALENDAR': 'mock_calendar_conn_id_123',
        'GOOGLEDRIVE': 'mock_drive_conn_id_123',
        'NOTION': 'mock_notion_conn_id_123',
        'GOOGLEDOCS': '8e0f132c-a72b-46a2-951a-8c57b859e532',
        // Add more mocks as needed for testing
      };
      return mockConnectedAccountMap[`${appName}`];
    }
    // --- END MOCK ---

    for (const appName of appNames) {
      const connectedAccountId:string = await getConnectedAccountIdForUserAndApp(userId, appName);
      // const connectedID = await enableComposioConnection(connectedAccountId,appName)
      // console.log(`connectedID : ${connectedID?.connectionStatus}`)
      if (!connectedAccountId) {
        appsNeedingConnection.push(appName);
        console.warn(`  App ${appName} is NOT connected for user ${userId}. Skipping tool collection.`);
        continue;
      }

      // Verify connection status with Composio using the connectedAccountId
      const connectionStatusResult = await getComposioConnectionStatus(connectedAccountId);
      console.warn(`connectionStatusResult : ${JSON.stringify(connectionStatusResult.status)}`)
      if (connectionStatusResult.status !== 'INITIATED' && connectionStatusResult.status !== 'ACTIVE') {
        appsNeedingConnection.push(appName);
        console.warn(`  Composio reports ${appName} connection ${connectedAccountId} is NOT active/connected. Skipping tool collection.`);
        continue;
      }

      connectedAppsData.push({ appName, connectedAccountId });
      console.log(`  App ${appName} is CONNECTED with ID: ${connectedAccountId}.`);

      let toolsToFetchForApp: string[] = [];
      const hasSpecificTools = toolNames.some(t => t.startsWith(`${appName}_`));

      if (hasSpecificTools) {
        // LLM suggested specific top tools, filter them for this app
        toolsToFetchForApp = toolNames.filter(t => t.startsWith(`${appName}_`));
        console.log(`Fetching specific top tools: ${JSON.stringify(toolsToFetchForApp)}`);
      } else {
        // LLM suggested no specific tools or a broader search is needed for this app
        console.log(`    No specific top tools suggested for ${appName}. Performing semantic search...`);
        const pineconeSearchRes = await (async () => {
          const searchToolsApiUrl = new URL('/api/agent/tools/search', req.url).toString();
          const res = await fetch(searchToolsApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appName, userQuery, topK: 5 }), // Fetch top 5
          });
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(`Failed semantic search for ${appName}: ${errorData.message || res.statusText}`);
          }
          return res.json();
        })();
        toolsToFetchForApp = pineconeSearchRes.relevantTools;
        console.log(`    Semantic search for ${appName} returned: ${JSON.stringify(toolsToFetchForApp)}`);
      }

      if (toolsToFetchForApp.length > 0) {
        
        // Fetch full tool definitions using getComposioTool
        fetchedComposioTools = await getComposioTool(toolsToFetchForApp) as ToolSet;
        console.log(fetchedComposioTools)
        // Composio's getTools returns an array of objects. We need to format them for AI SDK/OpenAI.
        // Ensure that `tool.parameters` is the direct JSON schema object.
        // fetchedComposioTools.forEach(tool => {
        //   toolsForAgentLLM.push({
        //     name: tool.name, // Use 'name' property from Composio tool as AI SDK expects it
        //     description: tool.description,
        //     parameters: tool.parameters, // This should already be the JSON Schema object
        //   });
        // });
      }
    }

    // if (appsNeedingConnection.length > 0) {
    //   const responseMessage = `To help with your request, please connect your ${appsNeedingConnection.join(', ')} account(s). You can initiate the connection via the API: \`/api/agent/connect/initiate\`.`;
    //   return NextResponse.json({ response: responseMessage, requiredConnections: appsNeedingConnection }, { status: 200 });
    // }

    // Check if there are any tools by inspecting the keys of the object
    const hasTools = Object.keys(fetchedComposioTools).length > 0;
    console.log("hasTools ::::",hasTools)
    if (!hasTools) { // Use the hasTools boolean
      return NextResponse.json({ response: "I couldn't find any relevant tools for your request that are currently connected." }, { status: 200 });
    }

    // console.log(`  Final tools prepared for Agent LLM: ${fetchedComposioTools.map(t => t.description).join(', ')}`);

    // 4. Tool-Calling LLM Decision & Execution (using Vercel AI SDK with maxSteps)
// Define the enhanced system instruction and prompt structure
const enhancedPrompt = `You are a highly capable AI assistant designed to understand user requests, utilize available tools efficiently, and provide concise, helpful responses.

**Your Task:**
1.  **Analyze the User's Request:** Carefully understand the intent and requirements of the user's query.
2.  **Tool Selection (if necessary):** Determine if any of the provided tools are needed to fulfill the request. If so, select the appropriate tool(s).
3.  **Tool Execution:** Call the chosen tool(s) with the correct parameters. If multiple tools are required, execute them sequentially or in parallel as appropriate for the task.
4.  **Response Generation:** After tool execution (or if no tool is needed), synthesize the information and provide a clear, concise, and helpful natural language response to the user, summarizing the outcome or directly answering their query.

---

**Original User Query:** "${userQuery}"`; // Integrates userQuery directly into the prompt

    console.log("fetchedComposioTools ::::",fetchedComposioTools)
    console.log("Before reduce - fetchedComposioTools content:", fetchedComposioTools);
    console.log("Before reduce - Is fetchedComposioTools an array?", Array.isArray(fetchedComposioTools));

    // Call generateText ONCE, letting it manage the multi-step process with maxSteps
    const currentLlmResponse = await generateText({
      model: openai(AGENT_LLM_MODEL),
      prompt: enhancedPrompt, // Pass the enhanced prompt string
      tools: hasTools ? fetchedComposioTools : undefined,
      toolChoice: 'auto',
      temperature: 0.5,
      maxSteps: MAX_AGENT_STEPS, // This is where the magic happens!
    });
    // const currentLlmResponse = "Hi"
    // 5. Final Response Generation (after maxSteps has completed its internal loop)
    // let finalAgentResponse: string;
    // // Placeholder for executed tools log; populate as needed
    // const executedToolsLog: { name: string; output: any; }[] = [];

    // if (currentLlmResponse.text) {
    //   finalAgentResponse = currentLlmResponse.text;
    // } else if (currentLlmResponse.toolCalls && currentLlmResponse.toolCalls.length > 0) {
    //   // This means maxSteps was reached while the LLM was still trying to call tools.
    //   // We need to inform the user or try to get a summary from the LLM.
    //   console.warn(`  Max steps (${MAX_AGENT_STEPS}) reached while LLM was still making tool calls.`);
      
    //   // Optionally, make one final LLM call to summarize based on the `messages` history
    //   // which `generateText` internally updated with tool outputs up to `maxSteps`.
    //   const finalSummaryMessages: CoreMessage[] = [...messages, {
    //     role: 'assistant',
    //     content: `I reached my maximum processing steps. The last tool calls were: ${currentLlmResponse.toolCalls.map(tc => tc.toolName).join(', ')}. tool_calls: ${currentLlmResponse.toolCalls}`,
    //   }];
    //   const finalCompletion = await generateText({
    //     model: openai(AGENT_LLM_MODEL),
    //     messages: finalSummaryMessages,
    //     temperature: 0.7,
    //   });
    //   finalAgentResponse = finalCompletion.text || "I was processing your request, but hit a limit. Please check the logs for more details or try rephrasing your request.";

    // } else {
    //   // Fallback if LLM didn't produce text and no tool calls were made (unlikely with 'auto' tool_choice)
    //   finalAgentResponse = "I have processed your request, but cannot provide a detailed summary at this moment.";
    // }

    // console.log(`--- Final Agent Response ---`);
    // console.log(finalAgentResponse);

    return NextResponse.json(
      { response: currentLlmResponse },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API Error in chat orchestration:', error);
    return NextResponse.json(
      { response: 'An internal error occurred while processing your request.', error: error.message },
      { status: 500 }
    );
  }
}