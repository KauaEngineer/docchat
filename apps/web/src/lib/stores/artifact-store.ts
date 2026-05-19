'use client';

import { create } from 'zustand';

// Identificamos um artefato aberto pelo par (conversationId, title) — o
// componente do painel resolve as versões com isso. Não guardamos `version`
// aqui porque o painel sempre começa mostrando a última e tem seu próprio
// seletor interno (estado efêmero, não global).
export interface OpenArtifact {
  conversationId: string;
  title: string;
}

// Estado live alimentado pelo hook `use-artifact-streaming`. Existe para
// permitir que o painel exiba o conteúdo enquanto o modelo ainda está
// emitindo os tokens do `args` da tool createArtifact.
//
// `isLive` distingue "ainda streamando" (cursor piscando, conteúdo crescendo)
// de "stream terminou mas o DB ainda não tem a row" (gap entre `state: 'call'`
// e `onFinish`).
export type StreamingKind = 'CODE' | 'HTML' | 'SVG' | 'MARKDOWN';

export interface StreamingArtifact {
  conversationId: string;
  title: string;
  kind: StreamingKind | null;
  content: string;
  isLive: boolean;
}

interface ArtifactStore {
  openArtifact: OpenArtifact | null;
  streaming: StreamingArtifact | null;
  setOpen: (artifact: OpenArtifact) => void;
  close: () => void;
  setStreaming: (s: StreamingArtifact | null) => void;
}

export const useArtifactStore = create<ArtifactStore>((set) => ({
  openArtifact: null,
  streaming: null,
  setOpen: (artifact) => set({ openArtifact: artifact }),
  close: () => set({ openArtifact: null }),
  setStreaming: (s) => set({ streaming: s }),
}));
