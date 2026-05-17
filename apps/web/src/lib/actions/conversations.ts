'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { prisma } from '@repo/database';

import { auth } from '@/lib/auth';
import { isValidModelId } from '@/lib/models';
import type {
  ConversationSummary,
  GroupedConversations,
} from '@/components/app/conversation-list';

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  return session.user.id;
}

function groupByPeriod(conversations: ConversationSummary[]): GroupedConversations {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfLast7 = new Date(startOfToday);
  startOfLast7.setDate(startOfLast7.getDate() - 7);

  const groups: GroupedConversations = {
    hoje: [],
    ontem: [],
    ultimos7Dias: [],
    anteriores: [],
  };
  for (const c of conversations) {
    if (c.updatedAt >= startOfToday) groups.hoje.push(c);
    else if (c.updatedAt >= startOfYesterday) groups.ontem.push(c);
    else if (c.updatedAt >= startOfLast7) groups.ultimos7Dias.push(c);
    else groups.anteriores.push(c);
  }
  return groups;
}

function revalidateShell(): void {
  // (app)/layout.tsx fetches the conversations; invalidating the layout cache
  // for /chat refreshes the sidebar across the whole app.
  revalidatePath('/chat', 'layout');
  revalidatePath('/documents', 'layout');
}

export async function listConversations(): Promise<GroupedConversations> {
  const userId = await requireUserId();
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, model: true, updatedAt: true },
  });
  return groupByPeriod(conversations);
}

export async function createConversation(model: string): Promise<{ id: string }> {
  const userId = await requireUserId();
  const conversation = await prisma.conversation.create({
    data: { userId, model, title: 'Nova conversa' },
    select: { id: true },
  });
  revalidateShell();
  return conversation;
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const userId = await requireUserId();
  const trimmed = title.trim().slice(0, 200);
  if (trimmed.length === 0) throw new Error('Título não pode ser vazio.');

  // updateMany + where userId garante checagem de posse atômica.
  const updated = await prisma.conversation.updateMany({
    where: { id, userId },
    data: { title: trimmed },
  });
  if (updated.count === 0) throw new Error('Conversa não encontrada.');
  revalidateShell();
}

export async function updateConversationModel(id: string, model: string): Promise<void> {
  const userId = await requireUserId();
  if (!isValidModelId(model)) throw new Error('Modelo inválido.');

  const updated = await prisma.conversation.updateMany({
    where: { id, userId },
    data: { model },
  });
  if (updated.count === 0) throw new Error('Conversa não encontrada.');
  revalidateShell();
}

export async function deleteConversation(id: string): Promise<void> {
  const userId = await requireUserId();
  const deleted = await prisma.conversation.deleteMany({
    where: { id, userId },
  });
  if (deleted.count === 0) throw new Error('Conversa não encontrada.');
  revalidateShell();
}
