import { PineconeRecord, RecordMetadata } from '@pinecone-database/pinecone'; // Import RecordMetadata and PineconeRecord

// Existing Tool and ToolsObject interfaces (no change needed here)
export interface ToolParameterSchema {
  jsonSchema: {
    properties: {
      [key: string]: {
        description: string;
        examples?: string[];
        title: string;
        type: string;
        default?: any;
        nullable?: boolean;
        items?: { type: string };
        maximum?: number;
        minimum?: number;
      };
    };
    required?: string[];
    title: string;
    type: string;
  };
}

export interface Tool {
  description: string;
  parameters: ToolParameterSchema;
  // Add other properties if your actual tool object has them
}

export interface ToolsObject {
  [toolName: string]: Tool;
}

// CORRECTED: Metadata type for Pinecone.
// We will store the `fullTool` as a JSON string.
export interface ToolMetadata extends Record<string, any> { // Extends Record<string, any> to satisfy RecordMetadata constraint
  toolName: string;
  appKey: string; // e.g., "GMAIL"
  fullToolJson: string; // Store JSON string of the full Tool object
}

// We don't need a separate type alias for PineconeRecord, it's imported now.
// type PineconeRecord = /*unresolved*/ any