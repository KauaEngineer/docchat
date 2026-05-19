import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import {
  StreamData,
  convertToCoreMessages,
  createIdGenerator,
  generateText,
  streamText,
  type JSONValue,
  type Message,
} from 'ai';
import { z } from 'zod';

import { getModel, systemPrompt } from '@repo/ai';
import { embedQuery } from '@repo/ai/rag';
import { getTools } from '@repo/ai/tools';
import {
  MessageRole,
  getLatestArtifact,
  prisma,
  searchSimilarChunks,
  type ArtifactKind,
  type Prisma,
} from '@repo/database';

import { auth } from '@/lib/auth';

// Prisma + better-auth precisam de runtime Node (não edge).
export const runtime = 'nodejs';
// Streaming pode demorar; aumenta o limite default da Vercel (10s).
export const maxDuration = 60;

// useChat v4 (sem `sendExtraMessageFields`) envia mensagens só com
// { role, content, ...campos opcionais } — sem `id`. Os ids são gerados
// server-side ao persistir, então não precisamos exigir do cliente.
const AttachmentSchema = z.object({
  name: z.string().optional(),
  contentType: z.string().optional(),
  url: z.string(),
});

const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system', 'data']),
        content: z.string(),
        // useChat v4 propaga experimental_attachments do append() pro POST.
        // O array vem com { name?, contentType?, url } por anexo.
        experimental_attachments: z.array(AttachmentSchema).optional(),
      }),
    )
    .min(1),
  conversationId: z.string().min(1),
  model: z.string().min(1),
  // Edição inline: id da user message que está sendo reeditada. O servidor
  // apaga essa msg + todas posteriores (cascade), depois persiste a nova versão.
  editFromMessageId: z.string().min(1).optional(),
  // Ids das Attachment rows criadas no upload (POST /api/upload). Usado pra
  // linkar messageId após persistir a user message.
  attachmentIds: z.array(z.string()).optional(),
  // Quando true, embeda a última user message + busca chunks similares dos
  // documentos do usuário e injeta no system prompt antes do streamText.
  useRAG: z.boolean().optional(),
  // Nomes das tools habilitadas para este turno. Subconjunto de
  // ALL_TOOL_NAMES — nomes desconhecidos são filtrados pelo getTools.
  tools: z.array(z.string()).optional(),
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

    const {
      messages,
      conversationId,
      model,
      editFromMessageId,
      attachmentIds,
      useRAG,
      tools: requestedTools,
    } = parsed.data;

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

    const userContentParts = buildUserContentParts(
      lastReqUser.content,
      lastReqUser.attachments,
    );

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
      const created = await prisma.message.create({
        data: {
          conversationId,
          role: MessageRole.USER,
          content: userContentParts as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      await linkAttachments(attachmentIds, session.user.id, created.id);
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
        const created = await prisma.message.create({
          data: {
            conversationId,
            role: MessageRole.USER,
            content: userContentParts as unknown as Prisma.InputJsonValue,
          },
          select: { id: true },
        });
        await linkAttachments(attachmentIds, session.user.id, created.id);
      }
    }

    const dbMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true },
    });

    // Reconstrói experimental_attachments dos file parts persistidos, senão
    // o modelo não recebe o anexo de volta nos turnos seguintes/regenerate.
    const history: Message[] = dbMessages
      .filter((m) => m.role !== MessageRole.TOOL)
      .map((m) => {
        const files = filePartsToAttachments(m.content);
        return {
          id: m.id,
          role: dbRoleToUIRole(m.role),
          content: partsToText(m.content),
          ...(files.length > 0 && { experimental_attachments: files }),
        };
      });

    const userName = session.user.name ?? undefined;

    // ----- RAG (opcional) ---------------------------------------------------
    // Se o usuário ligou o toggle, embeda a última mensagem dele e busca
    // chunks similares dos próprios documentos. Falhas aqui são silenciosas:
    // logamos e seguimos sem contexto — perder RAG é melhor que perder o turno.
    let ragAddendum: string | null = null;
    let ragSources: RagSource[] = [];
    if (useRAG) {
      try {
        const result = await runRAG(lastReqUser.content, session.user.id);
        ragAddendum = result.systemAddendum;
        ragSources = result.sources;
      } catch (err) {
        console.error('[chat] RAG falhou (seguindo sem contexto):', err);
      }
    }

    // Tools: filtra o que o cliente pediu contra o registry. Nomes inválidos
    // são silenciosamente ignorados pelo getTools, que SEMPRE devolve pelo
    // menos as ALWAYS_ON (artefatos) mesmo quando `enabled` está vazio.
    const toolset = getTools({ enabled: requestedTools ?? [] });

    // `hasTools` controla a seção genérica "Tools" do system prompt; ela só
    // faz sentido quando o usuário ligou alguma toggleable (calc/search/time).
    // Artefatos têm sua própria seção dedicada, sempre presente.
    const baseSystem = systemPrompt({
      userName,
      hasRAG: ragAddendum !== null,
      hasTools: (requestedTools?.length ?? 0) > 0,
    });
    const finalSystem = ragAddendum
      ? `${baseSystem}\n\n${ragAddendum}`
      : baseSystem;

    // StreamData injeta as fontes como annotation da assistant message que
    // está sendo gerada. O cliente lê em `message.annotations` e mostra o
    // bloco "Fontes" sem esperar reload da página.
    const streamData =
      ragSources.length > 0 ? new StreamData() : null;
    if (streamData) {
      // RagSource[] não tem index signature → cast pra JSONValue. O shape
      // continua sendo JSON-puro em runtime.
      streamData.appendMessageAnnotation({
        type: 'rag-context',
        sources: ragSources as unknown as JSONValue,
      });
    }

    const result = streamText({
      model: getModel(model),
      system: finalSystem,
      messages: convertToCoreMessages(history),
      temperature: 0.7,
      maxTokens: 8000,
      // Multi-step tool use: o modelo pode chamar tools repetidamente até
      // 5 passos. v4 SDK usa `maxSteps`; é o equivalente do stopWhen:
      // stepCountIs(5) que aparece na doc v5.
      maxSteps: 5,
      tools: toolset,
      // Habilita o estado `partial-call` no UI (args streamando token a
      // token). Sem isso o cliente só vê `call` → `result`, perdendo o
      // feedback "Preparando ..." enquanto o modelo monta o args JSON.
      toolCallStreaming: true,
      onFinish: async ({ text, finishReason, steps }) => {
        // O close precisa rodar mesmo se a persistência abaixo der ruim,
        // senão a conexão fica pendurada e o cliente trava no streaming.
        try {
          // Se a resposta veio vazia (erro antes do primeiro chunk), não
          // grava — senão poluímos o histórico com mensagens vazias que
          // depois quebram a conversão pro modelo na próxima rodada.
          if (!text || text.trim().length === 0) return;

          const assistantMessage = await prisma.message.create({
            data: {
              id: idGen(),
              conversationId,
              role: MessageRole.ASSISTANT,
              content: assistantParts(text, ragSources) as unknown as Prisma.InputJsonValue,
            },
            select: { id: true },
          });

          // Artefatos: o modelo pode ter chamado createArtifact/updateArtifact
          // em qualquer step do multi-step. Iteramos todos os steps e
          // persistimos as rows linkadas à message recém-criada. Falhas aqui
          // não abortam o turno — logamos e seguimos (o texto da resposta já
          // foi salvo, o usuário não deve perder isso por um bug do artifact).
          try {
            await persistArtifactsFromSteps({
              conversationId,
              messageId: assistantMessage.id,
              steps,
            });
          } catch (err) {
            console.error('[chat] artifact persist error:', err);
          }

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
        } finally {
          // close() é idempotente o suficiente; sem isso o StreamData mantém
          // o canal aberto após o stream encerrar.
          streamData?.close();
        }
      },
    });

    return result.toDataStreamResponse({
      ...(streamData ? { data: streamData } : {}),
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

type ReqAttachment = { name?: string; contentType?: string; url: string };

function findLastUserMessage(
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'data';
    content: string;
    experimental_attachments?: ReqAttachment[];
  }>,
): { content: string; attachments: ReqAttachment[] } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role === 'user') {
      return {
        content: m.content,
        attachments: m.experimental_attachments ?? [],
      };
    }
  }
  return null;
}

