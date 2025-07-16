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



// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { generateText, generateObject, ToolSet, CoreMessage } from 'ai';
import { openai } from '@ai-sdk/openai';

// Your existing services/utils
import { initializePineconeIndex, getComposioAppToolsFromPinecone } from '@/lib/pineconeInit';
import { LLMRoutingResponse } from '@/services/llm_app_router_service';
import {
  getComposioAppTools,
  getComposioTool,
  getComposioConnectionStatus,
  executeComposioAction,
  enableComposioConnection
} from '@/lib/agent-backend/composioService';
import { ComposioToolSet } from "composio-core";

const AGENT_LLM_MODEL = 'gpt-4o-mini';
const MAX_AGENT_STEPS = 5;
const MAX_CONVERSATION_HISTORY = 10; // Keep last 10 messages

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: { name: string; args: any; result?: any }[];
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
  }[];
  requiredConnections?: string[];
  conversationHistory?: ChatMessage[];
  error?: string;
}

// In-memory conversation store (replace with your preferred storage)
const conversationStore = new Map<string, ChatMessage[]>();

function getConversationKey(userId: string, sessionId?: string): string {
  return sessionId ? `${userId}:${sessionId}` : userId;
}

function getConversationHistory(userId: string, sessionId?: string): ChatMessage[] {
  const key = getConversationKey(userId, sessionId);
  return conversationStore.get(key) || [];
}

function updateConversationHistory(userId: string, message: ChatMessage, sessionId?: string): void {
  const key = getConversationKey(userId, sessionId);
  const history = conversationStore.get(key) || [];
  history.push(message);
  
  // Keep only recent messages
  if (history.length > MAX_CONVERSATION_HISTORY) {
    history.splice(0, history.length - MAX_CONVERSATION_HISTORY);
  }
  
  conversationStore.set(key, history);
}

