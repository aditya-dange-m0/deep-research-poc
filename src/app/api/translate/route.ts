import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { translateText } from '@/lib/agents/translationAgent';
import { supportedModels } from '@/lib/types';

// Define a simple schema specifically for this route
const TranslateRequestSchema = z.object({
  text: z.string().min(1, "Text to translate cannot be empty."),
  targetLanguage: z.string().min(2, "Target language must be specified."),
  model: z.enum(supportedModels).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = TranslateRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(validation.error.format(), { status: 400 });
    }

    const { text, targetLanguage, model } = validation.data;
    const modelToUse = model || 'openai:gpt-4o-mini';

    // Call the translation agent
    const { translatedText, usage } = await translateText({
      text,
      targetLanguage,
      model: modelToUse,
    });

    // Return the full result as a single JSON object
    return NextResponse.json({
      originalText: text,
      translatedText,
      usage,
    });

  } catch (error: any) {
    console.error('[API/TRANSLATE] Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}