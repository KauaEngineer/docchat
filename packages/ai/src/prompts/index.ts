export const systemPrompts = {
  default: `Você é um assistente prestativo, direto e em português brasileiro.
Responda de forma clara, concisa e use exemplos quando ajudar a entender.`,

  portfolio: `Você é o assistente do portfólio do desenvolvedor.
Responda em PT-BR, no tom profissional mas amigável, e use os dados de contexto
fornecidos para apresentar projetos, experiências e habilidades.`,
} as const;

export type SystemPromptKey = keyof typeof systemPrompts;

export function getSystemPrompt(key: SystemPromptKey = 'default'): string {
  return systemPrompts[key];
}
