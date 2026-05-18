import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import {
  convertToCoreMessages,
  createIdGenerator,
  generateText,
  streamText,
  type Message,
} from 'ai';
import { z } from 'zod';

import { getModel, systemPrompt } from '@repo/ai';
import { MessageRole, prisma, type Prisma } from '@repo/database';

import { auth } from '@/lib/auth';

// Prisma + better-auth precisam de runtime Node (não edge).
export const runtime = 'nodejs';
// Streaming pode demorar; aumenta o limite default da Vercel (10s).
export const maxDuration = 60;

// useChat v4 (sem `sendExtraMessageFields`) envia mensagens só com
// { role, content, ...campos opcionais } — sem `id`. Os ids são gerados
// server-side ao persistir, então não precisamos exigir do cliente.
const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system', 'data']),
        content: z.string(),
      }),
    )
    .min(1),
  conversationId: z.string().min(1),
  model: z.string().min(1),
  // Edição inline: id da user message que está sendo reeditada. O servidor
  // apaga essa msg + todas posteriores (cascade), depois persiste a nova versão.
  editFromMessageId: z.string().min(1).optional(),
});

const idGen = createIdGenerator();

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return jsonError(401, 'Não autenticado.');

    const raw = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      // Em dev devolve detalhes dos issues — sem isso o 400 vira caixa preta.
      const detail =
        process.env['NODE_ENV'] === 'production'
          ? undefined
          : parsed.error.flatten();
      console.error('[chat] body inválido:', detail ?? parsed.error.issues);
      return jsonError(400, 'Body inválido.', detail);
    }

    const { messages, conversationId, model, editFromMessageId } = parsed.data;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true, title: true },
    });
    if (!conversation) return jsonError(404, 'Conversa não encontrada.');
    if (conversation.userId !== session.user.id) {
      return jsonError(403, 'Acesso negado.');
    }

    const lastReqMessage = messages[messages.length - 1]!;
    const lastReqUser = findLastUserMessage(messages);
    if (!lastReqUser) {
      return jsonError(400, 'Nenhuma mensagem de usuário enviada.');
    }

    // -------------------------------------------------------------------------
    // Decisão de modo: edição, regenerate, ou novo turno.
    //
    // Edição (editFromMessageId vem do cliente):
    //   apaga a msg-alvo + tudo depois (cascade cuida de Artifact/Attachment),
    //   depois persiste a versão editada como nova user message.
    //
    // Regenerate explícito (request termina em assistant):
    //   defensivo — useChat.reload() do v4 nunca produz isso, mas mantemos
    //   pra cobrir clientes/fluxos custom.
    //
    // Regenerate via reload() do v4:
    //   o SDK strip a última assistant localmente antes de reenviar. O request
    //   acaba com a MESMA user que já está no banco. Detectamos comparando
    //   contagem de user-msgs do request vs banco — se igual, é regenerate
    //   (apaga trailing assistant/tool sem duplicar a user).
    //
    // Novo turno:
    //   request tem uma user a mais que o banco. Persiste normalmente.
    // -------------------------------------------------------------------------

    if (editFromMessageId) {
      const target = await prisma.message.findUnique({
        where: { id: editFromMessageId },
        select: { conversationId: true, createdAt: true },
      });
      if (!target || target.conversationId !== conversationId) {
        return jsonError(404, 'Mensagem para editar não encontrada.');
      }
      // Branch destrutivo (escopo de portfólio — sem manter histórico).
      // onDelete: Cascade em Artifact/Attachment limpa as dependências.
      await prisma.message.deleteMany({
        where: {
          conversationId,
          createdAt: { gte: target.createdAt },
        },
      });
      await prisma.message.create({
        data: {
          conversationId,
          role: MessageRole.USER,
          content: textToParts(lastReqUser.content) as unknown as Prisma.InputJsonValue,
        },
      });
    } else if (lastReqMessage.role === 'assistant') {
      await deleteTrailingAfterLastUser(conversationId);
    } else {
      const reqUserCount = messages.filter((m) => m.role === 'user').length;
      const dbUserCount = await prisma.message.count({
        where: { conversationId, role: MessageRole.USER },
      });

      if (reqUserCount === dbUserCount) {
        // Regenerate via reload(): mesma user que já existe no banco.
        await deleteTrailingAfterLastUser(conversationId);
      } else {
        // Novo turno: persiste a user message.
        await prisma.message.create({
          data: {
            conversationId,
            role: MessageRole.USER,
            content: textToParts(lastReqUser.content) as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }

    const dbMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true },
    });

    const history: Message[] = dbMessages
      .filter((m) => m.role !== MessageRole.TOOL)
      .map((m) => ({
        id: m.id,
        role: dbRoleToUIRole(m.role),
        content: partsToText(m.content),
      }));

    const userName = session.user.name ?? undefined;

    const result = streamText({
      model: getModel(model),
      system: systemPrompt({ userName, hasRAG: false, hasTools: false }),
      messages: convertToCoreMessages(history),
      temperature: 0.7,
      maxTokens: 8000,
      onFinish: async ({ text, finishReason }) => {
        try {
          // Se a resposta veio vazia (erro antes do primeiro chunk), não
          // grava — senão poluímos o histórico com mensagens vazias que
          // depois quebram a conversão pro modelo na próxima rodada.
          if (!text || text.trim().length === 0) return;

          await prisma.message.create({
            data: {
              id: idGen(),
              conversationId,
              role: MessageRole.ASSISTANT,
              content: textToParts(text) as unknown as Prisma.InputJsonValue,
            },
          });

          // Bump explícito do updatedAt — @updatedAt do Prisma só dispara em
          // writes na própria row de Conversation.
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });

          // Título: gera APENAS se ainda estiver vazio/null. Fresh read pra
          // evitar race com requests concorrentes que já possam ter setado.
          // Sem essa checagem, regenerate/edit triggariam regeração do título
          // a cada turno (que é o que o spec proíbe).
          if (finishReason !== 'error') {
            const fresh = await prisma.conversation.findUnique({
              where: { id: conversationId },
              select: { title: true },
            });
            if (!fresh?.title || fresh.title.trim() === '') {
              await generateAndSaveTitle(conversationId, lastReqUser.content);
            }
          }

          revalidatePath('/chat', 'layout');
        } catch (err) {
          console.error('[chat] onFinish persist error:', err);
        }
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage: (error) => {
        logStreamError('toDataStreamResponse.getErrorMessage', error);
        // Em dev devolve a mensagem real pro toast/console do cliente —
        // sem isso o usuário só vê "Erro ao gerar resposta" e não dá
        // pra diagnosticar. Em prod fica genérico pra não vazar detalhes.
        return formatStreamErrorForClient(error);
      },
    });
  } catch (err) {
    console.error('[chat] route error:', err);
    return jsonError(500, 'Erro interno.');
  }
}

