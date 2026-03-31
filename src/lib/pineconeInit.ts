import { Pinecone, Index } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import {
  ToolMetadata,
  ToolsObject,
  Tool,
  ToolParameterSchema,
} from "@/types/types";
import { PineconeRecord, RecordMetadata } from "@pinecone-database/pinecone";
import "dotenv/config"; // Loads .env file

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

// Validate lazily at call-time so missing vars don't crash the Next.js worker on cold start
function requireEnv(): { pineconeKey: string; openaiKey: string; indexName: string } {
  if (!PINECONE_API_KEY || !OPENAI_API_KEY || !PINECONE_INDEX_NAME) {
    throw new Error("Missing environment variables for Pinecone or OpenAI");
  }
  return { pineconeKey: PINECONE_API_KEY, openaiKey: OPENAI_API_KEY, indexName: PINECONE_INDEX_NAME };
}

const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY ?? "",
});

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY ?? "",
});

const EMBEDDING_MODEL = "text-embedding-3-small"; // Recommended OpenAI embedding model

// This function will be called once to ensure the index exists
export async function initializePineconeIndex() {
  const { indexName } = requireEnv();
  const indexList = await pinecone.listIndexes();
  if (!indexList.indexes?.some((index) => index.name === indexName)) {
    console.log(`Creating Pinecone index: ${indexName}...`);
    await pinecone.createIndex({
      name: indexName,
      dimension: 1536,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
      waitUntilReady: true,
    });
    console.log(`Pinecone index ${indexName} created.`);
  } else {
    console.log(`Pinecone index ${indexName} already exists.`);
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  requireEnv();
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Ingests a set of tools for a specific application into Pinecone.
 * Each app will have its own namespace.
 * @param appKey The key representing the application (e.g., "GMAIL").
 * @param tools The object containing tool definitions for the app.
 */
export async function ingestComposioAppToolsToPinecone(
  appKey: string,
  tools: ToolsObject
): Promise<void> {
  const { indexName } = requireEnv();
  const index = pinecone.index<ToolMetadata>(indexName);
  const records: PineconeRecord<ToolMetadata>[] = []; // Now PineconeRecord is correctly imported

  for (const toolName in tools) {
    console.log("toolName :", toolName)
    if (Object.prototype.hasOwnProperty.call(tools, toolName)) {
      const tool = tools[toolName];
      const descriptionToEmbed = `${toolName}: ${tool.description}`; // Combine name and description for better embeddings
      const embedding = await generateEmbedding(descriptionToEmbed);
      console.log("embedding :", toolName)
      records.push({
        id: toolName,
        values: embedding,
        metadata: {
          toolName: toolName,
          appKey: appKey,
          //   fullToolJson: JSON.stringify(tool), // Store the tool object as a JSON string
        } as ToolMetadata, // Cast to ToolMetadata to ensure TypeScript checks
      });
    }
  }

  // Upsert in batches if you have many tools
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    try {
      await index.namespace(appKey).upsert(batch); // Use appKey as namespace
      console.log(
        `Upserted ${batch.length} tools for app ${appKey} into namespace ${appKey}.`
      );
    } catch (error) {
      console.error(`Error upserting batch for app ${appKey}:`, error);
      throw error;
    }
  }
}

export async function getComposioAppToolsFromPinecone(
  appKey: string,
  naturalLanguageQuery: string,
  topK: number = 3
): Promise<string[]> {
  const { indexName } = requireEnv();
  const index = pinecone.index<ToolMetadata>(indexName);

  // 1. Generate embedding for the natural language query
  const queryEmbedding = await generateEmbedding(naturalLanguageQuery);

  // 2. Query Pinecone within the specific app's namespace
  const queryResponse = await index.namespace(appKey).query({
    vector: queryEmbedding,
    topK: topK,
    includeMetadata: true, // Crucial to get the full tool object back
  });

  // 3. Reconstruct the ToolsObject from the query results
  const relevantToolNames: string[] = []; // <--- Initialize an array for tool names
  if (queryResponse.matches) {
    for (const match of queryResponse.matches) {
      if (match.metadata && match.metadata.toolName) {
        relevantToolNames.push(match.metadata.toolName);
      }
    }
  }

  return relevantToolNames;
}
