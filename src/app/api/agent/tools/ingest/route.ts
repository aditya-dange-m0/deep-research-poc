// pages/api/tools/ingest.ts
import { NextResponse } from "next/server";
import {
  ingestComposioAppToolsToPinecone,
  initializePineconeIndex,
} from "@/lib/pineconeInit";
import { getComposioAppTools } from "@/lib/agent-backend/composioService"; // Assuming this fetches from Composio directly
import { ToolsObject } from "@/types/types";

type IngestRequestBody = {
  appName: string;
  // In a real scenario, you might pass the full tools here,
  // or trigger the Composio fetch internally.
  // For this example, we'll fetch them internally for simplicity.
};

export async function POST(req: Request) {
  try {
    // Initialize Pinecone client and index (will only run if not already initialized)
    await initializePineconeIndex();

    const { appName } = await req.json(); // Use req.json() to parse the body in App Router

    if (!appName) {
      return NextResponse.json(
        { message: "Missing appName in request body." },
        { status: 400 }
      );
    }

    // 1. Fetch the full tool definitions from Composio (or your source)
    const fullTools = (await getComposioAppTools(appName)) as ToolsObject;
    console.log("fullTool", fullTools);

    // 2. Ingest these tools into Pinecone
    await ingestComposioAppToolsToPinecone(appName, fullTools);

    return NextResponse.json(
      { message: `Successfully ingested tools for app: ${appName}` },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`API Error during tool ingestion:`, error);
    return NextResponse.json(
      { message: "Failed to ingest tools", error: error.message },
      { status: 500 }
    );
  }
}

// export default async function POST(
//   req: NextApiRequest,
//   res: NextApiResponse
// ) {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ message: 'Method Not Allowed' });
//   }
//   await initializePineconeIndex();
//   const { appName } = req.body as IngestRequestBody;

//   if (!appName) {
//     return res.status(400).json({ message: 'Missing appName in request body.' });
//   }

//   try {
//     // 1. Fetch the full tool definitions from Composio (or your source)
//     //    This is the function you provided that returns the ToolsObject
//     const fullTools = await getComposioAppTools(appName) as ToolsObject;

//     // 2. Ingest these tools into Pinecone
//     await ingestComposioAppToolsToPinecone(appName, fullTools);

//     res.status(200).json({ message: `Successfully ingested tools for app: ${appName}` });
//   } catch (error: any) {
//     console.error(`API Error during tool ingestion for ${appName}:`, error);
//     res.status(500).json({ message: 'Failed to ingest tools', error: error.message });
//   }
// }
