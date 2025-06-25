import { v4 as uuidv4 } from "uuid";
import { ResearchRequestBody, ResearchRequest } from "@/lib/types";

/**
 * Validates and transforms the initial user request into a structured ResearchRequest.
 * For this implementation, the format is hardcoded to "deepDive" as the logic
 * for other formats is not specified.
 *
 * @param {ResearchRequestBody} body - The raw request body from the user.
 * @returns {ResearchRequest} The structured and validated research request object.
 */
export function interpretQuery(body: ResearchRequestBody): ResearchRequest {
  // Validation is assumed to be done by Zod in the API layer before this is called.
  const { initialQuery } = body;

  const researchRequest: ResearchRequest = {
    id: uuidv4(),
    query: initialQuery,
    // Note: The logic to dynamically determine format is not specified.
    // Defaulting to 'deepDive' as it's the most fitting for this engine.
    format: "deepDive",
    createdAt: new Date().toISOString(),
    // Filters are not used in the core logic yet but are part of the spec.
    filters: {},
  };

  // Log: "REQUEST_RECEIVED"
  console.log(
    `REQUEST_RECEIVED: id=${researchRequest.id}, query="${researchRequest.query}"`
  );

  return researchRequest;
}
