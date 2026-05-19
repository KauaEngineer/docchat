'use server';

import { headers } from 'next/headers';

import { getArtifactVersions, prisma } from '@repo/database';
import type { ArtifactKind } from '@repo/database';

import { auth } from '@/lib/auth';

// Shape serializável que o cliente consome. Não devolvemos a entidade
// Artifact direto do Prisma porque `Date` cruza a fronteira RSC como objeto
// em Server Actions mas é mais previsível mandar ISO string explicitamente.
export interface ArtifactVersionDTO {
  id: string;
  messageId: string;
  kind: ArtifactKind;
  title: string;
  content: string;
  language: string | null;
  version: number;
  createdAt: string;
}

/**
 * Busca todas as versões de um artefato (mesmo `title`) dentro de uma
 * conversa. Autoriza pelo dono da conversation: pra um usuário B não
 * conseguir ler artefatos de A só mandando o id.
 *
 * Retorna `[]` quando o usuário não tem acesso, em vez de throw — assim o
 * painel cai num estado "vazio" gracioso em vez de derrubar a UI inteira.
 */
export async function getArtifactVersionsAction(
  conversationId: string,
  title: string,
): Promise<ArtifactVersionDTO[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true },
  });
  if (!conversation || conversation.userId !== session.user.id) return [];

  const versions = await getArtifactVersions(conversationId, title);
  return versions.map((a) => ({
    id: a.id,
    messageId: a.messageId,
    kind: a.kind,
    title: a.title,
    content: a.content,
    language: a.language,
    version: a.version,
    createdAt: a.createdAt.toISOString(),
  }));
}
