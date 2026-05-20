// Declaração mínima do entrypoint interno do pdf-parse.
//
// O index.js do pacote tem um `if (!module.parent)` que carrega um PDF de teste
// no boot — quebra em ESM/serverless. Importamos `lib/pdf-parse.js` direto,
// mas o pacote não publica types pra esse caminho. Sem tipos, o `next build`
// na Vercel falha em TS7016.
//
// Mantemos a declaração no root de src/ (e não junto do uso em rag/) pra que
// tsc a inclua mesmo quando o consumidor é externo ao pacote (web app).
declare module 'pdf-parse/lib/pdf-parse.js';
