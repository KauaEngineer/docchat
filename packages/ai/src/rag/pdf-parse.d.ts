// O entrypoint default do `pdf-parse` (1.1.x) tem código que carrega um PDF
// de teste no module load, quebrando em ESM/serverless. Importamos o lib path
// pra contornar — mas o pacote não publica types pra ele. Declaração ambient
// mínima espelhando o que usamos.
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
