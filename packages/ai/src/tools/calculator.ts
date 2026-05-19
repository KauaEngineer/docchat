import { tool } from 'ai';
import { evaluate } from 'mathjs';
import { z } from 'zod';

/**
 * Calculadora — avalia expressões matemáticas com `mathjs.evaluate`.
 *
 * Por que mathjs e não `Function(...)` ou `eval`:
 * - `eval`/`new Function` permitem expressões arbitrárias de JS (acessar globais,
 *   loops infinitos, etc.). mathjs tem um parser próprio que aceita só sintaxe
 *   matemática — sem acesso ao runtime do Node.
 * - Suporta unidades (`5 km + 200 m`), funções (`sqrt`, `log`, trig) e precisão
 *   arbitrária quando necessário.
 *
 * Toda exceção do `evaluate` (sintaxe inválida, divisão por zero simbólica, etc.)
 * vira `{ error }` em vez de propagar — o modelo lê esse erro e pode tentar
 * reformular ou explicar pro usuário.
 */
export const calculator = tool({
  description:
    'Executa cálculos matemáticos. Use para qualquer aritmética não trivial.',
  parameters: z.object({
    expression: z
      .string()
      .min(1)
      .describe('Expressão matemática, ex: 2 * (3 + 4)'),
  }),
  execute: async ({ expression }) => {
    try {
      const result = evaluate(expression) as unknown;
      // mathjs pode retornar BigNumber, Fraction, Unit, Matrix... toString()
      // é definido pra todos esses tipos e devolve a forma textual canônica.
      // Para number/string/boolean cai no toString do próprio JS.
      const value =
        typeof result === 'object' && result !== null && 'toString' in result
          ? (result as { toString(): string }).toString()
          : String(result);
      return { expression, result: value };
    } catch (err) {
      return {
        expression,
        error: err instanceof Error ? err.message : 'Erro ao avaliar a expressão.',
      };
    }
  },
});