// Apaga tudo após a última user message — tipicamente a assistant gerada
// nessa rodada + quaisquer TOOL messages associadas. Usado em regenerate.
async function deleteTrailingAfterLastUser(conversationId: string): Promise<void> {
  const lastUser = await prisma.message.findFirst({
    where: { conversationId, role: MessageRole.USER },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!lastUser) return;
  await prisma.message.deleteMany({
    where: {
      conversationId,
      createdAt: { gt: lastUser.createdAt },
    },
  });
}

function findLastUserMessage(
  messages: { role: 'user' | 'assistant' | 'system' | 'data'; content: string }[],
): { content: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role === 'user') return { content: m.content };
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

// Convenção do projeto: persistimos message.content como array de parts JSON.
// Mantém compatibilidade com mensagens já salvas em formatos anteriores.
function textToParts(text: string): Array<{ type: 'text'; text: string }> {
  return [{ type: 'text', text }];
}

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

async function generateAndSaveTitle(
  conversationId: string,
  userText: string,
): Promise<void> {
  const text = userText.trim();
  if (text.length === 0) return;

  try {
    const { text: generated } = await generateText({
      // Reaproveita o modelo default do projeto — evita dependência de
      // outro provider só pra gerar título (e estourar quota dele).
      model: getModel('claude-sonnet-4-5'),
      prompt:
        'Gere um título curto (máximo 50 caracteres) em português brasileiro para esta conversa, baseado na primeira mensagem do usuário abaixo. Responda APENAS com o título — sem aspas, sem prefixos como "Título:", sem pontuação final.\n\n' +
        `Mensagem: """${text.slice(0, 1000)}"""`,
      maxTokens: 60,
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

function logStreamError(label: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[chat] ${label}:`, {
      name: error.name,
      message: error.message,
      cause: error.cause,
      stack: error.stack,
    });
  } else {
    console.error(`[chat] ${label} (non-Error):`, error);
  }
}

function formatStreamErrorForClient(error: unknown): string {
  if (process.env['NODE_ENV'] === 'production') {
    return 'Erro ao gerar resposta.';
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return typeof error === 'string' ? error : 'Erro ao gerar resposta.';
}

function jsonError(status: number, message: string, detail?: unknown): Response {
  return new Response(JSON.stringify({ error: message, detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
