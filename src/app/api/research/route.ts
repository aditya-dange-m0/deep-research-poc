import { NextRequest, NextResponse } from 'next/server';
import { ResearchRequestSchema, SupportedModel } from '@/lib/types';
import { startResearch } from '../../../lib/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedBody = ResearchRequestSchema.safeParse(body);

    if (!validatedBody.success) {
      return NextResponse.json(validatedBody.error.format(), { status: 400 });
    }
    
    const { initialQuery, depth, breadth, model } = validatedBody.data;

    const modelToUse: SupportedModel = model || 'google:gemini-1.5-flash-latest';

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const onData = (data: any) => {
          const chunk = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        };
        
        try {
          await startResearch({ initialQuery, depth, breadth, model: modelToUse }, onData);
        } catch (error: any) {
            console.error("Orchestration error in stream:", error);
            const errorMessage = { type: 'error', data: error.message || 'An internal error occurred during orchestration.' };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
        } finally {
            // The 'done' message is now sent from the orchestrator, so we just close here.
            controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
}