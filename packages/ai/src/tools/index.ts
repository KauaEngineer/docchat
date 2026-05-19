import type { Tool } from 'ai';

import { calculator } from './calculator';
import { currentTime } from './current-time';
import { webSearch } from './web-search';

// Registry estático — adicionar uma tool aqui automaticamente a expõe pro
// getTools(). Os nomes são as keys que vão pro objeto que o streamText recebe
// em `tools: {...}`; o modelo enxerga exatamente essa string.
//
// Tipagem propositalmente larga (Record<string, Tool>): cada tool tem seu
// próprio schema/execute, e perdemos pouco no consumer (que só passa o objeto
// adiante pro streamText). Manter o tipo estreito aqui forçaria genéricos
// complicados sem ganho real.
// Tipo explícito (em vez de `satisfies`) porque o inferido a partir do literal
// vazaria tipos internos das tools (ex.: TavilyResult) que não exportamos,
// disparando TS4023 ao publicar o módulo via declaration files.
const REGISTRY: Record<string, Tool> = {
  calculator,
  currentTime,
  webSearch,
};

export type ToolName = 'calculator' | 'currentTime' | 'webSearch';

export const ALL_TOOL_NAMES: ToolName[] = ['calculator', 'currentTime', 'webSearch'];

/**
 * Retorna um subconjunto do registry pra passar direto em `streamText({tools})`.
 *
 * Nomes desconhecidos são ignorados silenciosamente — o caller normalmente
 * lê de input do usuário ou de config, e errar um nome não deve quebrar
 * todo o turno. Quando a lista está vazia, retorna `undefined` em vez de
 * `{}` pra deixar o streamText decidir o default (não habilitar tool use).
 */
export function getTools(opts: {
  enabled: readonly string[];
}): Record<string, Tool> | undefined {
  if (opts.enabled.length === 0) return undefined;

  const out: Record<string, Tool> = {};
  for (const name of opts.enabled) {
    const t = REGISTRY[name];
    if (t) out[name] = t;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export { calculator, currentTime, webSearch };
