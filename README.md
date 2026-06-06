# DocChat

Chatbot estilo Claude.ai com RAG, Tool Use, Artefatos e streaming — construído do zero como projeto de portfólio.

**Demo ao vivo:** [chatbot-portfolio-web.vercel.app](https://chatbot-portfolio-web.vercel.app) · **Código:** [github.com/KauaEngineer/docchat](https://github.com/KauaEngineer/docchat)

> ⚠️ A demo está online, mas a geração de respostas da IA pode estar indisponível temporariamente (créditos de API). A interface e o fluxo de autenticação funcionam normalmente.

---

## O que é

DocChat é uma aplicação full-stack que replica as principais capacidades de um assistente de IA moderno:

- **RAG (Retrieval-Augmented Generation)** — suba documentos e converse com eles. O sistema indexa o conteúdo via embeddings e recupera trechos relevantes semanticamente antes de cada resposta.
- **Tool Use** — o modelo pode executar ferramentas em tempo real, como busca na web via Tavily.
- **Artefatos** — respostas em código, markdown ou texto geram artefatos versionados no painel lateral.
- **Multi-LLM** — suporte a Google Gemini e Anthropic Claude na mesma interface, com troca por conversa.
- **Streaming** — respostas chegam em tempo real, token por token.

---

## Screenshots

🖼️ _Screenshots em breve._

---

## Stack

| Camada     | Tecnologia                              |
| ---------- | --------------------------------------- |
| Monorepo   | Turborepo + pnpm workspaces             |
| Framework  | Next.js 15 (App Router + Turbopack)     |
| UI         | React 19, Tailwind v4, Shadcn/UI        |
| Banco      | PostgreSQL + pgvector via Prisma        |
| Auth       | Better Auth (Google OAuth)              |
| IA         | Vercel AI SDK (Google Gemini, Anthropic) |
| Busca      | Tavily API (web search tool)            |
| Linguagem  | TypeScript strict                       |
| Deploy     | Vercel + Neon                           |

---

## Arquitetura

Monorepo com pacotes desacoplados, consumidos via path aliases:

```
docchat/
├── apps/
│   └── web/                # Next.js 15 — app principal
└── packages/
    ├── ai/                 # Providers, tools, prompts e lógica de RAG
    ├── database/           # Prisma schema + cliente compartilhado
    ├── storage/            # Cliente Cloudflare R2
    ├── ui/                 # Componentes Shadcn/UI compartilhados
    └── config/             # ESLint, TypeScript e Tailwind compartilhados
```

Aliases: `@repo/ai` · `@repo/database` · `@repo/storage` · `@repo/ui` · `@repo/config`

---

## Rodando localmente

### Pré-requisitos

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm i -g pnpm@9`)
- **PostgreSQL** com `pgvector` habilitado

PostgreSQL via Docker:

```bash
docker run -d --name pgvector \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

Ou use o [Neon](https://neon.tech) — já vem com `pgvector` disponível.

### Setup

```bash
# 1. Clone e instale
git clone https://github.com/KauaEngineer/docchat.git
cd docchat
pnpm install

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Preencha os valores no .env

# 3. Rode as migrations
pnpm --filter @repo/database db:migrate

# 4. Suba em desenvolvimento
pnpm dev
# → http://localhost:3000
```

Health check: `GET /api/health` → `{ "ok": true, "db": "connected" }`

---

## Variáveis de ambiente

Todas as variáveis ficam na raiz do monorepo (`.env`). Veja o `.env.example` para a lista completa.

| Variável                       | Descrição                                            |
| ------------------------------ | ---------------------------------------------------- |
| `DATABASE_URL`                 | Connection string PostgreSQL (pooled para Neon)      |
| `BETTER_AUTH_SECRET`           | Secret do Better Auth (`openssl rand -base64 32`)    |
| `BETTER_AUTH_URL`              | URL pública da app                                   |
| `NEXT_PUBLIC_BETTER_AUTH_URL`  | Igual a `BETTER_AUTH_URL` (exposta ao browser)       |
| `GOOGLE_CLIENT_ID`             | OAuth client ID do Google                            |
| `GOOGLE_CLIENT_SECRET`         | OAuth client secret do Google                        |
| `GOOGLE_GENERATIVE_AI_API_KEY` | API key do Gemini (AI Studio)                        |
| `ANTHROPIC_API_KEY`            | API key Anthropic (opcional)                         |
| `TAVILY_API_KEY`               | API key Tavily para web search (free: 1000 req/mês)  |
| `R2_ACCOUNT_ID`                | ID da conta Cloudflare                               |
| `R2_ACCESS_KEY_ID`             | Access key do R2 token                               |
| `R2_SECRET_ACCESS_KEY`         | Secret key do R2 token                               |
| `R2_BUCKET_NAME`               | Nome do bucket R2                                    |
| `R2_PUBLIC_URL`                | URL pública do bucket                                |

> **Google OAuth:** cadastre a redirect URI `${BETTER_AUTH_URL}/api/auth/callback/google` (tanto a de dev quanto a de produção) no [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

---

## Scripts

| Comando                                     | O que faz                                |
| ------------------------------------------- | ---------------------------------------- |
| `pnpm dev`                                  | Sobe todos os apps em desenvolvimento    |
| `pnpm build`                                | Build de produção (com cache Turbo)      |
| `pnpm lint`                                 | ESLint em todos os pacotes               |
| `pnpm typecheck`                            | `tsc --noEmit` em todos os pacotes       |
| `pnpm format`                               | Prettier em todo o repositório           |
| `pnpm clean`                                | Limpa builds, caches e `node_modules`    |
| `pnpm --filter @repo/database db:migrate`   | Cria/aplica migrations                   |
| `pnpm --filter @repo/database db:push`      | Sincroniza schema sem migration (dev)    |
| `pnpm --filter @repo/database db:studio`    | Abre o Prisma Studio                     |

---

## Deploy

O projeto está configurado para deploy no **Vercel + Neon**. Veja o [`vercel.json`](vercel.json) para as configurações de build.

Para migrations em produção, sempre use `prisma migrate deploy` — nunca `db:push`.

---

## Convenções

- **TypeScript strict** — `noUncheckedIndexedAccess`, `noUnusedLocals` etc.
- **ESLint flat config** centralizado em `@repo/config`
- **Tailwind v4** com tema CSS-first
- **Server Actions** preferidas a API Routes quando o caller é o próprio Next
- **Path aliases** sempre via `@repo/*` — nunca importações relativas entre pacotes

---

## Autor

**Kauã Santos** — Desenvolvedor Full-Stack com foco em IA e LLMs.

[GitHub](https://github.com/KauaEngineer) · kauanki.z05@gmail.com

---

## Licença

[MIT](LICENSE) © Kauã Teixeira dos Santos
