import { SearchResult } from '@/lib/types';
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, SearchResult[]>({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour
});

const GOOGLE_SEARCH_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

/**
 * Executes a search query using the Google Custom Search API with caching and retries.
 *
 * @param {string} query - The search query string.
 * @returns {Promise<SearchResult[]>} A promise that resolves to an array of top 3 search results.
 */
export async function performSearch(query: string): Promise<SearchResult[]> {
  if (cache.has(query)) {
    console.log(`CACHE_HIT: query="${query}"`);
    return cache.get(query)!;
  }

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) {
    throw new Error("Google Search API credentials (GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX) are not configured.");
  }

  const params = new URLSearchParams({
    key: apiKey,
    cx: cx,
    q: query,
    num: '5', // Increased from 3 to 5
  });

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(`${GOOGLE_SEARCH_ENDPOINT}?${params.toString()}`);

      if (!response.ok) {
        // This block is inspired by your reference code for robust error handling.
        const errorData = await response.json().catch(() => null);
        console.error(`SEARCH_FAILED_API: status=${response.status}, query="${query}"`, errorData);

        if (response.status === 403) {
            throw new Error("Search request forbidden (403). **ACTION NEEDED**: Please ensure the 'Custom Search API' is ENABLED in your Google Cloud project dashboard.");
        }
        if (response.status === 429 && errorData?.error?.message?.includes('Quota exceeded')) {
            throw new Error("Google Search daily quota exceeded. Please try again tomorrow.");
        }
        // Throw a generic error to trigger a retry for other server-side issues (5xx).
        throw new Error(`Google Search API responded with status ${response.status}`);
      }

      const data = await response.json();
      const results: SearchResult[] = (data.items || []).map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        publishedAt: item.pagemap?.metatags?.[0]?.['article:published_time'],
      }));

      console.log(`SEARCH_PERFORMED: query="${query}", results=${results.length}`);
      cache.set(query, results);
      return results;

    } catch (error: any) {
      attempt++;
      // If it's a known, non-retryable error, re-throw it immediately.
      if (error.message.includes('403') || error.message.includes('quota exceeded')) {
          throw error;
      }
      
      if (attempt >= maxAttempts) {
        console.error(`SEARCH_FAILED_FINAL: query="${query}" after ${maxAttempts} attempts.`);
        throw error;
      }
      
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`SEARCH_RETRY: query="${query}", attempt ${attempt}, retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }

  return []; // Should not be reached
}