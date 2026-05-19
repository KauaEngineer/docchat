'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { useAppShell } from '@/components/app/sidebar';
import { createConversation } from '@/lib/actions/conversations';

import { Composer } from './composer';
import { pendingMessageKey } from './chat';

export function ChatLanding({ userName }: { userName: string | null }) {
  const router = useRouter();
  const { selectedModel } = useAppShell();
  const [creating, setCreating] = React.useState(false);

  const greetingName = userName?.trim().split(/\s+/)[0] ?? null;

  async function handleSubmit(text: string): Promise<void> {
    if (creating) return;
    setCreating(true);
    try {
      const { id } = await createConversation(selectedModel);
      // Persiste a primeira mensagem no sessionStorage — o Chat lê e dispara
      // sendMessage no mount. Evita perder o texto se a navegação demorar.
      try {
        window.sessionStorage.setItem(pendingMessageKey(id), text);
      } catch {
        // sessionStorage indisponível — segue sem o seed; usuário vai precisar
        // reenviar do lado de lá.
      }
      router.push(`/chat/${id}`);
    } catch {
      toast.error('Não foi possível iniciar a conversa.');
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <h1 className="mb-6 text-center text-2xl font-semibold sm:text-3xl">
          No que posso te ajudar hoje
          {greetingName ? <>, <span className="text-primary">{greetingName}</span></> : null}?
        </h1>

        <Composer
          onSubmit={(text) => handleSubmit(text)}
          disabled={creating}
          isStreaming={false}
          autoFocus
          // Sem conversa ainda — anexos órfãos seriam confusos. Fluxo: cria
          // a conversa primeiro, anexa nas próximas mensagens.
          disableAttachments
          // Mesma razão pra RAG: o toggle aparece a partir da segunda tela,
          // onde o usuário já tem contexto de conversa.
          disableRag
          placeholder="Pergunte qualquer coisa..."
        />
      </div>
    </div>
  );
}
