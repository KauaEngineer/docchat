# Chatbot Portfolio

Monorepo do portfólio com chatbot integrado. Construído com **Turborepo + pnpm**, **Next.js 15 (App Router)**, **React 19**, **Tailwind v4**, **Prisma**, **Better Auth** e **Vercel AI SDK**.

---

## Stack

| Camada       | Tecnologia                                      |
| ------------ | ----------------------------------------------- |
| Monorepo     | Turborepo + pnpm workspaces                     |
| Framework    | Next.js 15 (App Router, Turbopack)              |
| UI           | React 19, Tailwind v4, Shadcn/UI                |
| Banco        | PostgreSQL + extensão `pgvector` (via Prisma)   |
| Auth         | Better Auth                                     |
| IA           | Vercel AI SDK (Google Gemini, Anthropic)        |
| Storage      | Cloudflare R2 (S3-compatible)                   |
| Linguagem    | TypeScript strict                               |

---

## Estrutura

```
chatbot-portfolio/
├── apps/
│   └── web/                # Next.js 15 (App Router) + React 19 + Tailwind v4
├── packages/
│   ├── ai/                 # Wrappers do Vercel AI SDK (providers, tools, prompts, RAG)
│   ├── config/             # ESLint, TypeScript e Tailwind compartilhados
│   ├── database/           # Prisma schema + cliente compartilhado
│   ├── storage/            # Cliente do Cloudflare R2
│   └── ui/                 # Componentes Shadcn/UI compartilhados
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
└── vercel.json
```

Os pacotes são consumidos via path aliases:

- `@repo/ai`
- `@repo/database`
- `@repo/storage`
- `@repo/ui`
- `@repo/config`

---

## Pré-requisitos

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm i -g pnpm@9`)
- **PostgreSQL** com a extensão **`pgvector`** habilitada
  - Local (Docker): `docker run -d --name pgvector -e POSTGRES_PASSWORD=postgres -p 5432:5432 pgvector/pgvector:pg16`
  - Hospedado: [Neon](https://neon.tech) já vem com `pgvector` disponível — é só `CREATE EXTENSION vector;` na primeira migration (o Prisma faz isso automaticamente via `previewFeatures = ["postgresqlExtensions"]`).

---

## Setup local

### 1. Clone e instale dependências

```bash
git clone <repo-url>
cd chatbot-portfolio
pnpm install
```

O `postinstall` do `@repo/database` já roda `prisma generate` — você não precisa rodar separado.

### 2. Configure as variáveis de ambiente

Copie o template e preencha os valores:

```bash
cp .env.example .env
```

As variáveis são carregadas a partir do `.env` da **raiz** do monorepo (via `loadEnvConfig` no `next.config.ts`). Em dev, `apps/web/.env` também é lido depois e sobrescreve a raiz se você precisar de overrides locais.

### 3. Rode as migrations

```bash
pnpm --filter @repo/database db:migrate
```

Esse comando:
- Cria o banco se ainda não existir
- Aplica todas as migrations versionadas em `packages/database/prisma/migrations/`
- Habilita a extensão `vector` (declarada no `schema.prisma`)
- Regenera o Prisma Client

Para uma sincronização rápida sem criar migration (só em dev):

```bash
pnpm --filter @repo/database db:push
```

Para abrir o Prisma Studio:

```bash
pnpm --filter @repo/database db:studio
```

### 4. Rode em desenvolvimento

```bash
pnpm dev
```

A app web sobe em [http://localhost:3000](http://localhost:3000).

Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health) → `{ "ok": true, "db": "connected" }`.

---

## Variáveis de ambiente

Todas as vars do servidor moram na raiz (`.env`) — apenas o que estiver em `globalEnv` do `turbo.json` é propagado para o cache do Turbo.

### Banco

| Variável        | Descrição                                                         |
| --------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`  | String de conexão Postgres (`postgresql://user:pass@host:5432/db`) |

> **Neon:** use a **pooled connection string** (com `-pooler` no host) para a app, e a **direct connection** apenas para migrations. O Prisma 6 detecta isso automaticamente quando você só seta `DATABASE_URL` para a pooled — adicione `DIRECT_URL` separadamente se for usar migrations contra o pool.

### Auth

