'use client';

import * as React from 'react';
import type { Message } from 'ai';

import {
  useArtifactStore,
  type StreamingKind,
} from '@/lib/stores/artifact-store';

export interface ArtifactStreamingResult {
  isStreaming: boolean;
  partialContent: string;
  title: string | null;
  kind: StreamingKind | null;
}

const EMPTY: ArtifactStreamingResult = {
  isStreaming: false,
  partialContent: '',
  title: null,
  kind: null,
};

/**
 * Detecta uma tool call `createArtifact` em curso na lista de mensagens do
 * useChat e, enquanto ela durar, expõe o conteúdo parcial. Também:
 *
 * - Atualiza a store global pra o painel poder consumir.
 * - Auto-abre o painel quando o stream tem um título resolvido (gate: sem
 *   título a gente não consegue abrir nada útil, e abrir um painel vazio
 *   "pisca" feio na UX).
 *
 * Por que percorrer parts em vez de só `message.toolInvocations`?
 *   `toolInvocations` está deprecado no v4 e não carrega o último estado em
 *   alguns paths de stream. `parts` é o canal canônico — o mesmo que o
 *   MessageBubble já usa pra renderizar.
 *
 * Por que olhar APENAS createArtifact e não updateArtifact?
 *   updateArtifact espera conteúdo completo num único shot; não dá pra
 *   "ver" o diff sendo construído. Já o create tem o `content` crescendo
 *   token a token enquanto a `partial-call` dura — daí o live preview.
 */
export function useArtifactStreaming(opts: {
  messages: Message[];
  conversationId: string;
}): ArtifactStreamingResult {
  const { messages, conversationId } = opts;

  const setOpen = useArtifactStore((s) => s.setOpen);
  const setStreaming = useArtifactStore((s) => s.setStreaming);

  // Deriva o estado da última createArtifact (qualquer state). Usar useMemo
  // garante referência estável quando as parts não mudaram entre renders.
  const derived = React.useMemo<ArtifactStreamingResult>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!m || m.role !== 'assistant') continue;
      const parts = m.parts;
      if (!Array.isArray(parts)) continue;
      for (let j = parts.length - 1; j >= 0; j--) {
        const p = parts[j];
        if (!p || p.type !== 'tool-invocation') continue;
        const inv = p.toolInvocation;
        if (inv.toolName !== 'createArtifact') continue;
        // args durante `partial-call` pode estar parcialmente parseado:
        // `parsePartialJson` do SDK retorna best-effort, então campos podem
        // estar undefined ou strings curtas. Tratamos tudo como opcional.
        const args = (inv.args ?? {}) as {
          title?: string;
          kind?: string;
          content?: string;
        };
        return {
          isStreaming: inv.state === 'partial-call',
          partialContent: typeof args.content === 'string' ? args.content : '',
          title: typeof args.title === 'string' && args.title.length > 0 ? args.title : null,
          kind: isStreamingKind(args.kind) ? args.kind : null,
        };
      }
    }
    return EMPTY;
  }, [messages]);

  // Sincroniza com a store. Quando não há createArtifact algum, limpa.
  // Sem `title` (args ainda não trouxe o campo), também não publicamos —
  // o painel não conseguiria fazer matching com openArtifact.
  React.useEffect(() => {
    if (derived.title === null) {
      setStreaming(null);
      return;
    }
    setStreaming({
      conversationId,
      title: derived.title,
      kind: derived.kind,
      content: derived.partialContent,
      isLive: derived.isStreaming,
    });
  }, [
    derived.title,
    derived.kind,
    derived.partialContent,
    derived.isStreaming,
    conversationId,
    setStreaming,
  ]);

  // Auto-open: quando começa o stream (isStreaming flipa pra true) com título
  // disponível, abre o painel. Não fechamos automaticamente — se o usuário
  // navegou pra outra conversa ou fechou de propósito, respeitamos.
  //
  // Reabrir múltiplas vezes durante o mesmo stream é idempotente (mesmo
  // {conversationId, title}), então não precisa de guard extra.
  React.useEffect(() => {
    if (derived.isStreaming && derived.title) {
      setOpen({ conversationId, title: derived.title });
    }
  }, [derived.isStreaming, derived.title, conversationId, setOpen]);

  return derived;
}

function isStreamingKind(v: unknown): v is StreamingKind {
  return v === 'CODE' || v === 'HTML' || v === 'SVG' || v === 'MARKDOWN';
}
