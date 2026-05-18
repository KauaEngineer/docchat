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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/ui', '@repo/database', '@repo/ai'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
