import path from 'node:path';

import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Carrega .env da raiz do monorepo antes do Next.js. loadEnvConfig é
// idempotente e NÃO sobrescreve vars já presentes em process.env, então:
//   1. Vars já definidas pelo shell continuam ganhando.
//   2. apps/web/.env (se existir) também é lido depois pelo Next e
//      sobrescreveria valores da raiz — overrides locais ainda funcionam.
// Em produção (Vercel) o arquivo não existe; loadEnvConfig vira no-op.
loadEnvConfig(path.resolve(process.cwd(), '..', '..'));

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
