'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CodeIcon,
  FileTextIcon,
  LightbulbIcon,
  PencilLineIcon,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAppShell } from '@/components/app/sidebar';
import { createConversation } from '@/lib/actions/conversations';

import { Composer } from './composer';
import { pendingMessageKey } from './chat';

interface Suggestion {
  Icon: LucideIcon;
  label: string;
  prompt: string;
}

// Sugestões puxam o usuário pros 4 modos canônicos do chatbot: explicação,
// código, escrita e brainstorm. Clicar preenche o composer — o usuário pode
// editar antes de enviar.
const SUGGESTIONS: Suggestion[] = [
  {
    Icon: LightbulbIcon,
    label: 'Me explique',
    prompt: 'Me explique como funcionam embeddings em RAG, com um exemplo simples.',
  },
  {
    Icon: CodeIcon,
    label: 'Gere código',
    prompt: 'Escreva uma função TypeScript que faz debounce de chamadas async com cancelamento.',
  },
  {
    Icon: PencilLineIcon,
    label: 'Reescreva',
    prompt: 'Revise o texto a seguir deixando mais claro e direto:\n\n',
  },
  {
    Icon: FileTextIcon,
    label: 'Resuma',
    prompt: 'Resuma o conteúdo deste documento em até 5 bullet points:\n\n',
  },
];

export function ChatLanding({ userName }: { userName: string | null }) {
  const router = useRouter();
  const { selectedModel } = useAppShell();
  const [creating, setCreating] = React.useState(false);

  // seedValue / seedKey: ao clicar numa sugestão, preenchemos o composer
  // remontando-o via key. Composer usa initialValue só no useState inicial.
  const [seedValue, setSeedValue] = React.useState<string>('');
  const [seedKey, setSeedKey] = React.useState(0);

  const greetingName = userName?.trim().split(/\s+/)[0] ?? null;

  function applySuggestion(text: string): void {
    setSeedValue(text);
    setSeedKey((k) => k + 1);
  }

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
          key={seedKey}
          initialValue={seedValue}
          onSubmit={(text) => handleSubmit(text)}
          disabled={creating}
          isStreaming={false}
          autoFocus
          // Sem conversa ainda — anexos órfãos seriam confusos. Fluxo: cria
          // a conversa primeiro, anexa nas próximas mensagens.
          disableAttachments
          // Mesma razão pra RAG/tools: os controles aparecem a partir da
          // segunda tela, onde o usuário já tem contexto de conversa.
          disableRag
          disableTools
          placeholder="Pergunte qualquer coisa..."
        />

        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => applySuggestion(s.prompt)}
              disabled={creating}
              className="hover:bg-accent hover:border-foreground/20 group flex items-start gap-3 rounded-lg border bg-transparent p-3 text-left text-sm transition-colors disabled:opacity-50"
            >
              <div className="bg-muted text-muted-foreground group-hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-md transition-colors">
                <s.Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-xs font-medium">{s.label}</p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {s.prompt.split('\n')[0]}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
