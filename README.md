DocChat

Chatbot estilo Claude.ai com RAG, Tool Use, Artefatos e streaming — construído do zero como projeto de portfólio.

Demo ao vivo: chatbot-portfolio-web.vercel.app · Código: github.com/KauaEngineer/docchat

⚠️ A demo está online, mas a geração de respostas da IA pode estar indisponível temporariamente (créditos de API). A interface e o fluxo de autenticação funcionam normalmente.


O que é
DocChat é uma aplicação full-stack que replica as principais capacidades de um assistente de IA moderno:

RAG (Retrieval-Augmented Generation) — suba documentos e converse com eles. O sistema indexa o conteúdo via embeddings e recupera trechos relevantes semanticamente antes de cada resposta.
Tool Use — o modelo pode executar ferramentas em tempo real, como busca na web via Tavily.
Artefatos — respostas em código, markdown ou texto geram artefatos versionados no painel lateral.
Multi-LLM — suporte a Google Gemini e Anthropic Claude na mesma interface, com troca por conversa.
Streaming — respostas chegam em tempo real, token por token.


Screenshots

🖼️ Screenshots em breve.


Stack
CamadaTecnologiaMonorepoTurborepo + pnpm workspacesFrameworkNext.js 15 (App Router + Turbopack)UIReact 19, Tailwind v4, Shadcn/UIBancoPostgreSQL + pgvector via PrismaAuthBetter Auth (Google OAuth)IAVercel AI SDK v5 (Google Gemini, Anthropic)StorageCloudflare R2 (S3-compatible)BuscaTavily API (web search tool)LinguagemTypeScript strictDeployVercel + Neon

Arquitetura
Monorepo com pacotes desacoplados, consumidos via path aliases:
docchat/
├── apps/
│   └── web/                # Next.js 15 — app principal
├── packages/
│   ├── ai/                 # Providers, tools, prompts e lógica de RAG
│   ├── database/           # Prisma schema + cliente compartilhado
│   ├── storage/            # Cliente Cloudflare R2
│   ├── ui/                 # Componentes Shadcn/UI compartilhados
│   └── config/             # ESLint, TypeScript e Tailwind compartilhados
Aliases: @repo/ai · @repo/database · @repo/storage · @repo/ui · @repo/config

Rodando localmente
Pré-requisitos

Node.js ≥ 20
pnpm ≥ 9 (npm i -g pnpm@9)
PostgreSQL com pgvector habilitado

PostgreSQL via Docker:
bashdocker run -d --name pgvector \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  pgvector/pgvector:pg16
Ou use o Neon — já vem com pgvector disponível.
Setup
bash# 1. Clone e instale
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
Health check: GET /api/health → { "ok": true, "db": "connected" }

Variáveis de ambiente
Todas as variáveis ficam na raiz do monorepo (.env). Veja o .env.example para a lista completa.
VariávelDescriçãoDATABASE_URLConnection string PostgreSQL (pooled para Neon)BETTER_AUTH_SECRETSecret do Better Auth (openssl rand -base64 32)BETTER_AUTH_URLURL pública da appGOOGLE_CLIENT_IDOAuth client ID do GoogleGOOGLE_CLIENT_SECRETOAuth client secret do GoogleGOOGLE_GENERATIVE_AI_API_KEYAPI key do Gemini (AI Studio)ANTHROPIC_API_KEYAPI key Anthropic (opcional)TAVILY_API_KEYAPI key Tavily para web search (free: 1000 req/mês)R2_ACCOUNT_IDID da conta CloudflareR2_ACCESS_KEY_IDAccess key do R2 tokenR2_SECRET_ACCESS_KEYSecret key do R2 tokenR2_BUCKET_NAMENome do bucket R2R2_PUBLIC_URLURL pública do bucket

Scripts
ComandoO que fazpnpm devSobe todos os apps em desenvolvimentopnpm buildBuild de produção (com cache Turbo)pnpm lintESLint em todos os pacotespnpm typechecktsc --noEmit em todos os pacotespnpm formatPrettier em todo o repositóriopnpm cleanLimpa builds, caches e node_modulespnpm --filter @repo/database db:migrateCria/aplica migrationspnpm --filter @repo/database db:pushSincroniza schema sem migration (dev only)pnpm --filter @repo/database db:studioAbre o Prisma Studio

Deploy
O projeto está configurado para deploy no Vercel + Neon. Veja o vercel.json para as configurações de build.
Para migrations em produção, sempre use prisma migrate deploy — nunca db:push.

Convenções

TypeScript strict — noUncheckedIndexedAccess, noUnusedLocals etc.
ESLint flat config centralizado em @repo/config
Tailwind v4 com tema CSS-first
Server Actions preferidas a API Routes quando o caller é o próprio Next
Path aliases sempre via @repo/* — nunca importações relativas entre pacotes


Autor
Kauã Santos — Desenvolvedor Full-Stack com foco em IA e LLMs.
LinkedIn · GitHub · kauanki.z05@gmail.com
