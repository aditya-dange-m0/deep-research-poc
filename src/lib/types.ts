import { z } from 'zod';

// UUID v4 string type for identification
export type ID = string;

// --- Input Validation Schema ---

export const supportedModels = [
    'openai:gpt-4o-mini',
    'google:gemini-1.5-flash-latest',
    'google:gemini-1.5-pro-latest',
] as const;
export type SupportedModel = typeof supportedModels[number];


// --- VERIFIED: Input validation schema is correct ---
export const ResearchRequestSchema = z.object({
  initialQuery: z.string().min(1, "Query cannot be empty."),
  depth: z.number().int().min(1, "Depth must be at least 1."),
  breadth: z.number().int().min(1, "Breadth must be at least 1."),
  model: z.enum(supportedModels).optional().describe("The AI model to use for generation."),
});

export type ResearchRequestBody = z.infer<typeof ResearchRequestSchema>;


// --- Module-specific Interfaces ---

// 1. Query Interpreter Output
export interface ResearchRequest {
  id: ID;
  query: string;
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    domains?: string[];
  };
  format: "overview" | "comparison" | "timeline" | "deepDive";
  createdAt: string; // ISO timestamp
}

// 2. Search Orchestrator Output
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

// 3. Content Fetcher & Parser Output
export interface Document {
  id: ID;
  text: string;
  metadata: {
    title: string;
    author?: string;
    url: string;
    publishedAt?: string;
  };
}

// 4. Learning Extractor Output
export interface Learning {
  query: string;
  url: string;
  learning: string; // 1–2 sentences
  followUpQuestions: string[]; // 1–3 items
}

// --- Final API Response Structure ---
// This represents the complete data set after the stream has finished.
export interface ResearchResult {
  initialQuery: string;
  depth: number;
  breadth: number;
  completedQueries: string[];
  learnings: Learning[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ReportSection {
  title: string;
  content: string; // Markdown content
}

export interface ResearchReport {
  title: string;
  summary: string; // Executive summary with markdown
  sections: ReportSection[];
  usedSources: string[]; // Array of URLs that were cited
}

// Final "done" message payload
export interface CompletionData {
    message: string;
    totalUsage: TokenUsage;
}