function buildContextualPrompt(userQuery: string, conversationHistory: ChatMessage[], hasTools: boolean): string {
  const baseSystemPrompt = `You are an advanced AI assistant with comprehensive world knowledge and access to specialized tools when needed.

**Your Core Capabilities:**
1. **Extensive Knowledge**: You have deep knowledge about virtually any topic - science, history, culture, technology, etc.
2. **Specialized Tools**: You have access to various applications and services that can perform specific actions
3. **Context Awareness**: You maintain conversation context and build meaningful relationships with users
4. **Advanced Reasoning**: You can analyze, synthesize, and solve complex problems

**Tool Usage Philosophy:**
- Use tools when they provide real-time data, perform specific actions, or access external services
- For general knowledge, explanations, analysis, and reasoning - rely on your extensive training
- Examples of tool usage: sending emails, scheduling meetings, searching files, getting current data
- Examples of knowledge usage: explaining concepts, creative writing, problem-solving, analysis

**Response Guidelines:**
- Be helpful, accurate, and naturally conversational
- Consider previous conversation context
- If uncertain about something, acknowledge it honestly
- Provide comprehensive responses that fully address the user's needs
- Ask follow-up questions when clarification would be helpful`;

  let contextualPrompt = baseSystemPrompt;

  // Add conversation context if available
  if (conversationHistory.length > 0) {
    contextualPrompt += `\n\n**Previous Conversation Context:**\n`;
    conversationHistory.slice(-4).forEach((msg, index) => {
      if (msg.role === 'user') {
        contextualPrompt += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        contextualPrompt += `Assistant: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}\n`;
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          contextualPrompt += `(Tools used: ${msg.toolCalls.map(t => t.name).join(', ')})\n`;
        }
      }
    });
  }

  // Add current query
  contextualPrompt += `\n\n**Current User Request:** "${userQuery}"\n\n`;

  // Add tool availability context
  if (hasTools) {
    contextualPrompt += `**Available Tools:** You have access to specialized tools for this request. Consider whether they would enhance your response with real-time data or specific actions.\n\n`;
  }

  contextualPrompt += `**Your Task:** Respond to the user's request in the most helpful way possible. Use tools if they add value, otherwise rely on your knowledge and reasoning capabilities.`;

  return contextualPrompt;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('Received request body:', body);

    const { userQuery, userId, conversationHistory, sessionId } = body.body || body;
    console.log('Extracted data:', { userQuery, userId, sessionId });

    if (!userQuery || !userId) {
      console.error('Invalid request body:', { body, userQuery, userId });
      return NextResponse.json(
        { 
          response: 'Missing userQuery or userId in request body.',
          error: 'INVALID_REQUEST'
        },
        { status: 400 }
      );
    }

    const trimmedQuery = userQuery.trim();
    const trimmedUserId = userId.trim();

    if (!trimmedQuery || !trimmedUserId) {
      console.error('Empty values after trimming:', { trimmedQuery, trimmedUserId });
      return NextResponse.json(
        { 
          response: 'userQuery or userId cannot be empty.',
          error: 'INVALID_REQUEST'
        },
        { status: 400 }
      );
    }

    console.log(`--- Chat Request for user ${userId} ---`);
    console.log(`Query: "${userQuery}"`);

    // Get conversation history
    const existingHistory = conversationHistory || getConversationHistory(userId, sessionId);
    console.log(`Conversation history length: ${existingHistory.length}`);

    // Add current user message to history
    const userMessage: ChatMessage = {
      role: 'user',
      content: userQuery,
      timestamp: Date.now()
    };

    // Initialize services
    await initializePineconeIndex();

    // Always attempt tool routing first - let the routing service decide
    let fetchedComposioTools: ToolSet = {};
    let hasTools = false;
    let requiredConnections: string[] = [];

    try {
      const routeAppsApiUrl = new URL('/api/agent/route-apps', req.url).toString();
      const routingRes = await fetch(routeAppsApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuery }),
      });

      if (routingRes.ok) {
        const { appNames, toolNames } = (await routingRes.json()) as LLMRoutingResponse;
        console.log(`Routing Decisions - Apps: ${JSON.stringify(appNames)}, Tools: ${JSON.stringify(toolNames)}`);

        if (appNames.length > 0) {
          const toolResult = await prepareTools(appNames, toolNames, userQuery, userId, req);
          fetchedComposioTools = toolResult.tools;
          hasTools = Object.keys(fetchedComposioTools).length > 0;
          requiredConnections = toolResult.requiredConnections;
          console.log(`Tools prepared: ${hasTools}, Tool count: ${Object.keys(fetchedComposioTools).length}`);
        } else {
          console.log('No apps identified by routing service - proceeding with general knowledge');
        }
      } else {
        console.warn('Tool routing API failed, proceeding with general knowledge');
      }
    } catch (error) {
      console.warn('Tool routing failed, falling back to general knowledge:', error);
    }

    // Build contextual prompt
    const contextualPrompt = buildContextualPrompt(userQuery, existingHistory, hasTools);
    console.log('Generated contextual prompt length:', contextualPrompt.length);

    // Generate response with appropriate tool configuration
    const currentLlmResponse = await generateText({
      model: openai(AGENT_LLM_MODEL),
      prompt: contextualPrompt,
      tools: hasTools ? fetchedComposioTools : undefined,
      toolChoice: hasTools ? 'auto' : undefined, // Let the model decide when to use tools
      temperature: 0.7,
      maxSteps: MAX_AGENT_STEPS, // Always allow multiple steps for complex queries
    });

    console.log(`Response generated. Tool calls made: ${currentLlmResponse.toolCalls?.length || 0}`);

    const responseText = currentLlmResponse.text || "I've processed your request.";
    const toolCalls = currentLlmResponse.toolCalls || [];

    // Create assistant message
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: responseText,
      timestamp: Date.now(),
      toolCalls: toolCalls.map(tool => ({
        name: tool.toolName,
        args: tool.args
      }))
    };

    // Update conversation history
    updateConversationHistory(userId, userMessage, sessionId);
    updateConversationHistory(userId, assistantMessage, sessionId);

    // Prepare response
    const response: ChatResponse = {
      response: responseText,
      executedTools: toolCalls.map(tool => ({
        name: tool.toolName,
        args: tool.args
      })),
      requiredConnections: requiredConnections.length > 0 ? requiredConnections : undefined,
      conversationHistory: getConversationHistory(userId, sessionId)
    };

    console.log('Final response generated successfully');
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('API Error in chat orchestration:', error);
    return NextResponse.json(
      { 
        response: 'I encountered an error while processing your request. Please try again.', 
        error: error.message 
      },
      { status: 500 }
    );
  }
}

