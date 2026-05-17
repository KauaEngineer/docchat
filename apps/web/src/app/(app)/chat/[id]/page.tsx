import * as React from 'react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import type { UIMessage, UIMessagePart } from 'ai';

import { MessageRole, prisma } from '@repo/database';

import { auth } from '@/lib/auth';

import { Chat } from '@/components/chat/chat';

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      model: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true },
      },
    },
  });

  if (!conversation) notFound();

  const initialMessages: UIMessage[] = conversation.messages
    .filter((m) => m.role !== MessageRole.TOOL)
    .map((m) => ({
      id: m.id,
      role: dbRoleToUIRole(m.role),
      parts: m.content as unknown as UIMessagePart<never, never>[],
    }));

  return (
    <Chat
      conversationId={conversation.id}
      initialMessages={initialMessages}
      initialModel={conversation.model}
    />
  );
}

function dbRoleToUIRole(role: MessageRole): 'user' | 'assistant' | 'system' {
  switch (role) {
    case MessageRole.USER:
      return 'user';
    case MessageRole.ASSISTANT:
      return 'assistant';
    case MessageRole.SYSTEM:
      return 'system';
    case MessageRole.TOOL:
      return 'assistant';
  }
}
