-- DropIndex
DROP INDEX "document_chunk_embedding_idx";

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "errorMessage" TEXT;
