'use client';

import * as React from 'react';
import { Loader2Icon } from 'lucide-react';
import type { Message } from 'ai';

import { MessageBubble } from './message-bubble';

export type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error';

export function MessageList({
  messages,
  status,
}: {
  messages: Message[];
  status: ChatStatus;
}) {
  const showThinking =
    (status === 'submitted' || status === 'streaming') &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === 'user';

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 py-6">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}

      {showThinking ? <ThinkingIndicator /> : null}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 py-3 pl-10 text-sm">
      <Loader2Icon className="size-3.5 animate-spin" />
      Pensando...
    </div>
  );
}
