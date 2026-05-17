export type ModelProvider = 'anthropic' | 'openai' | 'google';

export interface ModelDef {
  id: string;
  provider: ModelProvider;
  displayName: string;
  contextWindow: number;
  supportsVision: boolean;
  supportsTools: boolean;
}

export const MODELS: readonly ModelDef[] = [
  {
    id: 'claude-sonnet-4-5',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4.5',
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
  },
  {
    id: 'claude-opus-4-7',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.7',
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
  },
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    displayName: 'Claude Haiku 4.5',
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    contextWindow: 128_000,
    supportsVision: true,
    supportsTools: true,
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o mini',
    contextWindow: 128_000,
    supportsVision: true,
    supportsTools: true,
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'google',
    displayName: 'Gemini 2.0 Flash',
    contextWindow: 1_000_000,
    supportsVision: true,
    supportsTools: true,
  },
  {
    id: 'gemini-1.5-pro',
    provider: 'google',
    displayName: 'Gemini 1.5 Pro',
    contextWindow: 2_000_000,
    supportsVision: true,
    supportsTools: true,
  },
] as const;

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-5';

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

export function isValidModelId(id: string): boolean {
  return MODELS.some((m) => m.id === id);
}
