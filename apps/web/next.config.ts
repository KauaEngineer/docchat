import path from 'node:path';

import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Carrega .env da raiz do monorepo antes do Next.js. loadEnvConfig é
// idempotente e NÃO sobrescreve vars já presentes em process.env, então:
//   1. Vars já definidas pelo shell continuam ganhando.
//   2. apps/web/.env (se existir) também é lido depois pelo Next e
//      sobrescreveria valores da raiz — overrides locais ainda funcionam.
// Em produção (Vercel) o arquivo não existe; loadEnvConfig vira no-op.
const monorepoRoot = path.resolve(process.cwd(), '..', '..');
loadEnvConfig(monorepoRoot);

// Extrai o hostname do R2_PUBLIC_URL pra liberar no next/image. Se a env
// não estiver setada (build local sem R2), cai pro pattern wildcard do r2.dev
// pra ainda permitir preview em dev.
function r2Hostname(): string {
  const raw = process.env['R2_PUBLIC_URL'];
  if (!raw) return '*.r2.dev';
  try {
    return new URL(raw).hostname;
  } catch {
    return '*.r2.dev';
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/ui', '@repo/ai', '@repo/database', '@repo/storage'],
  // Pacotes que devem ficar como require externo no bundle do servidor:
  // - @prisma/client tem binário nativo do query engine que não pode ser bundle.
  // - pdf-parse tem worker que quebra quando empacotado pelo webpack/turbopack.
  serverExternalPackages: ['@prisma/client', 'pdf-parse'],
  // Em monorepo pnpm, o Next não copia o binário nativo do Prisma
  // (libquery_engine-*.so.node) para a função serverless — o que causa
  // "PrismaClientInitializationError: could not locate the Query Engine" em
  // runtime na Vercel. Fixamos a raiz de tracing no monorepo e forçamos a
  // inclusão do engine, de modo que o caminho replicado em /var/task case com
  // node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client (onde o
  // Prisma procura o engine).
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    '/**': [
      '../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: r2Hostname(),
      },
    ],
  },
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
