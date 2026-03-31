import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "composio-core",
    "@langchain/core",
    "langchain",
    "@pinecone-database/pinecone",
    "openai",
    "pdf-parse",
    "html-to-text",
    "axios",
  ],
};

export default nextConfig;
