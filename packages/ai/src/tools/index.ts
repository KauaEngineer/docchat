import type { Tool } from 'ai';

import { createArtifact, updateArtifact } from './artifact';
import { calculator } from './calculator';
import { currentTime } from './current-time';
import { webSearch } from './web-search';

// -----------------------------------------------------------------------------
// Registry
// -----------------------------------------------------------------------------
// Duas categorias:
//
// • TOGGLEABLE: o usuário liga/desliga no Composer (dropdown "Ferramentas").
//   O cliente passa um array `enabled` com os nomes — o que não estiver na
//   lista some pro modelo.
//
// • ALWAYS_ON: sempre presentes, fora da lista do dropdown. Artefatos entram
//   aqui porque são parte do contrato base do assistente (sem eles a UI do
//   painel lateral fica inerte) e habilitá-los manualmente seria mais um
//   passo de UX sem ganho.
//
// Tipo explícito (em vez de `satisfies`) porque o inferido a partir do literal
// vazaria tipos internos das tools (ex.: TavilyResult) que não exportamos,
// disparando TS4023 ao publicar o módulo via declaration files.

const TOGGLEABLE_REGISTRY: Record<string, Tool> = {
  calculator,
  currentTime,
  webSearch,
};

const ALWAYS_ON_REGISTRY: Record<string, Tool> = {
  createArtifact,
  updateArtifact,
};

export type ToolName = 'calculator' | 'currentTime' | 'webSearch';

export const ALL_TOOL_NAMES: ToolName[] = ['calculator', 'currentTime', 'webSearch'];

/**
 * Retorna o objeto pra passar direto em `streamText({tools})`.
 *
 * - Sempre inclui as tools ALWAYS_ON (artefatos).
 * - Adiciona as TOGGLEABLE cujo nome estiver em `enabled`.
 * - Nomes desconhecidos em `enabled` são silenciosamente ignorados.
 *
 * Diferente da versão anterior, NUNCA retorna `undefined` — artefatos
 * existem mesmo sem nenhum toggleable habilitado.
 */
export function getTools(opts: {
  enabled: readonly string[];
}): Record<string, Tool> {
  const out: Record<string, Tool> = { ...ALWAYS_ON_REGISTRY };
  for (const name of opts.enabled) {
    const t = TOGGLEABLE_REGISTRY[name];
    if (t) out[name] = t;
  }
  return out;
}

export { calculator, createArtifact, currentTime, updateArtifact, webSearch };
