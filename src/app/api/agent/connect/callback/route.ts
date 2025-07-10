// app/api/composio/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { VercelAIToolSet } from "composio-core"; // Make sure to import VercelAIToolSet here
import { getComposioConnectionStatus } from "@/lib/agent-backend/composioService"

const COMPOSIO_API_KEY =
  process.env.COMPOSIO_API_KEY || "sh6ezs034ez0pxtd7akxs"; // Ensure this is set
const toolset = new VercelAIToolSet({ apiKey: COMPOSIO_API_KEY });

export async function POST(req: NextRequest) {
  // const { searchParams } = new URL(req.url);
  // const connectedAccountId = searchParams.get("connectedAccountId");
  // const error = searchParams.get("error"); // Composio might pass error params

  // console.log(`Received Composio callback for connectedAccountId: ${connectedAccountId}`);
  const body = await req.json();
  const {connectedAccountId} = body;
  try {
    const activeConnection = await getComposioConnectionStatus(connectedAccountId)
    console.log("connection.status: ",activeConnection.status)

    // const userId = "default";

    // console.log(`Waiting for connection ${connectedAccountId} to become active...`)

    // // Redirect the user's browser back to your frontend success page
    // const frontendSuccessUrl = `${process.env.NEXT_PUBLIC_FRONTEND_BASE_URL}/connection-success?accountId=${activeConnection.id}&status=active`;
    return NextResponse.json({
      success:true,
      id:activeConnection.id,
      status:activeConnection.status
    });
    // return NextResponse.redirect(frontendSuccessUrl);
  } catch (err) {
    console.error(
      // `Error processing Composio callback for ${connectedAccountId}:`,
      err
    );
    // Redirect to a frontend error page
    const errorMessage = err instanceof Error ? err.message : String(err);
    const frontendErrorUrl = `${
      process.env.NEXT_PUBLIC_FRONTEND_BASE_URL
    }/connection-error?message=${encodeURIComponent(
      "Failed to activate connection: " + errorMessage
    )}`;
    return NextResponse.redirect(frontendErrorUrl);
  }
}
