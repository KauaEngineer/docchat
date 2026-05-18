# Chatbot Portfolio

Monorepo do portfólio com chatbot integrado. Construído com **Turborepo + pnpm**, **Next.js 15 (App Router)**, **React 19**, **Tailwind v4**, **Prisma**, **Better Auth** e **Vercel AI SDK**.

---

## Stack

| Camada       | Tecnologia                                   |
| ------------ | -------------------------------------------- |
| Monorepo     | Turborepo + pnpm workspaces                  |
| Framework    | Next.js 15 (App Router, Turbopack)           |
| UI           | React 19, Tailwind v4, Shadcn/UI             |
| Banco        | PostgreSQL via Prisma                        |
| Auth         | Better Auth                                  |
| IA           | Vercel AI SDK (Google Gemini)                |
| Storage      | Cloudflare R2 (S3-compatible)                |
| Linguagem    | TypeScript strict                            |

---

## Estrutura

```
chatbot-portfolio/
├── apps/
│   └── web/                # Next.js 15 (App Router) + React 19 + Tailwind v4
├── packages/
│   ├── ai/                 # Wrappers do Vercel AI SDK (providers, tools, prompts)
│   ├── config/             # ESLint, TypeScript e Tailwind compartilhados
│   ├── database/           # Prisma schema + cliente compartilhado
│   └── ui/                 # Componentes Shadcn/UI compartilhados
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.json
```

Os pacotes são consumidos via path aliases:

- `@repo/ai`
- `@repo/database`
- `@repo/ui`
- `@repo/config`

---

## Pré-requisitos

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm i -g pnpm`)
- **PostgreSQL** rodando localmente (ou uma URL hospedada — Neon, Supabase, Railway etc.)

---

## Setup

### 1. Clone e instale dependências

```bash
git clone <repo-url>
cd chatbot-portfolio
pnpm install
```

### 2. Configure as variáveis de ambiente

Copie o template e preencha os valores:

```bash
cp .env.example .env
```

Variáveis necessárias:

| Variável                          | Descrição                                                              |
| --------------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                    | String de conexão PostgreSQL                                           |
| `BETTER_AUTH_SECRET`              | Secret do Better Auth (gere com `openssl rand -base64 32`)             |
| `BETTER_AUTH_URL`                 | URL pública da app (em dev: `http://localhost:3000`)                   |
| `GOOGLE_GENERATIVE_AI_API_KEY`    | API key do Google Gemini                                               |
| `R2_ACCOUNT_ID`                   | ID da conta Cloudflare                                                 |
| `R2_ACCESS_KEY_ID`                | Access key do R2                                                       |
| `R2_SECRET_ACCESS_KEY`            | Secret access key do R2                                                |
| `R2_BUCKET_NAME`                  | Nome do bucket R2                                                      |
| `R2_PUBLIC_URL`                   | URL pública do bucket (custom domain ou `pub-*.r2.dev`)                |

### 3. Prepare o banco de dados

```bash
pnpm db:generate    # gera o Prisma Client
pnpm db:push        # sincroniza o schema com o banco (em dev)
# ou
pnpm db:migrate     # cria migrations versionadas
```

### 4. Rode em desenvolvimento

```bash
pnpm dev
```

A app web sobe em [http://localhost:3000](http://localhost:3000).

---

## Scripts (raiz)

| Script             | O que faz                                              |
| ------------------ | ------------------------------------------------------ |
| `pnpm dev`         | Sobe todos os apps em modo desenvolvimento             |
| `pnpm build`       | Build de produção (com cache do Turbo)                 |
| `pnpm lint`        | Executa ESLint em todos os pacotes                     |
| `pnpm typecheck`   | Roda `tsc --noEmit` em todos os pacotes                |
| `pnpm format`      | Formata o repositório com Prettier                     |
| `pnpm clean`       | Limpa builds, caches e `node_modules`                  |
| `pnpm db:generate` | Gera o Prisma Client                                   |
| `pnpm db:push`     | Sincroniza schema com o banco (sem migrations)         |
| `pnpm db:migrate`  | Cria/aplica migrations                                 |
| `pnpm db:studio`   | Abre o Prisma Studio                                   |

---

## Adicionando componentes Shadcn

Os componentes vivem em `packages/ui` e são consumidos via `@repo/ui/components/<nome>`.

```bash
cd packages/ui
pnpm ui:add button
pnpm ui:add dialog input textarea
```

O `components.json` já está configurado para usar Tailwind v4 e o CSS de tema do `@repo/config`.

---

## Adicionando um modelo de IA

Edite `packages/ai/src/providers.ts` e adicione a entrada no `PROVIDER_OF`:

```ts
const PROVIDER_OF: Record<string, ProviderName> = {
  'gemini-2.0-flash': 'google',
  'gemini-1.5-pro': 'google',
  // 'meu-modelo': 'google',
};
```

E use no app:

```ts
import { streamText } from 'ai';
import { getModel } from '@repo/ai';

const result = streamText({
  model: getModel('gemini-2.0-flash'),
  messages,
});
```

---

## Convenções

- **TypeScript strict** em todos os pacotes (`noUncheckedIndexedAccess`, `noUnusedLocals` etc.).
- **ESLint flat config** centralizado em `@repo/config/eslint/*`.
- **Tailwind v4** com tema CSS-first em `@repo/config/tailwind/globals.css`.
- **Path aliases** sempre via `@repo/*` — nunca importar com caminho relativo entre pacotes.
- **Server actions** preferidas a API routes quando o caller é o próprio Next.

---

## Licença

Privado — uso pessoal do portfólio.
