import { headers } from 'next/headers';

import { createIdGenerator } from 'ai';

import { prisma } from '@repo/database';
import { uploadToR2 } from '@repo/storage';

import { auth } from '@/lib/auth';

// FormData parsing precisa de Node runtime (não edge). E uploads grandes
// se beneficiam do timeout estendido — 5*20MB = 100MB pior caso.
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILES = 5;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

// Allowlist explícito por mime. `text/*` aceita txt/md/csv/etc; o resto é
// individual pra evitar surpresas (ex.: application/zip vindo como text/plain).
const ALLOWED_MIME = (mime: string): boolean => {
  if (/^image\/(png|jpe?g|webp|gif)$/.test(mime)) return true;
  if (mime === 'application/pdf') return true;
  if (mime === 'application/json') return true;
  if (mime.startsWith('text/')) return true;
  return false;
};

const idGen = createIdGenerator();

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return jsonError(401, 'Não autenticado.');

    const formData = await req.formData().catch(() => null);
    if (!formData) return jsonError(400, 'FormData inválido.');

    const files = formData
      .getAll('files')
      .filter((v): v is File => v instanceof File);

    if (files.length === 0) return jsonError(400, 'Nenhum arquivo enviado.');
    if (files.length > MAX_FILES) {
      return jsonError(400, `Máximo ${MAX_FILES} arquivos por upload.`);
    }

    // Valida tudo antes de subir qualquer coisa pro R2 — evita state
    // inconsistente (alguns arquivos no bucket sem registro no banco).
    for (const file of files) {
      if (file.size === 0) {
        return jsonError(400, `Arquivo "${file.name}" está vazio.`);
      }
      if (file.size > MAX_FILE_BYTES) {
        return jsonError(
          400,
          `Arquivo "${file.name}" excede ${MAX_FILE_BYTES / 1024 / 1024}MB.`,
        );
      }
      if (!ALLOWED_MIME(file.type)) {
        return jsonError(400, `Tipo "${file.type || '?'}" não permitido para "${file.name}".`);
      }
    }

    const userId = session.user.id;
    const results: Array<{
      id: string;
      filename: string;
      mimeType: string;
      size: number;
      url: string;
    }> = [];

    for (const file of files) {
      const key = `uploads/${userId}/${idGen()}-${sanitizeFilename(file.name)}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { url } = await uploadToR2(key, buffer, file.type);

      // messageId fica null — vai ser linkado quando a user message for
      // persistida (chat route faz updateMany usando attachmentIds do body).
      const attachment = await prisma.attachment.create({
        data: {
          userId,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          r2Key: key,
          url,
        },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          size: true,
          url: true,
        },
      });

      results.push(attachment);
    }

    return Response.json({ attachments: results });
  } catch (err) {
    console.error('[upload] route error:', err);
    return jsonError(500, 'Erro interno ao processar upload.');
  }
}

// Path traversal + chars problemáticos pra URL/header. Mantém ascii alfanum,
// ponto, hífen, underscore. Outros caracteres (espaço, acentos, etc.) viram _.
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
