import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// O AWS SDK aceita uma união grande para Body (Buffer, Uint8Array, string,
// Readable, Blob, ReadableStream...). Reaproveitamos a tipagem do command
// pra não restringir desnecessariamente o que o caller pode passar.
export type R2UploadBody = NonNullable<PutObjectCommandInput['Body']>;

// -----------------------------------------------------------------------------
// Client lazy. NÃO instanciamos no top-level: se faltar env, o throw acontece
// só na primeira chamada — importar este módulo de qualquer rota não derruba
// o boot do Next (lição da regressão no /login antes do VERCEL_AI_API_KEY).
// -----------------------------------------------------------------------------

let cachedClient: S3Client | null = null;

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `[r2] env ${name} não definida. ` +
        'Configure as vars R2_* no .env (ver .env.example).',
    );
  }
  return value;
}

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const accountId = readRequiredEnv('R2_ACCOUNT_ID');
  const accessKeyId = readRequiredEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = readRequiredEnv('R2_SECRET_ACCESS_KEY');

  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

function getBucket(): string {
  return readRequiredEnv('R2_BUCKET_NAME');
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

/**
 * Faz upload de um objeto pro R2.
 *
 * Retorna a chave e a URL de acesso. Se `R2_PUBLIC_URL` estiver configurada
 * (bucket público com domínio custom), retorna a URL direta. Senão, gera uma
 * signed URL de leitura — útil em dev ou para buckets privados.
 */
export async function uploadToR2(
  key: string,
  body: R2UploadBody,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const client = getClient();
  const bucket = getBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  const url = await resolveObjectUrl(key);
  return { key, url };
}

/**
 * Gera uma signed URL temporária para download. `expiresIn` em segundos
 * (default 1h). Use quando o objeto não está em um bucket público.
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const client = getClient();
  const bucket = getBucket();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn },
  );
}

/**
 * Apaga um objeto. Idempotente — R2 não erra se a key não existir.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getClient();
  const bucket = getBucket();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Baixa um objeto inteiro pra memória como Buffer. Conveniente pra ingestão
 * (PDF/text parsing) — não use pra arquivos enormes em rotas com memory limit.
 */
export async function downloadFromR2(key: string): Promise<Buffer> {
  const client = getClient();
  const bucket = getBucket();
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!result.Body) {
    throw new Error(`[r2] objeto vazio ou inexistente: ${key}`);
  }
  // AWS SDK v3: Body implementa o helper transformToByteArray (Node + browser).
  const bytes = await result.Body.transformToByteArray();
  return Buffer.from(bytes);
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function resolveObjectUrl(key: string): Promise<string> {
  const publicBase = process.env['R2_PUBLIC_URL'];
  if (publicBase && publicBase.trim().length > 0) {
    // Trim trailing slash pra não gerar `https://cdn.example.com//key`.
    return `${publicBase.replace(/\/+$/, '')}/${key}`;
  }
  return getSignedDownloadUrl(key);
}
