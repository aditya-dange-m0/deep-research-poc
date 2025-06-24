import { NextRequest, NextResponse } from 'next/server';
import { ResearchRequestSchema } from '@/lib/types';
import { startResearch } from '../../../lib/agents/orchestrator';

// export const runtime = 'edge'; // Use Vercel's Edge Runtime for streaming

/**
 * API Endpoint for initiating a deep research task.
 * It streams back insights as they are generated.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedBody = ResearchRequestSchema.safeParse(body);

    if (!validatedBody.success) {
      return NextResponse.json(validatedBody.error.format(), { status: 400 });
    }
    
    const { initialQuery, depth, breadth } = validatedBody.data;

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // Define the callback function to handle data from the orchestrator
        const onData = (data: any) => {
          const chunk = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        };
        
        try {
          // Start the research process
          await startResearch({ initialQuery, depth, breadth }, onData);
          
          // Signal completion
          const doneMessage = { type: 'done', data: 'Research complete.' };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneMessage)}\n\n`));

        } catch (error: any) {
            console.error("Orchestration error:", error);
            const errorMessage = { type: 'error', data: error.message || 'An internal error occurred.' };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
        } finally {
            // Close the stream
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