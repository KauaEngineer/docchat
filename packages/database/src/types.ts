// =============================================================================
// Re-export dos tipos gerados pelo Prisma Client.
// =============================================================================
// `verbatimModuleSyntax` exige separar exports de tipo (modelos, namespace
// Prisma) de exports de valor (enums e PrismaClient — que são objetos runtime).

export type {
  User,
  Session,
  Account,
  Verification,
  Conversation,
  Message,
  Artifact,
  Attachment,
  Document,
  DocumentChunk,
  Prisma,
} from '@prisma/client';

export { MessageRole, ArtifactKind, DocumentStatus, PrismaClient } from '@prisma/client';
