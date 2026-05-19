import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed } from 'ai';

// Singleton: criar o provider a cada request seria desperdício (validação
// de env + setup do client S3 da Google). Cache até reset do processo.
let cachedGoogle: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getGoogleProvider(): ReturnType<typeof createGoogleGenerativeAI> {
  if (cachedGoogle) return cachedGoogle;
  const apiKey = process.env['GOOGLE_GENERATIVE_AI_API_KEY'];
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      'GOOGLE_GENERATIVE_AI_API_KEY não definida — necessária para gerar embeddings.',
    );
  }
  cachedGoogle = createGoogleGenerativeAI({ apiKey });
  return cachedGoogle;
}

/**
 * Gera embedding de uma query (texto) usando o mesmo modelo da ingestão
 * (`text-embedding-004`, 768 dimensões). Idêntico mantém compatibilidade
 * com o índice HNSW dos chunks já persistidos.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const google = getGoogleProvider();
  const { embedding } = await embed({
    model: google.textEmbeddingModel('text-embedding-004'),
    value: text,
  });
  return embedding;
}
