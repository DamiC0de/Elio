/**
 * EL-020 — Web Search Service (Brave Search API)
 * Free tier: 2000 requests/month
 */

interface SearchParams {
  query: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(params: SearchParams): Promise<string> {
  const { query } = params;
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    // Fallback: return a message that search is not configured
    return JSON.stringify({
      error: 'Recherche web non configurée (BRAVE_SEARCH_API_KEY manquante)',
      suggestion: "Je ne peux pas faire de recherche web pour l'instant.",
    });
  }

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&search_lang=fr`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!res.ok) throw new Error(`Brave Search error: ${res.status}`);
  const data = await res.json() as { web?: { results?: Record<string, string>[] } };

  const results: SearchResult[] = (data.web?.results || []).slice(0, 5).map((r: Record<string, string>) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
  }));

  return JSON.stringify({ query, results }, null, 2);
}

// Tool definition for Claude
export const webSearchTool = {
  name: 'web_search',
  description: "Rechercher des informations sur internet. Utilise cette fonction pour les questions d'actualité, les faits récents, ou quand tu n'es pas sûr d'une information.",
  input_schema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Requête de recherche' },
    },
    required: ['query'],
  },
};
