// src/backend/composioService.ts

import { VercelAIToolSet, ConnectionRequest } from "composio-core";

// It's crucial to ensure COMPOSIO_API_KEY is set in your environment.
// In a Next.js API route, this would typically be accessed via process.env.COMPOSIO_API_KEY.
const COMPOSIO_API_KEY =
  process.env.COMPOSIO_API_KEY || "sh6ezs034ez0pxtd7akxs"; // Ensure this is set in your .env.local
if (!COMPOSIO_API_KEY) {
  console.error("No COMPOSIO_API_KEY found in environment variables.", {
    COMPOSIO_API_KEY,
  });
}
// Initialize the Composio ToolSet
// This instance will be reused across various Composio operations.
const toolset = new VercelAIToolSet({
  apiKey: COMPOSIO_API_KEY,
});

/**
 * Initiates a connection request to a specified application via Composio.
 * This is the first step in the OAuth flow, providing a redirect URL for the user.
 * For this POC, userId (Composio's entityId) is passed in and not persisted on backend.
 *
 * @param userId The ID of the user's session in your application (Composio's entityId).
 * @param appName The name of the application to connect (e.g., 'gmail', 'google-drive', 'notion').
 * @returns A Promise resolving to the ConnectionRequest object, which may contain a redirectUrl.
 * @throws Error if Composio API key is not configured or connection initiation fails.
 */

