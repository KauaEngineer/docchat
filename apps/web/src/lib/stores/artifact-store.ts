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

interface ArtifactStore {
  openArtifact: OpenArtifact | null;
  setOpen: (artifact: OpenArtifact) => void;
  close: () => void;
}

export const useArtifactStore = create<ArtifactStore>((set) => ({
  openArtifact: null,
  setOpen: (artifact) => set({ openArtifact: artifact }),
  close: () => set({ openArtifact: null }),
}));