// Liga as Attachment rows (criadas no upload com messageId=null) à user
// message recém-persistida. Checa userId pra impedir cross-user, e
// `messageId: null` pra não reescrever links já existentes.
async function linkAttachments(
  attachmentIds: string[] | undefined,
  userId: string,
  messageId: string,
): Promise<void> {
  if (!attachmentIds || attachmentIds.length === 0) return;
  await prisma.attachment.updateMany({
    where: {
      id: { in: attachmentIds },
      userId,
      messageId: null,
    },
    data: { messageId },
  });
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

// Convenção do projeto: persistimos message.content como array de parts JSON
// com type 'text' | 'file' | 'rag-context'. Mantém compatibilidade com
// mensagens antigas (puras de texto) ao mesmo tempo que carrega anexos
// e o contexto recuperado pra exibição "Fontes" na UI.
export interface RagSource {
  documentId: string;
  filename: string;
  similarity: number;
  content: string;
}

type StoredPart =
  | { type: 'text'; text: string }
  | { type: 'file'; url: string; mediaType: string }
  | { type: 'rag-context'; sources: RagSource[] };

function buildUserContentParts(
  text: string,
  attachments: ReqAttachment[] | undefined,
): StoredPart[] {
  const parts: StoredPart[] = [];
  if (text.length > 0) {
    parts.push({ type: 'text', text });
  }
  if (attachments && attachments.length > 0) {
    for (const a of attachments) {
      parts.push({
        type: 'file',
        url: a.url,
        mediaType: a.contentType ?? 'application/octet-stream',
      });
    }
  }
  // Garante pelo menos um part — Prisma aceita array vazio mas convertToCore
  // pode reclamar de mensagens vazias.
  if (parts.length === 0) parts.push({ type: 'text', text: '' });
  return parts;
}

function assistantParts(text: string, sources: RagSource[]): StoredPart[] {
  const parts: StoredPart[] = [{ type: 'text', text }];
  if (sources.length > 0) {
    parts.push({ type: 'rag-context', sources });
  }
  return parts;
}

// -----------------------------------------------------------------------------
// Artefatos: materializa as tool calls de createArtifact/updateArtifact em
// rows na tabela `artifacts`, ligadas à message recém-persistida.
// -----------------------------------------------------------------------------

interface StepLike {
  toolCalls?: ReadonlyArray<{
    toolCallId: string;
    toolName: string;
    args: unknown;
  }>;
  toolResults?: ReadonlyArray<{
    toolCallId: string;
    result: unknown;
  }>;
}

interface CreateArtifactArgs {
  kind: ArtifactKind;
  title: string;
  language?: string;
  content: string;
}

interface UpdateArtifactArgs {
  title: string;
  content: string;
}

async function persistArtifactsFromSteps(args: {
  conversationId: string;
  messageId: string;
  steps: readonly StepLike[];
}): Promise<void> {
  for (const step of args.steps) {
    const calls = step.toolCalls ?? [];
    const results = step.toolResults ?? [];

    for (const call of calls) {
      // Só persiste se a tool retornou success=true. Falhas (`{ error }`) ou
      // resultados ausentes — o tool foi chamado mas o execute não rodou —
      // são ignorados aqui; o registro existe no histórico do stream pra
      // depuração, mas não vira artefato persistente.
      const result = results.find((r) => r.toolCallId === call.toolCallId);
      if (!isSuccessResult(result?.result)) continue;

      if (call.toolName === 'createArtifact') {
        const a = call.args as CreateArtifactArgs;
        await prisma.artifact.create({
          data: {
            messageId: args.messageId,
            kind: a.kind,
            title: a.title,
            content: a.content,
            language: a.language ?? null,
            version: 1,
          },
        });
        continue;
      }

      if (call.toolName === 'updateArtifact') {
        const a = call.args as UpdateArtifactArgs;
        // "Atualizar" = nova row com version+1, herdando kind/language do
        // último (o usuário pediu pra modificar o que já existia, não pra
        // mudar a natureza do artefato).
        const latest = await getLatestArtifact(args.conversationId, a.title);
        if (!latest) {
          // Modelo pediu update de um artefato que nunca foi criado —
          // pode acontecer se o título não bater exatamente. Loga e segue;
          // não promovemos pra create silencioso (escolha do modelo, não nossa).
          console.warn(
            `[chat] updateArtifact("${a.title}"): nenhum artefato anterior nesta conversa, ignorando.`,
          );
          continue;
        }
        await prisma.artifact.create({
          data: {
            messageId: args.messageId,
            kind: latest.kind,
            title: latest.title,
            content: a.content,
            language: latest.language,
            version: latest.version + 1,
          },
        });
      }
    }
  }
}

function isSuccessResult(result: unknown): boolean {
  return (
    result !== null &&
    typeof result === 'object' &&
    'success' in result &&
    (result as { success: unknown }).success === true
  );
}

// ----- RAG --------------------------------------------------------------------

async function runRAG(
  query: string,
  userId: string,
): Promise<{ systemAddendum: string | null; sources: RagSource[] }> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { systemAddendum: null, sources: [] };

  const embedding = await embedQuery(trimmed);
  const chunks = await searchSimilarChunks(embedding, userId, 5, 0.7);
  if (chunks.length === 0) return { systemAddendum: null, sources: [] };

  const sources: RagSource[] = chunks.map((c) => ({
    documentId: c.documentId,
    filename: c.filename,
    // Trunca o conteúdo persistido pra evitar inflar a row da mensagem
    // (cada chunk tem ~1KB; 5 chunks = 5KB, ok pra Json column).
    content: c.content,
    similarity: Number(c.similarity.toFixed(4)),
  }));

  const blocks = sources
    .map(
      (s) =>
        `[Documento: ${s.filename}, similaridade: ${s.similarity.toFixed(2)}]\n${s.content}`,
    )
    .join('\n---\n');

  const systemAddendum =
    `Contexto recuperado dos documentos do usuário:\n---\n${blocks}\n---\n\n` +
    `Use este contexto quando relevante. Cite o nome do documento ao referenciar.\n` +
    `Se o contexto não responder à pergunta, diga que não encontrou informação nos documentos ` +
    `e responda com seu conhecimento geral.`;

  return { systemAddendum, sources };
}

function filePartsToAttachments(content: unknown): ReqAttachment[] {
  if (!Array.isArray(content)) return [];
  const out: ReqAttachment[] = [];
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
