import { tool } from 'ai';
import { z } from 'zod';

// Convenção do projeto: artefatos vivem em um painel lateral renderizado
// pelo cliente. O `execute` aqui é só um eco — ele devolve os mesmos campos
// pra fechar o tool call no protocolo, mas quem efetivamente "abre" o painel
// é a UI, que escuta as tool-invocations do stream.
//
// Persistência: quando a assistant message for salva no banco, os args do
// tool call podem ser usados pra materializar uma row em `Artifact` ligada
// à message (kind/title/content/language). Fora do escopo desta tool —
// fica no consumer (chat/route.ts onFinish).
//
// Nota sobre `parameters` vs `inputSchema`: o spec da task usa `inputSchema`
// (terminologia v5), mas o SDK do projeto (`ai@4.3.x`) define o campo como
// `parameters`. O Zod schema em si é idêntico.

export const ARTIFACT_KIND = ['CODE', 'HTML', 'SVG', 'MARKDOWN'] as const;
export type ArtifactKind = (typeof ARTIFACT_KIND)[number];

export const createArtifact = tool({
  description: `Cria um artefato visualizado em painel lateral. Use quando gerar:
    - Código com mais de 15 linhas (especifique a linguagem)
    - HTML completo standalone (com <html>, <head>, <body>)
    - SVG standalone
    - Markdown longo formatado (documentos, READMEs, especificações)
    Sempre forneça um título descritivo curto.
    NÃO use artefato para snippets curtos, listas simples, ou explicações conversacionais.`,
  parameters: z.object({
    kind: z.enum(ARTIFACT_KIND),
    title: z.string().min(1).max(80),
    language: z
      .string()
      .optional()
      .describe('Para CODE: typescript, python, rust, etc'),
    content: z.string().describe('Conteúdo completo do artefato'),
  }),
  execute: async ({ kind, title, language, content }) => {
    return { kind, title, language, content, success: true };
  },
});

export const updateArtifact = tool({
  description: `Atualiza um artefato existente referenciado por título. Use quando o usuário
    pedir modificações em um artefato já criado nesta conversa.`,
  parameters: z.object({
    title: z.string().describe('Título exato do artefato a atualizar'),
    content: z.string().describe('Novo conteúdo COMPLETO (não diff)'),
  }),
  execute: async ({ title, content }) => ({ title, content, success: true }),
});
