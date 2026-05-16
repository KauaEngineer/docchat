import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export const models = {
  'claude-opus-4-7': anthropic('claude-opus-4-7'),
  'claude-sonnet-4-6': anthropic('claude-sonnet-4-6'),
  'claude-haiku-4-5': anthropic('claude-haiku-4-5-20251001'),

  'gpt-4o': openai('gpt-4o'),
  'gpt-4o-mini': openai('gpt-4o-mini'),

  'gemini-2.0-flash': google('gemini-2.0-flash-exp'),
  'gemini-1.5-pro': google('gemini-1.5-pro-latest'),
} as const satisfies Record<string, LanguageModel>;

export type ModelId = keyof typeof models;

export const defaultModel: ModelId = 'claude-sonnet-4-6';

export function getModel(id: ModelId): LanguageModel {
  return models[id];
}

export { anthropic, google, openai };
