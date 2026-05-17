import { tool } from 'ai';
import { z } from 'zod';

export const getCurrentTime = tool({
  description: 'Retorna a data e hora atuais no fuso UTC.',
  inputSchema: z.object({}),
  execute: async () => ({
    iso: new Date().toISOString(),
    timestamp: Date.now(),
  }),
});

export const tools = {
  getCurrentTime,
} as const;

export type ToolName = keyof typeof tools;
