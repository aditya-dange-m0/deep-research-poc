import { SearchResult } from "@/lib/types";
import { LRUCache } from "lru-cache";
import Exa from 'exa-js';
import axios from 'axios';

const cache = new LRUCache<string, SearchResult[]>({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour
});

const GOOGLE_SEARCH_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

/**
 * Executes a search query using the Google Custom Search API with caching and retries.
 *
 * @param {string} query - The search query string.
 * @returns {Promise<SearchResult[]>} A promise that resolves to an array of top 3 search results.
 */
export async function performGoogleSearch(query: string): Promise<SearchResult[]> {
  if (cache.has(query)) {
    console.log(`CACHE_HIT: query="${query}"`);
    return cache.get(query)!;
  }

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) {
    throw new Error(
      "Google Search API credentials (GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX) are not configured."
    );
  }

  const params = new URLSearchParams({
    key: apiKey,
    cx: cx,
    q: query,
    num: "5", // Increased from 3 to 5
  });

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(
        `${GOOGLE_SEARCH_ENDPOINT}?${params.toString()}`
      );

      if (!response.ok) {
        // This block is inspired by your reference code for robust error handling.
        const errorData = await response.json().catch(() => null);
        console.error(
          `SEARCH_FAILED_API: status=${response.status}, query="${query}"`,
          errorData
        );

        if (response.status === 403) {
          throw new Error(
            "Search request forbidden (403). **ACTION NEEDED**: Please ensure the 'Custom Search API' is ENABLED in your Google Cloud project dashboard."
          );
        }
        if (
          response.status === 429 &&
          errorData?.error?.message?.includes("Quota exceeded")
        ) {
          throw new Error(
            "Google Search daily quota exceeded. Please try again tomorrow."
          );
        }
        // Throw a generic error to trigger a retry for other server-side issues (5xx).
        throw new Error(
          `Google Search API responded with status ${response.status}`
        );
      }

      const data = await response.json();
      const results: SearchResult[] = (data.items || []).map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        publishedAt: item.pagemap?.metatags?.[0]?.["article:published_time"],
      }));

      console.log(
        `SEARCH_PERFORMED: query="${query}", results=${results.length}`
      );
      cache.set(query, results);
      return results;
    } catch (error: any) {
      attempt++;
      // If it's a known, non-retryable error, re-throw it immediately.
      if (
        error.message.includes("403") ||
        error.message.includes("quota exceeded")
      ) {
        throw error;
      }

      if (attempt >= maxAttempts) {
        console.error(
          `SEARCH_FAILED_FINAL: query="${query}" after ${maxAttempts} attempts.`
        );
        throw error;
      }

      const delay = Math.pow(2, attempt) * 1000;
      console.warn(
        `SEARCH_RETRY: query="${query}", attempt ${attempt}, retrying in ${delay}ms...`
      );
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  return []; // Should not be reached
}

async function performExaSearch(query: string): Promise<SearchResult[]> {
  const exaApiKey = process.env.EXA_API_KEY;
  if (!exaApiKey) throw new Error("Exa API key is not configured.");
  const exa = new Exa(exaApiKey);

  try {
    console.log(`Performing Neural Search with Exa for: "${query}"`);
    const response = await exa.searchAndContents(query, {
      numResults: 5,
      type: 'neural',
      text: { maxCharacters: 4000 }
    });
    return response.results.map(item => ({
      title: item.title || 'No Title Found',
      url: item.url,
      snippet: item.text || 'No Content Found',
      publishedAt: item.publishedDate,
    }));
  } catch (error) {
    console.error(`Exa search failed for query "${query}":`, error);
    return [];
  }
}

export async function performSearch(query: string, provider: 'google' | 'exa' = 'exa'): Promise<SearchResult[]> {
  if (provider === 'google') {
    return performGoogleSearch(query);
  }
  return performExaSearch(query);
}



// import { SearchResult } from '@/lib/types';
// import Exa from 'exa-js';

// /**
//  * Executes a neural search query using the Exa.ai API.
//  * This is a drop-in replacement for the previous Google Search implementation.
//  * It uses a more powerful neural search engine better suited for research tasks.
//  *
//  * @param {string} query - The search query string, which can be a full sentence or question.
//  * @param {number} [numResults=5] - The number of results to fetch for evaluation.
//  * @returns {Promise<SearchResult[]>} A promise that resolves to an array of search results.
//  */
// export async function performSearch(query: string, numResults: number = 5): Promise<SearchResult[]> {
//   const exaApiKey = process.env.EXA_API_KEY;

//   if (!exaApiKey) {
//     throw new Error("Exa API key (EXA_API_KEY) is not configured in your .env.local file.");
//   }

//   const exa = new Exa(exaApiKey);

//   try {
//     console.log(`Performing Neural Search with Exa for: "${query}"`);

//     // Use Exa's searchAndContents API. This is the most efficient method.
//     // It finds relevant documents and returns their clean, extracted text content in a single call.
//     const response = await exa.searchAndContents(query, {
//       numResults: numResults,
//       type: 'neural',
//       // We ask for a decent amount of text to give our evaluation agent good context.
//       text: {
//         maxCharacters: 2500 
//       }
//     });

//     const results: SearchResult[] = response.results.map(item => ({
//       title: item.title || 'No Title Found',
//       url: item.url,
//       // The 'text' field from Exa's response is the main content of the page.
//       // We map this directly to our 'snippet' field for the evaluation agent to use.
//       snippet: item.text || 'No Content Found', 
//       publishedAt: item.publishedDate,
//     }));

//     console.log(`Exa Search for "${query}": Found ${results.length} high-quality results.`);
//     return results;

//   } catch (error: any) {
//     console.error(`Exa API search failed for query "${query}":`, error.message);
//     // Return an empty array so the orchestrator can gracefully handle a failed search.
//     return [];
//   }
// }
