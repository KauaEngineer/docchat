import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import { createProviderRegistry } from 'ai';

const anthropic = createAnthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'],
});

const openai = createOpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

const google = createGoogleGenerativeAI({
  apiKey: process.env['GOOGLE_GENERATIVE_AI_API_KEY'] ?? process.env['GOOGLE_API_KEY'],
});

export const registry = createProviderRegistry({
  anthropic,
  openai,
  google,
});

export type ProviderName = 'anthropic' | 'openai' | 'google';

// Mapa explícito modelo -> provider. Mantém a fonte da verdade aqui no pacote
// de IA (não no front), e evita heurísticas frágeis baseadas em prefixo.
const PROVIDER_OF: Record<string, ProviderName> = {
  'claude-sonnet-4-5': 'anthropic',
  'claude-opus-4-7': 'anthropic',
  'claude-haiku-4-5': 'anthropic',
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'gemini-2.0-flash': 'google',
  'gemini-1.5-pro': 'google',
};

export type KnownModelId = keyof typeof PROVIDER_OF;

export function isKnownModelId(id: string): id is KnownModelId {
  return id in PROVIDER_OF;
}

/**
 * Retorna o LanguageModelV2 correspondente ao id. Os ids são os mesmos
 * usados no front (apps/web/src/lib/models.ts). Lança se o id for desconhecido
 * — preferimos quebrar cedo a chamar um provider errado.
 */
export function getModel(modelId: string): LanguageModelV2 {
  const provider = PROVIDER_OF[modelId];
  if (!provider) {
    throw new Error(`Modelo desconhecido: "${modelId}". Adicione em packages/ai/src/providers.ts.`);
  }
  return registry.languageModel(`${provider}:${modelId}`);
}
