import { prisma } from '@repo/database';

// Health check usado pelo Vercel/uptime-monitor pra confirmar que o deploy
// está vivo E que o app consegue falar com o banco. SELECT 1 é o ping mais
// barato possível — não toca tabela, não trava locks, valida só o pool.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: 'connected' });
  } catch (err) {
    console.error('[health] db check failed:', err);
    return Response.json(
      { ok: false, db: 'disconnected' },
      { status: 503 },
    );
  }
}
