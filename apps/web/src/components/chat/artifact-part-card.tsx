'use client';

import * as React from 'react';
import type { ToolInvocation } from 'ai';
import {
  CodeIcon,
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
} from 'lucide-react';

import { useArtifactStore } from '@/lib/stores/artifact-store';

// Mapeamento kind → ícone. SVG e HTML viram "imagem" porque visualmente são
// renderizáveis; CODE é monoespaçado; MARKDOWN é prosa.
const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CODE: CodeIcon,
  MARKDOWN: FileTextIcon,
  HTML: ImageIcon,
  SVG: ImageIcon,
};

interface CreateArgs {
  kind?: string;
  title?: string;
  language?: string;
  content?: string;
}

interface UpdateArgs {
  title?: string;
  content?: string;
}

/**
 * Card clicável renderizado no lugar do tool-invocation genérico quando a
 * tool é `createArtifact` / `updateArtifact`. Abre o painel lateral via
 * store global.
 *
 * Estados:
 * - args ainda streamando (`partial-call`) ou execução em curso (`call`) →
 *   placeholder com spinner; o clique fica desabilitado porque o título
 *   pode ainda mudar.
 * - `result` com sucesso → card final, clicável.
 *
 * Para `updateArtifact`, a "versão" exibida é determinística (próxima do
 * último), mas pra evitar uma roundtrip de leitura aqui, mostramos só "vN+"
 * de placeholder. O painel busca as versões reais ao abrir.
 */
export function ArtifactPartCard({
  invocation,
  conversationId,
}: {
  invocation: ToolInvocation;
  conversationId: string;
}) {
  const setOpen = useArtifactStore((s) => s.setOpen);

  const { toolName, state, args } = invocation;
  const isCreate = toolName === 'createArtifact';
  const isUpdate = toolName === 'updateArtifact';

  // Args durante 'partial-call' podem vir incompletos; tratamos como opcional.
  const createArgs = isCreate ? (args as CreateArgs) : null;
  const updateArgs = isUpdate ? (args as UpdateArgs) : null;

  const title = createArgs?.title ?? updateArgs?.title ?? null;
  const kind = createArgs?.kind ?? 'CODE'; // update não traz kind; assumimos genérico no card até o painel resolver
  const Icon = KIND_ICON[kind] ?? FileTextIcon;

  const isPending = state === 'partial-call' || state === 'call';
  const canOpen = !isPending && title !== null;

  function handleOpen(): void {
    if (!canOpen || !title) return;
    setOpen({ conversationId, title });
  }

  function handleKey(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  }

  return (
    <div
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : -1}
      aria-disabled={!canOpen}
      onClick={handleOpen}
      onKeyDown={handleKey}
      className={[
        'my-2 flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors',
        canOpen
          ? 'hover:bg-muted/60 hover:border-foreground/30 cursor-pointer'
          : 'opacity-70',
      ].join(' ')}
    >
      <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
        {isPending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <Icon className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {title ?? (isCreate ? 'Gerando artefato…' : 'Atualizando artefato…')}
        </div>
        <div className="text-muted-foreground text-xs">
          {subtitleFor({ isCreate, isUpdate, kind, isPending })}
        </div>
      </div>
    </div>
  );
}

function subtitleFor(opts: {
  isCreate: boolean;
  isUpdate: boolean;
  kind: string;
  isPending: boolean;
}): string {
  if (opts.isPending) {
    return opts.isCreate ? 'Criando…' : 'Atualizando…';
  }
  if (opts.isUpdate) {
    // Não temos o número real aqui sem outra query; o painel mostra o exato.
    return 'Nova versão · clique para abrir';
  }
  return `${opts.kind} · v1`;
}
