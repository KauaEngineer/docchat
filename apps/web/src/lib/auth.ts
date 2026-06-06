import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

import { prisma } from '@repo/database';

const baseURL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000';

const googleClientId = process.env['GOOGLE_CLIENT_ID'];
const googleClientSecret = process.env['GOOGLE_CLIENT_SECRET'];

export const auth = betterAuth({
  secret: process.env['BETTER_AUTH_SECRET'],
  baseURL,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  ...(googleClientId && googleClientSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        },
      }
    : {}),

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  trustedOrigins: [baseURL],
});

export type Session = typeof auth.$Infer.Session;
