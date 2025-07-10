// src/app/api/route-apps/route.ts
import { NextResponse } from 'next/server';
import { initializePineconeIndex } from '@/lib/pineconeInit';
import { routeAppsWithLLM, LLMRoutingResponse } from '@/services/llm_app_router_service';

interface RouteAppsRequestBody {
  userQuery: string;
}

// The response structure directly matches LLMRoutingResponse
interface RouteAppsAPIResponse extends LLMRoutingResponse {
  message?: string;
  error?: string;
}

export async function POST(req: Request) {
  try {
    // Ensure Pinecone (and thus LLM client for embeddings) is initialized
    await initializePineconeIndex();

    const { userQuery } = (await req.json()) as RouteAppsRequestBody;

    if (!userQuery) {
      return NextResponse.json(
        { appNames: [], toolNames: [], message: 'Missing userQuery in request body.' },
        { status: 400 }
      );
    }

    // Call the LLM service to get routing decisions
    const { appNames, toolNames } = await routeAppsWithLLM(userQuery);

    return NextResponse.json(
      {
        appNames: appNames,
        toolNames: toolNames,
        message: `Identified ${appNames.length} app(s) and ${toolNames.length} necessary tool(s) from top tools.`
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API Error during app routing:', error);
    return NextResponse.json(
      { appNames: [], toolNames: [], message: 'Failed to route apps', error: error.message },
      { status: 500 }
    );
  }
}