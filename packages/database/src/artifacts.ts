import type { Artifact } from '@prisma/client';

import { prisma } from './client';

/**
 * Todas as versões de um artefato (mesmo `title` dentro de uma conversa).
 *
 * Cada chamada de `updateArtifact` gera uma NOVA row com `version` incremental
 * (não atualizamos in-place), pra preservar o histórico. O JOIN via `message`
 * é como filtramos por conversa — Artifact não tem `conversationId` direto.
 *
 * `version` é o critério de ordenação canônico. `createdAt` segue a mesma
 * ordem na prática, mas usar version é mais explícito sobre o intent (e
 * sobrevive a clock skew em ambientes distribuídos).
 */
export async function getArtifactVersions(
  conversationId: string,
  title: string,
): Promise<Artifact[]> {
  return prisma.artifact.findMany({
    where: {
      title,
      message: { conversationId },
    },
    orderBy: { version: 'asc' },
  });
}

/**
 * Última versão do artefato (ou `null` se nunca foi criado nesta conversa).
 *
 * Usado pelo handler de `updateArtifact` no chat route pra resolver o número
 * da próxima versão e herdar `kind` / `language` do anterior — o usuário
 * pediu uma atualização, não um novo artefato.
 */
export async function getLatestArtifact(
  conversationId: string,
  title: string,
): Promise<Artifact | null> {
  return prisma.artifact.findFirst({
    where: {
      title,
      message: { conversationId },
    },
    orderBy: { version: 'desc' },
  });
}
