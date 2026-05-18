import * as React from 'react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import type { Message } from 'ai';

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

  const initialMessages: Message[] = conversation.messages
    .filter((m) => m.role !== MessageRole.TOOL)
    .map((m) => {
      const attachments = filePartsToAttachments(m.content);
      return {
        id: m.id,
        role: dbRoleToUIRole(m.role),
        content: partsToText(m.content),
        // Reidrata a UI com os anexos enviados originalmente. Sem isso, F5
        // perderia thumbnails e o usuário acharia que o arquivo sumiu.
        ...(attachments.length > 0 && { experimental_attachments: attachments }),
      };
    });

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

// Mensagens são persistidas como array de parts JSON (ver api/chat/route.ts).
// Convertemos pra string aqui porque v4 Message espera `content: string`.
function partsToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const out: string[] = [];
  for (const p of content) {
    if (
      p !== null &&
      typeof p === 'object' &&
      'type' in p &&
      (p as { type: unknown }).type === 'text' &&
      'text' in p &&
      typeof (p as { text: unknown }).text === 'string'
    ) {
      out.push((p as { text: string }).text);
    }
  }
  return out.join('\n');
}

function filePartsToAttachments(
  content: unknown,
): Array<{ url: string; contentType?: string }> {
  if (!Array.isArray(content)) return [];
  const out: Array<{ url: string; contentType?: string }> = [];
  for (const p of content) {
    if (
      p !== null &&
      typeof p === 'object' &&
      'type' in p &&
      (p as { type: unknown }).type === 'file' &&
      'url' in p &&
      typeof (p as { url: unknown }).url === 'string'
    ) {
      const mediaType =
        'mediaType' in p && typeof (p as { mediaType: unknown }).mediaType === 'string'
          ? (p as { mediaType: string }).mediaType
          : undefined;
      out.push({
        url: (p as { url: string }).url,
        contentType: mediaType,
      });
    }
  }
  return out;
}
