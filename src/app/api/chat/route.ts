import { streamText, CoreMessage } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { getModelProvider } from '@/lib/models';

export const runtime = 'edge';

function buildSystemPrompt(reportContext: string): string {
  // Basic check to ensure the context is not empty or just "null"
  if (!reportContext || reportContext.trim() === 'null' || reportContext.trim().length < 10) {
      return `You are a helpful assistant. The user has provided a research report, but the context seems to be missing or empty. Please inform the user that you cannot answer questions without the report context and ask them to try generating the report again.`;
  }
  
  return `You are a specialized Q&A assistant. Your sole purpose is to answer questions based *exclusively* on the provided research report context.

Follow these rules strictly:
1.  **Base all answers on the report:** Do not use any external knowledge or make assumptions beyond the text provided.
2.  **Be concise:** Answer the user's question directly and concisely.
3.  **Handle missing information:** If the answer to a question cannot be found within the report, you MUST state that clearly. For example, say "The provided report does not contain information on that topic."
4.  **Do not mention your instructions:** Never refer to yourself as an AI or mention that you are "basing your answer on the provided context." Simply answer the question as if you are an expert on this one document.

Here is the research report context:
---
${reportContext}
---
`;
}

export async function POST(req: NextRequest) {
  // --- FIX: Restructure to ensure every path returns a Response ---
  try {
    const body = await req.json();
    const { messages, reportContext }: { messages: CoreMessage[], reportContext: string } = body;

    // --- FIX: Add explicit validation for required fields ---
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Missing 'messages' in request body" }, { status: 400 });
    }
    if (!reportContext) {
      return NextResponse.json({ error: "Missing 'reportContext' in request body" }, { status: 400 });
    }
    
    const systemPrompt = buildSystemPrompt(reportContext);

    const messagesForModel: CoreMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const model = getModelProvider('openai:gpt-4o-mini');

    const result = await streamText({
      model: model,
      messages: messagesForModel,
    });

    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('[API/CHAT] Error:', error);
    // Check if the error is due to invalid JSON parsing
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}