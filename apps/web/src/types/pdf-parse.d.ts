// Ambient declaration espelhada de @repo/ai/src/rag/pdf-parse.d.ts.
//
// O `tsc` do web compila os fontes do @repo/ai (workspace + main aponta pra
// ./src), mas não enxerga as .d.ts ambient declaradas dentro daquele pacote
// — `include` do web só varre apps/web. Por isso replicamos aqui.
//
// Mantenha em sincronia com o original caso o uso do pdf-parse mude.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  const pdfParse: (data: Buffer) => Promise<PdfParseResult>;
  export default pdfParse;
}
