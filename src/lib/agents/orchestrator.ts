import { ResearchRequestBody } from '@/lib/types';
import { generateSubQueries } from './subQueryGenerator';
import { performSearch } from './searchOrchestrator';
import { fetchAndParseContent } from './contentFetcher';
import { extractLearning } from './learningExtractor';

// In-memory state for a single research request
const completedQueries = new Set<string>();

/**
 * Main recursive orchestration logic for the deep research engine.
 *
 * @param {object} params - The parameters for the research task.
 * @param {string} params.query - The current query to research.
 * @param {number} params.depth - The current remaining recursion depth.
 * @param {number} params.breadth - The number of sub-queries to generate at this level.
 * @param {(data: any) => void} onData - Callback function to stream data back to the client.
 */
async function recursiveOrchestrator({
  query,
  depth,
  breadth,
  onData,
}: {
  query: string;
  depth: number;
  breadth: number;
  onData: (data: any) => void;
}) {
  if (depth === 0 || completedQueries.has(query)) {
    return;
  }

  console.log(`ORCHESTRATOR_START: query="${query}", depth=${depth}, breadth=${breadth}`);
  completedQueries.add(query);
  onData({ type: 'query-start', data: query });

  // 1. Generate Sub-Queries
  // If we are at the deepest level, we search the query directly.
  // Otherwise, we generate sub-queries to explore.
  const queriesToProcess = depth > 1 
    ? await generateSubQueries({ query, breadth })
    : [query];
  
  const followUpQueue: string[] = [];

  for (const subQuery of queriesToProcess) {
    if (completedQueries.has(subQuery)) continue;

    completedQueries.add(subQuery);
    onData({ type: 'query-start', data: subQuery });

    // 2. Search
    const searchResults = await performSearch(subQuery);
    let failures = 0;

    // 3. Fetch, Parse, and Extract Learnings
    for (const result of searchResults) {
      const document = await fetchAndParseContent(result);
      if (document) {
        const learning = await extractLearning({ query: subQuery, document });
        onData({ type: 'learning', data: learning });
        followUpQueue.push(...learning.followUpQuestions);
      } else {
        failures++;
        if (failures >= 3) {
            console.warn(`SKIPPING_QUERY: Too many content fetch failures for query="${subQuery}"`);
            break;
        }
      }
    }
    onData({ type: 'query-end', data: subQuery });
  }

  // 4. Recurse
  if (depth > 1) {
    const nextDepth = depth - 1;
    const nextBreadth = Math.ceil(breadth / 2);
    
    // De-duplicate follow-up questions
    const uniqueFollowUps = [...new Set(followUpQueue)];

    for (const followUp of uniqueFollowUps) {
      await recursiveOrchestrator({
        query: followUp,
        depth: nextDepth,
        breadth: nextBreadth,
        onData,
      });
    }
  }
}

/**
 * Entry point for the orchestration process.
 * Initializes state and starts the recursive research.
 *
 * @param {ResearchRequestBody} requestBody - The initial user request.
 * @param {(data: any) => void} onData - The streaming callback.
 */
export async function startResearch(requestBody: ResearchRequestBody, onData: (data: any) => void) {
    completedQueries.clear(); // Clear state for new request
    await recursiveOrchestrator({
      query: requestBody.initialQuery,
      depth: requestBody.depth,
      breadth: requestBody.breadth,
      onData,
    });
}