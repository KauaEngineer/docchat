import { createVercel } from '@ai-sdk/vercel';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import { createProviderRegistry } from 'ai';

const vercelApiKey = process.env['VERCEL_AI_API_KEY'];

if (!vercelApiKey) {
  // Falha no boot. Antes o erro só aparecia tarde, na hora da chamada à API,
  // e vinha embrulhado pelo provider — difícil de diagnosticar.
  throw new Error(
    'VERCEL_AI_API_KEY não está definida. ' +
      'Verifique o .env da raiz e o loadEnvConfig em apps/web/next.config.ts.',
  );
}

const vercel = createVercel({
  apiKey: vercelApiKey,
  baseURL: 'https://ai-gateway.vercel.sh/v1',
});

export const registry = createProviderRegistry({
  vercel,
});

export type ProviderName = 'vercel';

// Mapa explícito modelo -> provider. Mantém a fonte da verdade aqui no pacote
// de IA (não no front), e evita heurísticas frágeis baseadas em prefixo.
const PROVIDER_OF: Record<string, ProviderName> = {
  'gemini-2.0-flash': 'vercel',
  'gemini-1.5-pro': 'vercel',
  'claude-sonnet-4-5': 'vercel',
};

export type KnownModelId = keyof typeof PROVIDER_OF;

export function isKnownModelId(id: string): id is KnownModelId {
  return id in PROVIDER_OF;
}

/**
 * Retorna o LanguageModelV1 correspondente ao id. Os ids são os mesmos
 * usados no front (apps/web/src/lib/models.ts). Lança se o id for desconhecido
 * — preferimos quebrar cedo a chamar um provider errado.
 */
export function getModel(modelId: string): LanguageModelV1 {
  const provider = PROVIDER_OF[modelId];
  if (!provider) {
    // JSON.stringify revela whitespace/zero-width chars ("gemini-2.0-flash "
    // ou "​gemini..."); listar os válidos torna o diff óbvio.
    const known = Object.keys(PROVIDER_OF).map((k) => `"${k}"`).join(', ');
    throw new Error(
      `Modelo desconhecido: ${JSON.stringify(modelId)}. Conhecidos: ${known}.`,
    );
  }
  return registry.languageModel(`${provider}:${modelId}`);
}
