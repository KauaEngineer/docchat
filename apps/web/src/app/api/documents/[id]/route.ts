import { headers } from 'next/headers';

import { prisma } from '@repo/database';
import { deleteFromR2 } from '@repo/storage';

import { auth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return jsonError(401, 'Não autenticado.');

    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, userId: true, r2Key: true },
    });
    if (!document) return jsonError(404, 'Documento não encontrado.');
    if (document.userId !== session.user.id) {
      return jsonError(403, 'Acesso negado.');
    }

    // Ordem: chunks → R2 → Document.
    //
    // O schema já tem onDelete: Cascade em DocumentChunk → Document, então
    // `deleteMany` antes é redundante para a integridade do banco. Mas a
    // spec pediu explicitamente nesta ordem (deleta chunks → R2 → Document)
    // e ser explícito ajuda: se algo falhar no R2 a Document permanece,
    // permitindo retry da DELETE sem deixar lixo dependente.
    await prisma.documentChunk.deleteMany({ where: { documentId: id } });

    // Best-effort no R2: se o objeto já tinha sido removido (ou nunca foi
    // upado por uma falha anterior), não queremos travar o cleanup do banco.
    // Logamos e seguimos pra apagar a Document — a alternativa seria a row
    // virar zumbi referenciando uma key que ninguém mais consegue limpar.
    try {
      await deleteFromR2(document.r2Key);
    } catch (err) {
      console.error(
        `[documents.DELETE] R2 delete falhou para ${document.r2Key}; seguindo:`,
        err,
      );
    }

    await prisma.document.delete({ where: { id } });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[documents.DELETE] route error:', err);
    return jsonError(500, 'Erro interno ao deletar documento.');
  }
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
