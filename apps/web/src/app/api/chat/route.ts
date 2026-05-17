import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import {
  convertToModelMessages,
  createIdGenerator,
  generateText,
  streamText,
  type UIMessage,
  type UIMessagePart,
} from 'ai';
import { z } from 'zod';

import { getModel, systemPrompt } from '@repo/ai';
import { MessageRole, prisma, type Prisma } from '@repo/database';

import { auth } from '@/lib/auth';

// Prisma + better-auth precisam de runtime Node (não edge).
export const runtime = 'nodejs';
// Streaming pode demorar; aumenta o limite default da Vercel (10s).
export const maxDuration = 60;

const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(['user', 'assistant', 'system']),
        parts: z.array(z.any()),
      }),
    )
    .min(1),
  conversationId: z.string().min(1),
  model: z.string().min(1),
  attachmentIds: z.array(z.string()).optional(),
});

const idGen = createIdGenerator();

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return jsonError(401, 'Não autenticado.');

    const raw = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) return jsonError(400, 'Body inválido.');

    const { messages, conversationId, model } = parsed.data;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true, title: true },
    });
    if (!conversation) return jsonError(404, 'Conversa não encontrada.');
    if (conversation.userId !== session.user.id) {
      return jsonError(403, 'Acesso negado.');
    }

    const lastUserMessage = findLastUserMessage(messages);
    if (!lastUserMessage) {
      return jsonError(400, 'Nenhuma mensagem de usuário enviada.');
    }

    // Source of truth = banco. Persiste a user message antes de carregar o
    // histórico para que o que vai pro modelo bata com o que ficou salvo.
    await prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: lastUserMessage.parts as unknown as Prisma.InputJsonValue,
      },
    });

    const dbMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true },
    });

    const history: UIMessage[] = dbMessages
      .filter((m) => m.role !== MessageRole.TOOL)
      .map((m) => ({
        id: m.id,
        role: dbRoleToUIRole(m.role),
        parts: m.content as unknown as UIMessagePart<never, never>[],
      }));

    const isFirstExchange =
      dbMessages.filter((m) => m.role === MessageRole.ASSISTANT).length === 0 &&
      conversation.title === 'Nova conversa';

    // Pre-gera o id da assistant message para que o que sobe no stream bata
    // com o que vai gravar no banco no onFinish.
    const assistantId = idGen();

    const userName = session.user.name ?? undefined;

    const result = streamText({
      model: getModel(model),
      system: systemPrompt({ userName, hasRAG: false, hasTools: false }),
      messages: convertToModelMessages(history),
      temperature: 0.7,
      maxOutputTokens: 8000,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: history,
      generateMessageId: () => assistantId,
      onFinish: async ({ responseMessage, isAborted }) => {
        try {
          // Mesmo se abortado pelo cliente, persiste o que já temos —
          // perder o parcial é pior que gravar uma resposta truncada.
          await prisma.message.create({
            data: {
              id: assistantId,
              conversationId,
              role: MessageRole.ASSISTANT,
              content: responseMessage.parts as unknown as Prisma.InputJsonValue,
            },
          });

          // Bump explícito do updatedAt — @updatedAt do Prisma só dispara em
          // writes na própria row de Conversation.
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });

          if (!isAborted && isFirstExchange) {
            await generateAndSaveTitle(conversationId, lastUserMessage.parts);
          }

          revalidatePath('/chat', 'layout');
        } catch (err) {
          console.error('[chat] onFinish persist error:', err);
        }
      },
      onError: (error) => {
        console.error('[chat] stream error:', error);
        return 'Erro ao gerar resposta.';
      },
    });
  } catch (err) {
    console.error('[chat] route error:', err);
    return jsonError(500, 'Erro interno.');
  }
}

function findLastUserMessage(
  messages: { role: 'user' | 'assistant' | 'system'; parts: unknown[] }[],
): { parts: unknown[] } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role === 'user') return { parts: m.parts };
  }
  return null;
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
      // Filtrado antes; ramo só pro exhaustiveness check.
      return 'assistant';
  }
}

async function generateAndSaveTitle(
  conversationId: string,
  userParts: unknown[],
): Promise<void> {
  const text = extractText(userParts);
  if (text.length === 0) return;

  try {
    const { text: generated } = await generateText({
      model: getModel('gpt-4o-mini'),
      prompt:
        'Gere um título curto (máximo 50 caracteres) em português brasileiro para esta conversa, baseado na primeira mensagem do usuário abaixo. Responda APENAS com o título — sem aspas, sem prefixos como "Título:", sem pontuação final.\n\n' +
        `Mensagem: """${text.slice(0, 1000)}"""`,
      maxOutputTokens: 60,
      temperature: 0.3,
    });

    const cleaned = generated
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/[.!?]+$/, '')
      .slice(0, 50)
      .trim();

    if (cleaned.length === 0) return;

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: cleaned },
    });
  } catch (err) {
    console.error('[chat] title generation failed:', err);
  }
}

function extractText(parts: unknown[]): string {
  const out: string[] = [];
  for (const p of parts) {
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
  return out.join('\n').trim();
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
