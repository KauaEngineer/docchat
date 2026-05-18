export type ModelProvider = 'google';

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

export const DEFAULT_MODEL_ID = 'gemini-2.0-flash';

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  google: 'Google',
};

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

export function isValidModelId(id: string): boolean {
  return MODELS.some((m) => m.id === id);
}
