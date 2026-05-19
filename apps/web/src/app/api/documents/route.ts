import { headers } from 'next/headers';
import { after } from 'next/server';

import { createIdGenerator } from 'ai';

import { DocumentStatus, prisma } from '@repo/database';
import { ingestDocument } from '@repo/ai/rag';
import { uploadToR2 } from '@repo/storage';

import { auth } from '@/lib/auth';

// FormData + R2 upload + Prisma exigem Node runtime (não edge).
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_BYTES = 50 * 1024 * 1024;

// Mapeia extensão → mime canônico. Navegadores às vezes mandam mime vazio
// ou genérico ('application/octet-stream') para .md / .csv, então caímos
// na extensão antes de rejeitar o arquivo.
const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
};

const ALLOWED_MIMES = new Set<string>(Object.values(EXT_TO_MIME));

const idGen = createIdGenerator();

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return jsonError(401, 'Não autenticado.');

    const formData = await req.formData().catch(() => null);
    if (!formData) return jsonError(400, 'FormData inválido.');

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return jsonError(400, 'Nenhum arquivo enviado (campo "file" obrigatório).');
    }

    if (file.size === 0) {
      return jsonError(400, `Arquivo "${file.name}" está vazio.`);
    }
    if (file.size > MAX_FILE_BYTES) {
      return jsonError(
        400,
        `Arquivo "${file.name}" excede ${MAX_FILE_BYTES / 1024 / 1024}MB.`,
      );
    }

    const mimeType = resolveMimeType(file);
    if (!mimeType) {
      return jsonError(
        400,
        `Tipo não permitido para "${file.name}". Aceitos: pdf, txt, md, csv, json.`,
      );
    }

    const userId = session.user.id;
    const key = `documents/${userId}/${idGen()}-${sanitizeFilename(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadToR2(key, buffer, mimeType);

    const document = await prisma.document.create({
      data: {
        userId,
        filename: file.name,
        mimeType,
        size: file.size,
        r2Key: key,
        status: DocumentStatus.PROCESSING,
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Background: ingestão (download + parse + chunk + embed + insert).
    // Em Vercel `after()` registra a Promise no waitUntil da request, então
    // a função serverless sobrevive depois do response até o trabalho terminar.
    // Em dev (next dev) o `after()` também roda — o servidor fica vivo, então
    // é equivalente a rodar inline em background.
    after(
      ingestDocument(document.id).catch((err) => {
        // ingestDocument já marca FAILED no banco; só logamos pra observabilidade.
        console.error(`[documents] ingest falhou para ${document.id}:`, err);
      }),
    );

    return Response.json({ document }, { status: 201 });
  } catch (err) {
    console.error('[documents.POST] route error:', err);
    return jsonError(500, 'Erro interno ao processar documento.');
  }
}

export async function GET(): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return jsonError(401, 'Não autenticado.');

    const documents = await prisma.document.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json({ documents });
  } catch (err) {
    console.error('[documents.GET] route error:', err);
    return jsonError(500, 'Erro interno ao listar documentos.');
  }
}

function resolveMimeType(file: File): string | null {
  if (ALLOWED_MIMES.has(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];
  return null;
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^\w.-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : 'file';
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