export async function initiateComposioConnection(
  userId: string, // This will be the session ID for the POC
  appName: string
): Promise<ConnectionRequest> {
  if (!COMPOSIO_API_KEY) {
    throw new Error(
      "Composio API key is not configured. Please set COMPOSIO_API_KEY environment variable."
    );
  }
  try {
    // const entity = await toolset.getEntity(userId);
    // console.log(`Composio entity retrieved/created for userId (session ID): ${userId}`);

    // // Initiate the connection. Composio will return a redirect URL for OAuth.
    // const connectionRequest = await entity.initiateConnection({
    //   appName: appName,
    // });
    // -------------------------------------------------------------------------------------
    // Get or create the entity for the user in Composio
    // Composio will use this userId as its entityId for the connection.
    // const entity = await toolset.getEntity(userId);
    // console.log(`Composio entity retrieved/created for userId (session ID): ${userId}`);

    // const integrationId = "f0b36145-a8a2-4d80-ad63-dbcd2d162a53";

    // // 1. Retrieve the integration details from Composio.
    // console.log(`Fetching integration details for ID: ${integrationId}...`);
    // const integration: any = await toolset.integrations.get({
    //   integrationId: integrationId,
    // });
    // console.log("Integration details fetched successfully.");

    // // 2. Get the required parameters for connecting to this integration.
    // const expectedInputFields = await toolset.integrations.getRequiredParams({
    //   integrationId: integration.id, // Pass the integration ID within an object
    // });
    // console.log("Expected input fields for connection:", expectedInputFields);

    // 3. Initiate the connection process for the Google Services.
    console.log(
      "Initiating connection to Google Services (entity: 'default')..."
    );
    const initialConnectedAccount = await toolset.connectedAccounts.initiate({
      appName: appName,
      entityId: userId || "default", // Using 'default' entity as per your previous error messages
    });

    let currentConnectedAccount = initialConnectedAccount

    console.log(
      `Initiated Composio connection for ${appName} for user ${userId}. Redirect URL: ${currentConnectedAccount.redirectUrl}`
    );
    console.log(
      `------------------------------------------------------------------------------------------------------------------------`
    );
     console.log(
      `${currentConnectedAccount.connectedAccountId}`
    );
     console.log(
      `------------------------------------------------------------------------------------------------------------------------`
    );
    return currentConnectedAccount;
  } catch (error) {
    console.error(
      `Failed to initiate Composio connection for ${appName} and user ${userId}:`,
      error
    );
    throw new Error(
      `Failed to initiate connection: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// You might keep this for later status checks, but it won't be used in the initial flow
export async function getComposioConnectionStatus(connectedAccountId: string) {
    if (!COMPOSIO_API_KEY) {
        throw new Error("Composio API key is not configured.");
    }
    try {
        const connection = await toolset.connectedAccounts.get({ connectedAccountId });
        return connection;
    } catch (error) {
        console.error(`Failed to get status for ${connectedAccountId}:`, error);
        throw new Error(`Failed to get connection status: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Executes a specific action on behalf of a user using a Composio connection.
 * For this POC, the connectedAccountId is passed directly from the frontend.
 *
 * @param userId The ID of the user's session (Composio's entityId).
 * @param connectedAccountId The Composio's ID for the active connection (obtained from OAuth callback).
 * @param action The specific Composio Action to execute (e.g., 'GMAIL_SEND_EMAIL', 'GOOGLE_DRIVE_CREATE_FILE').
 * @param params The parameters required for the action.
 * @returns A Promise resolving to the result of the action execution.
 * @throws Error if the action execution fails.
 */
export async function executeComposioAction(
  userId: string, // This will be the session ID for the POC
  connectedAccountId: string, // Passed from frontend
  action: string,
  params: any = {}
): Promise<any> {
  if (!COMPOSIO_API_KEY) {
    throw new Error("Composio API key is not configured.");
  }

  try {
    console.log(`Executing Composio action '${action}' for user ${userId} using connection ${connectedAccountId} with params:`, params);
    // Execute the action using the specific connectedAccountId
    const result = await toolset.executeAction({
      action: action,
      params: params,
      connectedAccountId: connectedAccountId, // Use connectedAccountId directly
      entityId: userId, // Still provide entityId for context
    });

    if (!result.successful) {
      console.error(`Composio action '${action}' failed for user ${userId} and connection ${connectedAccountId}:`, result.error);
      throw new Error(`Composio action failed: ${result.error || 'Unknown error'}`);
    }

    console.log(`Composio action '${action}' successful for user ${userId} and connection ${connectedAccountId}.`);
    return result.data;
  } catch (error) {
    console.error(`Error executing Composio action '${action}' for user ${userId} and connection ${connectedAccountId}:`, error);
    throw new Error(`Error during action execution: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Retrieves a list of available Composio applications that can be integrated.
 * This list is static for the POC.
 *
 * @returns An array of objects representing available tools.
 */
export async function getAvailableComposioTools(): Promise<{ name: string; appName: string; description: string; icon: string; }[]> {
  // This list is static for the POC.
  return [
    { name: "Google Super", appName: "GOOGLESUPER", description: "Access your Google Workspace Suite, including Gmail, Calendar, Drive, and more.", icon: "https://placehold.co/40x40/FF0000/FFFFFF?text=GS" },
    { name: "Gmail", appName: "GMAIL", description: "Access your Gmail inbox, read and send emails, and search through your messages.", icon: "https://placehold.co/40x40/EA4335/FFFFFF?text=GM" },
    { name: "Calendar", appName: "GOOGLECALENDAR", description: "Manage your Google Calendar events, set up appointments, and check your schedule.", icon: "https://placehold.co/40x40/4285F4/FFFFFF?text=GC" },
    { name: "Drive", appName: "GOOGLEDRIVE", description: "Access files stored in your Google Drive, upload documents, and share content.", icon: "https://placehold.co/40x40/34A853/FFFFFF?text=GD" },
    { name: "Notion", appName: "NOTION", description: "Access your Notion pages, create and edit content, and manage your workspace.", icon: "https://placehold.co/40x40/000000/FFFFFF?text=N" },
    { name: "Docs", appName: "GOOGLEDOCS", description: "Access files stored in your Google Drive, upload documents, and share content.", icon: "https://placehold.co/40x40/34A853/FFFFFF?text=GD" },
  ];
}

/**
 * Fetches specific tool definitions for a given application from Composio,
 * formatted for use with the Vercel AI SDK.
 *
 * @param appName The name of the application (e.g., 'gmail', 'github').
 * @param sessionId The current user's session ID (Composio's entityId).
 * @returns A Promise resolving to an array of tool definitions compatible with Vercel AI SDK.
 * @throws Error if Composio API key is not configured or tool fetching fails.
 */
export async function getComposioAppTools(appName: string): Promise<Object> {
  if (!COMPOSIO_API_KEY) {
    throw new Error("Composio API key is not configured.");
  }

  try {
    // Fetch default tools for the specified app, associated with the entityId
    // Composio's getTools returns tools in a format that needs to be adapted for Vercel AI SDK.
    // The `execute` function will be handled by our backend logic in chat route.
    const composioTools = await toolset.getTools({ apps: [appName]});
    console.log(`Fetched ${composioTools.length} tools for app: ${appName}`);

    return composioTools;
  } catch (error) {
    console.error(`Error fetching Composio tools for app ${appName}:`, error);
    throw new Error(`Failed to fetch Composio tools for ${appName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}


export async function getComposioTool(tools: string[]): Promise<Object> {
  if (!COMPOSIO_API_KEY) {
    throw new Error("Composio API key is not configured.");
  }
  
  try {
    // Fetch default tools for the specified app, associated with the entityId
    // Composio's getTools returns tools in a format that needs to be adapted for Vercel AI SDK.
    // The `execute` function will be handled by our backend logic in chat route.
    const fetchedTools = await toolset.getTools({ actions: tools });
    // console.log(`Fetched tools for app: ${toolName}`);
    return fetchedTools;
  } catch (error) {
    console.error(`Error fetching Composio tools for app `, error);
    throw new Error(`Failed to fetch Composio tools for  ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function enableComposioConnection(connectedAccountId: string,appName: string) {
  if (!connectedAccountId) {
    throw new Error("Composio connectedAccountId is not configured.");
  }
   try {
    const result = await initiateComposioConnection("default", appName);
    const connectedID = await toolset.connectedAccounts.reinitiateConnection({ connectedAccountId, data: {}, redirectUri :result.redirectUrl || undefined });
    return connectedID;
  } catch (error) {
    console.error(`Error enabling Composio connection for app `, error);
    // throw new Error(`Failed to enable Composio connection for app  ${error instanceof Error ? error.message : String(error)}`);
  }
}


// waitForConnectionActivation and getUserToolStatuses are removed/simplified
// as their functionality is either handled by the client or no longer needed without persistence.
