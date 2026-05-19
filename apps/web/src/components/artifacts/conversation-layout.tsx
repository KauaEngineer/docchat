'use client';

import * as React from 'react';

import { useArtifactStore } from '@/lib/stores/artifact-store';

import { ArtifactPanel } from './artifact-panel';

/**
 * Wrapper que divide o espaço da página da conversa em duas colunas quando
 * algum artefato está aberto na store.
 *
 * Estratégia:
 * - Desktop (md+): grid `1fr 1fr` — chat e painel dividem o espaço meio a
 *   meio. Não usei `auto 0` no fallback fechado pra evitar reflow custoso a
 *   cada toggle; só uma coluna existe quando o painel está fechado.
 * - Mobile (< md): o painel cobre o chat (`absolute inset-0`). Sem dois
 *   panes lado a lado num viewport estreito — não dá nem pra ler.
 *
 * Layout é puro CSS, sem JS de medição.
 */
export function ConversationLayout({ children }: { children: React.ReactNode }) {
  const isOpen = useArtifactStore((s) => s.openArtifact !== null);

  return (
    <div
      className={
        isOpen
          ? 'relative grid h-full min-h-0 md:grid-cols-2'
          : 'relative h-full min-h-0'
      }
    >
      <div className="h-full min-h-0">{children}</div>
      {isOpen ? (
        // Em mobile o painel cobre o chat; em md+ ocupa a 2a coluna do grid.
        <div className="bg-background absolute inset-0 z-30 md:static md:z-auto">
          <ArtifactPanel />
        </div>
      ) : null}
    </div>
  );
}
