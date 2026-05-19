import { tool } from 'ai';
import { z } from 'zod';

const TIMEZONE = 'America/Sao_Paulo';
const LOCALE = 'pt-BR';

/**
 * Retorna a data/hora atuais. Útil como exemplo mínimo de tool use — sem
 * inputs, sem chamadas externas — e como ponto de verdade pro modelo quando
 * a pergunta envolve "hoje", "agora", "que dia da semana é".
 */
export const currentTime = tool({
  description:
    'Retorna a data e hora atuais (fuso America/Sao_Paulo, pt-BR). Use quando a pergunta envolver "agora", "hoje", dia/hora local.',
  parameters: z.object({}),
  execute: async () => {
    const now = new Date();
    return {
      iso: now.toISOString(),
      locale: LOCALE,
      timezone: TIMEZONE,
      // Formato legível pro modelo citar diretamente sem precisar reformatar
      // o ISO. Intl resolve o fuso corretamente mesmo se o host estiver em UTC.
      formatted: now.toLocaleString(LOCALE, {
        timeZone: TIMEZONE,
        dateStyle: 'full',
        timeStyle: 'long',
      }),
    };
  },
});