// Remove the checkIfGeneralQuery function entirely since it was blocking tool calls

async function prepareTools(
  appNames: string[], 
  toolNames: string[], 
  userQuery: string, 
  userId: string, 
  req: Request
): Promise<{ tools: ToolSet; requiredConnections: string[] }> {
  let fetchedComposioTools: ToolSet = {};
  const appsNeedingConnection: string[] = [];
  const connectedAppsData: { appName: string; connectedAccountId: string; }[] = [];

  // Mock function - replace with your actual implementation
  async function getConnectedAccountIdForUserAndApp(userId: string, appName: string): Promise<string> {
    const mockConnectedAccountMap: { [key: string]: string } = {
      'GMAIL': 'mock_gmail_conn_id_123',
      'GOOGLECALENDAR': 'c9e13275-ed69-4e56-855b-f9399e3e412a',
      'GOOGLEDRIVE': 'mock_drive_conn_id_123',
      'NOTION': 'mock_notion_conn_id_123',
      'GOOGLEDOCS': '8e0f132c-a72b-46a2-951a-8c57b859e532',
    };
    return mockConnectedAccountMap[appName] || '';
  }

  for (const appName of appNames) {
    const connectedAccountId = await getConnectedAccountIdForUserAndApp(userId, appName);
    
    if (!connectedAccountId) {
      appsNeedingConnection.push(appName);
      console.warn(`App ${appName} is NOT connected for user ${userId}. Skipping tool collection.`);
      continue;
    }

    // Verify connection status with Composio
    const connectionStatusResult = await getComposioConnectionStatus(connectedAccountId);
    console.log(`Connection status for ${appName} (${connectedAccountId}):`, connectionStatusResult.status);
    
    if (connectionStatusResult.status !== 'INITIATED' && connectionStatusResult.status !== 'ACTIVE') {
      appsNeedingConnection.push(appName);
      console.warn(`Composio reports ${appName} connection ${connectedAccountId} is NOT active. Skipping tool collection.`);
      continue;
    }

    connectedAppsData.push({ appName, connectedAccountId });
    console.log(`App ${appName} is CONNECTED with ID: ${connectedAccountId}`);

    let toolsToFetchForApp: string[] = [];
    const hasSpecificTools = toolNames.some(t => t.startsWith(`${appName}_`));

    if (hasSpecificTools) {
      // LLM suggested specific tools, filter them for this app
      toolsToFetchForApp = toolNames.filter(t => t.startsWith(`${appName}_`));
      console.log(`Fetching specific tools for ${appName}:`, toolsToFetchForApp);
    } else {
      // No specific tools suggested, perform semantic search
      console.log(`No specific tools suggested for ${appName}. Performing semantic search...`);
      try {
        const searchToolsApiUrl = new URL('/api/agent/tools/search', req.url).toString();
        const res = await fetch(searchToolsApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appName, userQuery, topK: 5 }),
        });
        
        if (res.ok) {
          const pineconeSearchRes = await res.json();
          toolsToFetchForApp = pineconeSearchRes.relevantTools;
          console.log(`Semantic search for ${appName} returned:`, toolsToFetchForApp);
        } else {
          console.warn(`Semantic search failed for ${appName}:`, res.statusText);
        }
      } catch (error) {
        console.warn(`Semantic search error for ${appName}:`, error);
      }
    }

    if (toolsToFetchForApp.length > 0) {
      try {
        const tools = await getComposioTool(toolsToFetchForApp) as ToolSet;
        fetchedComposioTools = { ...fetchedComposioTools, ...tools };
        console.log(`Successfully fetched ${Object.keys(tools).length} tools for ${appName}`);
      } catch (error) {
        console.error(`Error fetching tools for ${appName}:`, error);
      }
    }
  }

  console.log(`Total tools prepared: ${Object.keys(fetchedComposioTools).length}`);
  console.log(`Apps needing connection: ${appsNeedingConnection.length}`);
  
  return { tools: fetchedComposioTools, requiredConnections: appsNeedingConnection };
}