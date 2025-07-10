// app/api/tools/route.ts

// app/api/composio/app-tools/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getComposioAppTools } from "@/lib/agent-backend/composioService"; // Adjust path based on your actual structure

/**
 * Route Handler for fetching Composio tools for a specific app.
 * Accessible at /api/composio/app-tools?appName=YOUR_APP_NAME
 */
export async function GET(request: NextRequest) {
  // Get the URL object from the request
  // const { searchParams } = new URL(request.url);

  // Extract the 'appName' query parameter
  // const appName = searchParams.get('appName');
  const appName = "NOTION";

  // Validate appName
  if (!appName) {
    return NextResponse.json(
      { message: 'Missing "appName" query parameter.' },
      { status: 400 }
    );
  }

  try {
    const tools = await getComposioAppTools(appName);
    // Transform tools to only include name and description
    // Assuming tools is an object with tool names as keys
    // and each value has a 'description' property
    const filteredTools: Record<string, { description: string }> = {};

    for (const [toolName, toolObj] of Object.entries(tools)) {
      filteredTools[toolName] = { description: toolObj.description };
    }

    // Return in the format: { "GMAIL": { ...tools } }
    return NextResponse.json({ [appName]: filteredTools }, { status: 200 });
  } catch (error) {
    console.error(
      `API Error: Failed to fetch Composio app tools for ${appName}:`,
      error
    );

    // Return an error response
    return NextResponse.json(
      {
        message: "Failed to fetch Composio app tools.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}






// import { NextRequest, NextResponse } from 'next/server';
// import { getAvailableComposioTools } from '@/lib/agent-backend/composioService';
// // Removed Firebase imports as per the simplified POC plan.

// /**
//  * Handles GET requests to retrieve the list of available tools.
//  * For this stateless POC, it does not determine installation status;
//  * that will be managed on the client-side.
//  *
//  * @returns A JSON response with available tool data or an error.
//  */
// export async function GET(req: NextRequest) {
//   try {
//     // Get the static list of available tools from the Composio service.
//     // No userId is needed here as we are not checking for installed status on backend.
//     const tools = await getAvailableComposioTools();
//     return NextResponse.json({ success: true, tools }, { status: 200 });
//   } catch (error) {
//     console.error(`API Error /api/tools GET:`, error);
//     return NextResponse.json({ success: false, error: `Failed to retrieve tools: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
//   }
// }
