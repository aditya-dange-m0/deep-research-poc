import { NextRequest, NextResponse } from 'next/server';
import { ResearchRequestSchema, SupportedModel } from '@/lib/types';
import { startResearch } from '../../../lib/orchestrator';

const STREAM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes hard cap

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedBody = ResearchRequestSchema.safeParse(body);

    if (!validatedBody.success) {
      return NextResponse.json(validatedBody.error.format(), { status: 400 });
    }
    
    const { initialQuery, depth, breadth, model } = validatedBody.data as { initialQuery: string; depth: number; breadth: number; model?: SupportedModel };

    const modelToUse: SupportedModel = model || 'google:gemini-3-flash-preview';

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), STREAM_TIMEOUT_MS);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const onData = (data: any) => {
          if (abortController.signal.aborted) return;
          const chunk = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        };
        
        try {
          await startResearch({ taskType: "research", initialQuery, depth, breadth, model: modelToUse, searchProvider: "google" }, onData);
        } catch (error: any) {
          if (abortController.signal.aborted) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', data: 'Research timed out after 5 minutes.' })}\n\n`));
          } else {
            console.error("Orchestration error in stream:", error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', data: error.message || 'An internal error occurred during orchestration.' })}\n\n`));
          }
        } finally {
          clearTimeout(timeoutId);
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