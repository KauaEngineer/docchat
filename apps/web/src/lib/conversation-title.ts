// Título placeholder de uma conversa recém-criada. DEVE bater com o
// `@default("Nova conversa")` do schema Prisma (Conversation.title) — é o que
// `createConversation` grava antes da primeira resposta existir.
export const PLACEHOLDER_TITLE = 'Nova conversa';

// True enquanto a conversa ainda não tem título "de verdade": ou está
// vazia/null, ou ainda é o placeholder. O gerador de título (no /api/chat)
// usa isso pra decidir se deve derivar um título da primeira mensagem —
// sem tratar o placeholder como "sem título", toda conversa ficaria presa
// em "Nova conversa".
export function needsGeneratedTitle(title: string | null | undefined): boolean {
  const trimmed = title?.trim() ?? '';
  return trimmed === '' || trimmed === PLACEHOLDER_TITLE;
}
