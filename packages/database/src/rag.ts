import { prisma } from './client';

export interface SimilarChunk {
  content: string;
  similarity: number;
  documentId: string;
  filename: string;
}

/**
 * Busca os chunks mais similares ao embedding consultado, escopados ao usuário.
 *
 * - Operador `<=>` do pgvector retorna **cosine distance** ∈ [0, 2].
 * - Convertemos para **similarity** = `1 - distance` ∈ [-1, 1] (1 = idêntico).
 * - O filtro de threshold é reescrito como `distance <= 1 - threshold` para
 *   manter o `ORDER BY <=>` enxuto e deixar o índice HNSW guiar a busca.
 * - `embedding IS NOT NULL` evita chunks ainda em processamento.
 *
 * @param queryEmbedding vetor 768-d (Gemini `text-embedding-004` / `embedding-001`)
 * @param userId         escopa a busca aos documentos do usuário via JOIN
 * @param limit          número máximo de chunks retornados
 * @param threshold      similaridade mínima (0 a 1); use ~0.7 como ponto de partida
 */
export async function searchSimilarChunks(
  queryEmbedding: number[],
  userId: string,
  limit: number,
  threshold: number,
): Promise<SimilarChunk[]> {
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;
  const maxDistance = 1 - threshold;

  return prisma.$queryRaw<SimilarChunk[]>`
    SELECT
      dc.content                                              AS content,
      1 - (dc.embedding <=> ${vectorLiteral}::vector)         AS similarity,
      dc."documentId"                                         AS "documentId",
      d.filename                                              AS filename
    FROM document_chunks dc
    INNER JOIN documents d ON d.id = dc."documentId"
    WHERE d."userId" = ${userId}
      AND dc.embedding IS NOT NULL
      AND (dc.embedding <=> ${vectorLiteral}::vector) <= ${maxDistance}
    ORDER BY dc.embedding <=> ${vectorLiteral}::vector ASC
    LIMIT ${limit}
  `;
}
