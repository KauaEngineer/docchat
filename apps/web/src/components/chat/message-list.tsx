'use client';

import * as React from 'react';
import { Loader2Icon } from 'lucide-react';
import type { Message } from 'ai';

import { MessageBubble } from './message-bubble';

export type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error';

export function MessageList({
  messages,
  status,
  onRegenerate,
  onEdit,
}: {
  messages: Message[];
  status: ChatStatus;
  onRegenerate?: () => void;
  onEdit?: (messageId: string, newContent: string) => void;
}) {
  const showThinking =
    (status === 'submitted' || status === 'streaming') &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === 'user';

  // Só faz sentido regenerar a ÚLTIMA assistant message — reload() do v4
  // sempre regenera a última. Os outros bubbles assistant não recebem o botão.
  const lastAssistantId = findLastAssistantId(messages);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 py-6">
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          isLastAssistant={m.id === lastAssistantId}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
        />
      ))}

      {showThinking ? <ThinkingIndicator /> : null}
    </div>
  );
}

function findLastAssistantId(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'assistant') return messages[i]!.id;
  }
  return null;
}

function ThinkingIndicator() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 py-3 pl-10 text-sm">
      <Loader2Icon className="size-3.5 animate-spin" />
      Pensando...
    </div>
  );
}
