import { tool } from 'ai';
import { z } from 'zod';

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
}

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

/**
 * Busca web via Tavily (https://tavily.com).
 *
 * Por que Tavily e não outra API:
 * - Endpoint único, sem OAuth — só uma API key.
 * - Já retorna "content" sumarizado por resultado, o que evita um fetch+parse
 *   adicional pro modelo conseguir trabalhar com o resultado.
 * - Free tier de 1000 buscas/mês, suficiente pro portfólio.
 *
 * A chave é lida lazy: se a tool nunca for chamada, a falta do env não derruba
 * nada (importante porque o registro de tools é exportado mesmo sem a key).
 */
export const webSearch = tool({
  description:
    'Busca na web informações atuais. Use para fatos pós-2024, notícias, preços.',
  parameters: z.object({
    query: z.string().min(1),
    maxResults: z.number().min(1).max(10).default(5),
  }),
  execute: async ({ query, maxResults }) => {
    const apiKey = process.env['TAVILY_API_KEY'];
    if (!apiKey || apiKey.trim().length === 0) {
      return { error: 'TAVILY_API_KEY não configurada.' };
    }

    try {
      const res = await fetch(TAVILY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          // search_depth basic = mais rápido/barato (1 crédito) que advanced (2).
          // Suficiente pro caso de uso "buscar fato/notícia recente".
          search_depth: 'basic',
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return {
          error: `Tavily retornou ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
        };
      }

      const data = (await res.json()) as Partial<TavilyResponse>;
      const results: TavilyResult[] = Array.isArray(data.results)
        ? data.results.map((r) => ({
            title: String(r.title ?? ''),
            url: String(r.url ?? ''),
            content: String(r.content ?? ''),
            score: typeof r.score === 'number' ? r.score : 0,
          }))
        : [];

      return { results };
    } catch (err) {
      return {
        error:
          err instanceof Error ? err.message : 'Falha ao consultar a busca web.',
      };
    }
  },
});
