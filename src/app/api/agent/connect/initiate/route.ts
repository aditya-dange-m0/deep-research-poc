// app/api/composio/initiate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { initiateComposioConnection } from "@/lib/agent-backend/composioService";

const initiateRequestSchema = z.object({
  appName: z.string().min(1, { message: "appName is required." }),
  userId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Validate the incoming request body against our schem

    const { appName, userId } = body;
    console.log(
      `Received connection initiation request for app: ${appName}, user session: ${userId}`
    );

    // 2. Call your composioService function to get the OAuth URL
    const connectionRequest = await initiateComposioConnection(userId, appName);

    console.log(
      `------------------------------------------------------------------------------------------------------------------------`
    );
     console.log(
      `${connectionRequest.connectedAccountId}   ---------------------------------------------------------`
    );
     console.log(
      `------------------------------------------------------------------------------------------------------------------------`
    );
    // // 3. Check for the redirectUrl and return it
    if (connectionRequest.redirectUrl) {
      return NextResponse.json({
        success: true,
        redirectUrl: connectionRequest.redirectUrl,
        connectedAccountId: connectionRequest.connectedAccountId, // Send this back too, useful for the callback
      });
    } else {
      console.warn(
        "Composio did not return a redirectUrl. This might indicate an immediate connection or an issue."
      );
      return NextResponse.json({
        success: true,
        message: "Connection initiated without a redirect.",
        connectedAccountId: connectionRequest.connectedAccountId,
      });
    }
  } catch (error) {
    console.error("[API/CONNECT/INITIATE] Error:", error);
    // Return a generic server error response
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to initiate connection: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