| Variável                | Descrição                                                  |
| ----------------------- | ---------------------------------------------------------- |
| `BETTER_AUTH_SECRET`    | Secret do Better Auth (gere com `openssl rand -base64 32`) |
| `BETTER_AUTH_URL`       | URL pública da app (`http://localhost:3000` em dev)        |
| `GOOGLE_CLIENT_ID`      | OAuth client ID do Google ([console](https://console.cloud.google.com/apis/credentials)) |
| `GOOGLE_CLIENT_SECRET`  | OAuth client secret do Google                              |

> **Authorized redirect URI** do Google OAuth: `${BETTER_AUTH_URL}/api/auth/callback/google`. Cadastre tanto a URL de dev quanto a de produção.

### IA

| Variável                          | Descrição                                                         |
| --------------------------------- | ----------------------------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY`    | API key do Gemini ([AI Studio](https://aistudio.google.com/apikey)) |
| `ANTHROPIC_API_KEY`               | API key Anthropic (opcional, se usar Claude)                      |
| `TAVILY_API_KEY`                  | API key da [Tavily](https://tavily.com) para a tool `web_search` (free tier: 1000 req/mês) |

### Storage (Cloudflare R2)

| Variável                | Descrição                                                                 |
| ----------------------- | ------------------------------------------------------------------------- |
| `R2_ACCOUNT_ID`         | ID da conta Cloudflare (dashboard → R2 → "Account ID")                    |
| `R2_ACCESS_KEY_ID`      | Access key de um R2 API token                                             |
| `R2_SECRET_ACCESS_KEY`  | Secret access key do mesmo token                                          |
| `R2_BUCKET_NAME`        | Nome do bucket                                                            |
| `R2_PUBLIC_URL`         | URL pública do bucket — custom domain (recomendado) ou `https://pub-*.r2.dev` |

O hostname extraído de `R2_PUBLIC_URL` é injetado no `images.remotePatterns` do Next ([apps/web/next.config.ts](apps/web/next.config.ts)) para liberar o `<Image>` server-rendered nos uploads.

---

## Cloudflare R2: criar bucket + permissões

1. **Criar o bucket**
   - Dashboard Cloudflare → **R2** → **Create bucket**
   - Nome: `chatbot-portfolio` (ou o que preferir; ponha em `R2_BUCKET_NAME`)
   - Location: **Automatic**

2. **Expor publicamente**
   - Abra o bucket → aba **Settings** → **Public access**
   - Opção A (recomendada): **Connect Custom Domain** — aponte um subdomínio seu (`uploads.seudominio.com`) para o bucket.
   - Opção B (rápida): **Allow Access** via `r2.dev` — gera uma URL `https://pub-<hash>.r2.dev`. Adequada para portfólio; tem rate limit.
   - Copie a URL final para `R2_PUBLIC_URL` (sem `/` no fim).

3. **CORS (necessário para upload direto do browser, se você adicionar isso depois)**
   - Settings → **CORS Policy** → adicione:
     ```json
     [
       {
         "AllowedOrigins": ["http://localhost:3000", "https://seudominio.com"],
         "AllowedMethods": ["GET", "PUT", "POST"],
         "AllowedHeaders": ["*"],
         "MaxAgeSeconds": 3600
       }
     ]
     ```

4. **Criar API token**
   - Dashboard → R2 → **Manage R2 API Tokens** → **Create API token**
   - Permissions: **Object Read & Write**
   - Scope: **Apply to specific buckets only** → selecione o bucket criado
   - TTL: sem expiração (ou rotacione manualmente)
   - Copie `Access Key ID` → `R2_ACCESS_KEY_ID`
   - Copie `Secret Access Key` → `R2_SECRET_ACCESS_KEY`
   - O `Account ID` aparece no canto do dashboard de R2 → `R2_ACCOUNT_ID`

---

## Deploy: Vercel + Neon

### 1. Provisionar o banco no Neon

1. Crie um projeto em [neon.tech](https://neon.tech) — região mais próxima do datacenter do Vercel (us-east-1 / iad1 é o default).
2. Copie a **Pooled connection string** (Connection Details → "Pooled connection") — essa é a `DATABASE_URL`.
3. Conecte via `psql` ou o SQL Editor e rode `CREATE EXTENSION IF NOT EXISTS vector;` (ou deixe a primeira migration cuidar disso — o `schema.prisma` já declara `extensions = [vector]`).
4. Aplique as migrations a partir da sua máquina (uma vez):
   ```bash
   DATABASE_URL="<neon-pooled-url>" pnpm --filter @repo/database prisma migrate deploy
   ```

### 2. Importar no Vercel

1. Vercel → **Add New** → **Project** → importe o repo.
2. **Framework Preset:** Next.js (auto-detectado).
3. **Root Directory:** `apps/web` (também declarado em [`vercel.json`](vercel.json)).
4. **Install Command:** `pnpm install --frozen-lockfile` (declarado no `vercel.json`).
5. **Build Command:** `cd ../.. && pnpm turbo build --filter=web` (declarado no `vercel.json`).
6. **Output Directory:** deixe vazio (default `.next`).

### 3. Configurar Environment Variables no Vercel

Copie tudo do `.env.example` para **Project → Settings → Environment Variables**:

- Marque **Production** e **Preview** para todas.
- `BETTER_AUTH_URL` em production = URL do deploy (ex.: `https://chatbot-portfolio.vercel.app`).
- `DATABASE_URL` = pooled connection string do Neon.
- Cadastre a redirect URI de produção no Google OAuth: `${BETTER_AUTH_URL}/api/auth/callback/google`.

### 4. Deploy

Faça push para `main` — o Vercel buildará automaticamente. O `postinstall` do `@repo/database` roda `prisma generate` antes do build do Next, então o Prisma Client está sempre disponível.

Após o primeiro deploy, valide:

```bash
curl https://<seu-deploy>.vercel.app/api/health
# → {"ok":true,"db":"connected"}
```

### 5. Rodar migrations futuras

Em CI/local, contra o banco de produção:

```bash
DATABASE_URL="<neon-pooled-url>" pnpm --filter @repo/database prisma migrate deploy
```

Não rode `db:push` contra produção — sempre `migrate deploy` com migrations versionadas.

---

## Scripts (raiz)

| Script                                    | O que faz                                              |
| ----------------------------------------- | ------------------------------------------------------ |
| `pnpm dev`                                | Sobe todos os apps em modo desenvolvimento             |
| `pnpm build`                              | Build de produção (com cache do Turbo)                 |
| `pnpm lint`                               | Executa ESLint em todos os pacotes                     |
| `pnpm typecheck`                          | Roda `tsc --noEmit` em todos os pacotes                |
| `pnpm format`                             | Formata o repositório com Prettier                     |
| `pnpm clean`                              | Limpa builds, caches e `node_modules`                  |
| `pnpm --filter @repo/database db:migrate` | Cria/aplica migrations em dev                          |
| `pnpm --filter @repo/database db:push`    | Sincroniza schema sem migration (só dev)               |
| `pnpm --filter @repo/database db:studio`  | Abre o Prisma Studio                                   |

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
