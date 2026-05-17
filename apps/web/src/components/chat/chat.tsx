'use client';

import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { toast } from 'sonner';

import { ScrollArea } from '@repo/ui/components/scroll-area';

import { useAppShell } from '@/components/app/sidebar';

import { Composer } from './composer';
import { MessageList } from './message-list';

export function pendingMessageKey(conversationId: string): string {
  return `chat:pending:${conversationId}`;
}

export function Chat({
  conversationId,
  initialMessages,
  initialModel,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  initialModel: string;
}) {
  const { selectedModel, setSelectedModel } = useAppShell();

  // Sincroniza o modelo da conversa com o context na primeira montagem.
  // O selectedModel pode estar diferente porque o usuário acabou de mudar
  // no dropdown, ou pode estar com o default (rota direta).
  // Vamos preferir o do banco — fonte da verdade pra esta conversa.
  React.useEffect(() => {
    if (selectedModel !== initialModel) {
      setSelectedModel(initialModel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Body do transport tem que ler o modelo atual a cada envio (usuário pode
  // trocar no meio da conversa). `Resolvable<object>` aceita função.
  const modelRef = React.useRef(selectedModel);
  React.useEffect(() => {
    modelRef.current = selectedModel;
  }, [selectedModel]);

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: () => ({ conversationId, model: modelRef.current }),
      }),
    [conversationId],
  );

  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
    onError: (err) => {
      console.error('[chat]', err);
      toast.error('Erro ao enviar mensagem.');
    },
  });

  // Mostra o erro como toast e libera o estado para o usuário tentar de novo.
  React.useEffect(() => {
    if (error) {
      toast.error(error.message || 'Erro ao gerar resposta.');
      clearError();
    }
  }, [error, clearError]);

  // -- Pending message (vem da landing page via sessionStorage) ---------------
  const sentPendingRef = React.useRef(false);
  React.useEffect(() => {
    if (sentPendingRef.current) return;
    try {
      const pending = window.sessionStorage.getItem(pendingMessageKey(conversationId));
      if (pending && pending.trim().length > 0) {
        sentPendingRef.current = true;
        window.sessionStorage.removeItem(pendingMessageKey(conversationId));
        void sendMessage({ text: pending });
      }
    } catch {
      // sessionStorage indisponível — ignora.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // -- Auto-scroll -----------------------------------------------------------
  // Estratégia: trackeia se o usuário está "preso no fundo". Se sim, novas
  // mensagens auto-rolam; se ele subiu manualmente, respeitamos a posição.
  const scrollRootRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLElement | null>(null);
  const stickToBottomRef = React.useRef(true);

  React.useEffect(() => {
    // Radix ScrollArea expõe o viewport via data-slot — pegamos a referência
    // uma vez para evitar querySelector em todo render.
    const root = scrollRootRef.current;
    if (!root) return;
    const viewport = root.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    viewportRef.current = viewport;
    if (!viewport) return;

    function handleScroll() {
      const el = viewportRef.current;
      if (!el) return;
      // 32px de tolerância — pequenas variações por rendering não desativam o stick.
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 32;
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    if (!stickToBottomRef.current) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    // RAF garante que o DOM da nova mensagem já foi pintado.
    requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
    });
  }, [messages, status]);

  const isStreaming = status === 'submitted' || status === 'streaming';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea ref={scrollRootRef} className="min-h-0 flex-1">
        <MessageList messages={messages} status={status} />
      </ScrollArea>

      <div className="border-t px-4 pt-3 pb-4">
        <div className="mx-auto w-full max-w-3xl">
          <Composer
            onSubmit={(text) => sendMessage({ text })}
            onStop={() => void stop()}
            isStreaming={isStreaming}
            autoFocus
          />
          <p className="text-muted-foreground mt-2 text-center text-[11px]">
            O modelo pode cometer erros. Confirme informações importantes.
          </p>
        </div>
      </div>
    </div>
  );
}
