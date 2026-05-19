-- A migration inicial (20260516000000_init) criou attachments.messageId como
-- NOT NULL, mas o schema.prisma já estava com `messageId String?` — divergência
-- não detectada porque ninguém rodou `prisma migrate dev` depois do ajuste.
--
-- Fluxo correto: o upload cria a row do anexo ANTES da user message existir
-- (UX multi-step). O chat route faz UPDATE linkando messageId quando a
-- mensagem é persistida. Por isso a coluna precisa aceitar NULL.

ALTER TABLE "attachments" ALTER COLUMN "messageId" DROP NOT NULL;
