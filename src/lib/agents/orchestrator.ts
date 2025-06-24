import { generateSubQueries } from './subQueryGenerator';
import { performSearch } from './searchOrchestrator';
import { fetchAndParseContent } from './contentFetcher';
import { extractLearning } from './learningExtractor';
import { Learning, ResearchRequestBody, TokenUsage } from '@/lib/types';
import { generateReport } from './reportGenerator';

// State for a single research request
type ResearchState = {
  completedQueries: Set<string>;
  allLearnings: Learning[];
  tokenTracker: TokenUsage;
};

async function recursiveOrchestrator({
  query,
  depth,
  breadth,
  onData,
  state,
}: {
  query: string;
  depth: number;
  breadth: number;
  onData: (data: any) => void;
  state: ResearchState;
}) {
  if (depth === 0 || state.completedQueries.has(query)) {
    return;
  }

  console.log(`ORCHESTRATOR_START: query="${query}", depth=${depth}, breadth=${breadth}`);
  state.completedQueries.add(query);
  onData({ type: 'query-start', data: query });

  const { queries: subQueries, usage: subQueryUsage } = depth > 1
    ? await generateSubQueries({ query, breadth })
    : { queries: [query], usage: { inputTokens: 0, outputTokens: 0 } };
  
  state.tokenTracker.inputTokens += subQueryUsage.inputTokens;
  state.tokenTracker.outputTokens += subQueryUsage.outputTokens;
  if(subQueryUsage.inputTokens > 0) {
    onData({ type: 'token-usage', data: { step: 'sub-query', usage: subQueryUsage } });
  }
  
  const followUpQueue: string[] = [];

  for (const subQuery of subQueries) {
    if (state.completedQueries.has(subQuery)) continue;
    state.completedQueries.add(subQuery);

    const searchResults = await performSearch(subQuery);
    for (const result of searchResults) {
      const document = await fetchAndParseContent(result);
      if (document) {
        const { learning, usage: learningUsage } = await extractLearning({ query: subQuery, document });
        state.allLearnings.push(learning);
        state.tokenTracker.inputTokens += learningUsage.inputTokens;
        state.tokenTracker.outputTokens += learningUsage.outputTokens;
        onData({ type: 'learning', data: { learning, usage: learningUsage } });
        followUpQueue.push(...learning.followUpQuestions);
      }
    }
  }

  if (depth > 1) {
    const uniqueFollowUps = [...new Set(followUpQueue)];
    for (const followUp of uniqueFollowUps) {
      await recursiveOrchestrator({
        query: followUp,
        depth: depth - 1,
        breadth: Math.ceil(breadth / 2),
        onData,
        state,
      });
    }
  }
}

export async function startResearch(requestBody: ResearchRequestBody, onData: (data: any) => void) {
  const state: ResearchState = {
    completedQueries: new Set<string>(),
    allLearnings: [],
    tokenTracker: { inputTokens: 0, outputTokens: 0 },
  };

  await recursiveOrchestrator({
    query: requestBody.initialQuery,
    depth: requestBody.depth,
    breadth: requestBody.breadth,
    onData,
    state,
  });

  if (state.allLearnings.length > 0) {
    const { report, usage: reportUsage } = await generateReport({
      learnings: state.allLearnings,
      query: requestBody.initialQuery,
    });
    state.tokenTracker.inputTokens += reportUsage.inputTokens;
    state.tokenTracker.outputTokens += reportUsage.outputTokens;
    onData({ type: 'report', data: { report, usage: reportUsage } });
  }

  // Final completion message with total token usage
  onData({
    type: 'done',
    data: {
      message: 'Research complete.',
      totalUsage: state.tokenTracker,
    },
  });
}