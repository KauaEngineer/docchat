import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createIdGenerator, embedMany } from 'ai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

import { DocumentStatus, prisma } from '@repo/database';
import { downloadFromR2 } from '@repo/storage';

// -----------------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------------

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const EMBED_BATCH_SIZE = 100;

// Embeddings usam o provider direto da Google (não o gateway Vercel):
// `gemini-embedding-001` é gratuito e substitui o `text-embedding-004`
// (desligado pelo Google em 2026-01-14). Pedimos outputDimensionality 768
// para manter compatibilidade com a coluna vector(768) e o índice HNSW já
// existentes — o modelo gera 3072 dims por padrão. Caso queira migrar pro
// gateway no futuro, é trocar este provider sem mexer no resto do fluxo.
let cachedGoogle: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getGoogleProvider(): ReturnType<typeof createGoogleGenerativeAI> {
  if (cachedGoogle) return cachedGoogle;
  const apiKey = process.env['GOOGLE_GENERATIVE_AI_API_KEY'];
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      'GOOGLE_GENERATIVE_AI_API_KEY não definida — necessária para gerar embeddings. ' +
        'Configure no .env da raiz.',
    );
  }
  cachedGoogle = createGoogleGenerativeAI({ apiKey });
  return cachedGoogle;
}

const idGen = createIdGenerator();

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

/**
 * Pipeline completo de ingestão pra RAG. Idempotente em retry: chunks de runs
 * anteriores são apagados antes de inserir os novos.
 *
 * Fluxo:
 *   1. Busca Document e valida status === PROCESSING
 *   2. Limpa DocumentChunks antigos (idempotência em retry)
 *   3. Baixa o blob do R2
 *   4. Extrai texto (PDF / text/* / JSON)
 *   5. Chunk com RecursiveCharacterTextSplitter (1000/200)
 *   6. Em paralelo, batches de 100: embedMany(google text-embedding-004)
 *      → INSERT raw com cast ::vector (Prisma não conhece o tipo Unsupported)
 *   7. Marca Document como READY
 *
 * Erro em qualquer etapa marca o Document como FAILED com errorMessage.
 * O erro é re-lançado pro caller poder logar/tracer ele em cima.
 */
export async function ingestDocument(documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      status: true,
      mimeType: true,
      r2Key: true,
      filename: true,
    },
  });
  if (!doc) {
    throw new Error(`Document ${documentId} não encontrado.`);
  }
  if (doc.status !== DocumentStatus.PROCESSING) {
    // Se quiser reprocessar um FAILED, o caller deve resetar pra PROCESSING
    // primeiro. Falhar aqui evita ingerir 2x sem querer.
    throw new Error(
      `Document ${documentId} está em status ${doc.status}; ingestDocument só processa PROCESSING.`,
    );
  }

  try {
    // Idempotência: limpa chunks de runs anteriores (retry de FAILED resetado).
    await prisma.documentChunk.deleteMany({ where: { documentId } });

    const buffer = await downloadFromR2(doc.r2Key);
    const text = await extractText(buffer, doc.mimeType);
    if (text.trim().length === 0) {
      throw new Error('Arquivo não produziu texto extraível.');
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
      // separators padrão do splitter já são bons (paragrafo > linha > frase > char)
    });
    const chunks = await splitter.splitText(text);
    if (chunks.length === 0) {
      throw new Error('Splitter não produziu chunks.');
    }

    const indexed = chunks.map((content, chunkIndex) => ({ content, chunkIndex }));
    const batches = chunkArray(indexed, EMBED_BATCH_SIZE);

    const google = getGoogleProvider();
    const embeddingModel = google.textEmbeddingModel('gemini-embedding-001', {
      outputDimensionality: 768,
    });

    // Promise.all dispara os batches em paralelo. Se algum rejeitar, o catch
    // externo marca Document FAILED com a primeira mensagem de erro observada.
    // Granular: cada batch reembala o erro com o range de chunks pra debug.
    await Promise.all(
      batches.map(async (batch, batchIdx) => {
        try {
          const { embeddings } = await embedMany({
            model: embeddingModel,
            values: batch.map((c) => c.content),
          });
          if (embeddings.length !== batch.length) {
            throw new Error(
              `embedMany devolveu ${embeddings.length} vetores para ${batch.length} chunks.`,
            );
          }
          await insertChunks(documentId, batch, embeddings);
        } catch (err) {
          const start = batchIdx * EMBED_BATCH_SIZE;
          const end = start + batch.length - 1;
          throw new Error(
            `Falha no batch de chunks ${start}-${end}: ${
              err instanceof Error ? err.message : String(err)
            }`,
            { cause: err },
          );
        }
      }),
    );

    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.READY, errorMessage: null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido na ingestão.';
    console.error(`[rag.ingest] document ${documentId} falhou:`, err);
    // Best-effort: se o próprio update falhar (DB caiu), não queremos mascarar
    // o erro original. Loga e segue pro rethrow.
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.FAILED,
          // Cap pra não estourar a coluna em casos extremos (stacks longos).
          errorMessage: message.slice(0, 2000),
        },
      });
    } catch (updateErr) {
      console.error(
        `[rag.ingest] também falhou marcar ${documentId} como FAILED:`,
        updateErr,
      );
    }
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Helpers privados
// -----------------------------------------------------------------------------

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    // O entrypoint default do pdf-parse carrega um PDF de teste no boot
    // (`if (!module.parent)`), o que em ESM e em bundlers serverless
    // resulta em ENOENT. Importar `lib/pdf-parse.js` pula esse hack.
    // Tipos em ./pdf-parse.d.ts (pacote não publica types pro lib path).
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
    const result = await pdfParse(buffer);
    return result.text;
  }
  if (mimeType === 'application/json') {
    // Reserializa formatado pra dar pro embedding um texto mais "estruturado"
    // (newlines + indentação ajudam o modelo a entender hierarquia).
    const raw = buffer.toString('utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return JSON.stringify(parsed, null, 2);
  }
  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8');
  }
  throw new Error(
    `mimeType "${mimeType}" não suportado para ingestão. Suportados: application/pdf, text/*, application/json.`,
  );
}

async function insertChunks(
  documentId: string,
  batch: Array<{ content: string; chunkIndex: number }>,
  embeddings: number[][],
): Promise<void> {
  // Embedding é Unsupported("vector(768)") no schema — Prisma não sabe
  // serializar, então usamos $executeRaw com o literal pgvector ('[..]'::vector).
  //
  // Batch num único $transaction: o array de PrismaPromises é enviado em
  // pipeline (mais barato que N round-trips) e roda atomicamente — se um
  // INSERT falha, nenhum chunk do batch é persistido (o outer catch marca
  // FAILED e o deleteMany do próximo run limpa).
  await prisma.$transaction(
    batch.map((chunk, i) => {
      const embeddingLiteral = `[${embeddings[i]!.join(',')}]`;
      return prisma.$executeRaw`
        INSERT INTO document_chunks (
          id, "documentId", content, "chunkIndex", embedding, "createdAt"
        ) VALUES (
          ${idGen()},
          ${documentId},
          ${chunk.content},
          ${chunk.chunkIndex},
          ${embeddingLiteral}::vector,
          NOW()
        )
      `;
    }),
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
