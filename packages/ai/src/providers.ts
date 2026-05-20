import { createVercel } from '@ai-sdk/vercel';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import { createProviderRegistry } from 'ai';

export type ProviderName = 'vercel';

// Lazy: a key é injetada pela Vercel em runtime, não em build time. Validar/
// instanciar no top-level quebraria o build na Vercel (onde a env não existe
// durante o `next build`). Construímos o registry sob demanda na 1ª chamada
// de getModel() e cacheamos o resultado.
let cachedRegistry: ReturnType<typeof createProviderRegistry> | null = null;

function getRegistry(): ReturnType<typeof createProviderRegistry> {
  if (cachedRegistry) return cachedRegistry;

  const vercelApiKey = process.env['VERCEL_AI_API_KEY'];
  if (!vercelApiKey) {
    throw new Error(
      'VERCEL_AI_API_KEY não está definida. ' +
        'Verifique o .env local ou as Environment Variables do projeto na Vercel.',
    );
  }

  const vercel = createVercel({
    apiKey: vercelApiKey,
    baseURL: 'https://ai-gateway.vercel.sh/v1',
  });

  cachedRegistry = createProviderRegistry({ vercel });
  return cachedRegistry;
}

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
    // JSON.stringify revela whitespace/zero-width chars no id (ex.: trailing
    // space ou U+200B no início); listar os válidos torna o diff óbvio.
    const known = Object.keys(PROVIDER_OF).map((k) => `"${k}"`).join(', ');
    throw new Error(
      `Modelo desconhecido: ${JSON.stringify(modelId)}. Conhecidos: ${known}.`,
    );
  }
  return getRegistry().languageModel(`${provider}:${modelId}`);
}
