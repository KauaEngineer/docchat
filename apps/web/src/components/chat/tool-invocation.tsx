'use client';

import * as React from 'react';
import type { ToolInvocation } from 'ai';
import {
  AlertCircleIcon,
  CalculatorIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  GlobeIcon,
  Loader2Icon,
  WrenchIcon,
} from 'lucide-react';

// Cada tool no registry (@repo/ai/tools) tem um ícone próprio aqui. Tools
// desconhecidas (futuras / nomes fora do registry) caem no fallback WrenchIcon.
const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  calculator: CalculatorIcon,
  webSearch: GlobeIcon,
  currentTime: ClockIcon,
};

// Labels em pt-BR pra exibir na UI sem confundir o usuário com nomes técnicos
// como `webSearch` / `currentTime`.
const TOOL_LABELS: Record<string, string> = {
  calculator: 'Calculadora',
  webSearch: 'Busca na web',
  currentTime: 'Hora atual',
};

export function ToolInvocationCard({
  invocation,
}: {
  invocation: ToolInvocation;
}) {
  const { toolName, state } = invocation;
  const Icon = TOOL_ICONS[toolName] ?? WrenchIcon;
  const label = TOOL_LABELS[toolName] ?? toolName;

  // Por que esse mapeamento de estados:
  //
  // O AI SDK v4 expõe três estados (`partial-call` | `call` | `result`); a doc
  // do v5 usa nomes diferentes (`input-streaming` | `input-available` |
  // `output-available` | `output-error`). Para o portfólio, replicamos a
  // semântica v5 em cima dos estados v4:
  //
  //   v4 'partial-call' = v5 'input-streaming'  → "Preparando…" (args parciais)
  //   v4 'call'         = v5 'input-available'  → "Executando…" + args completos
  //   v4 'result' OK    = v5 'output-available' → "✓" + result
  //   v4 'result' ERR   = v5 'output-error'     → "✗" + errorText
  //
  // Para detectar erro, as tools deste projeto retornam `{ error: '...' }`
  // quando algo dá ruim (calculator try/catch, webSearch HTTP fail, etc.).
  // É contrato interno — qualquer tool nova precisa seguir a convenção.

  if (state === 'partial-call') {
    return (
      <ToolCardShell tone="pending" Icon={Icon}>
        <div className="flex items-center gap-1.5 text-xs">
          <Loader2Icon className="size-3 animate-spin" />
          Preparando <span className="font-medium">{label}</span>…
        </div>
      </ToolCardShell>
    );
  }

  if (state === 'call') {
    return (
      <ToolCardShell tone="pending" Icon={Icon}>
        <div className="flex items-center gap-1.5 text-xs">
          <Loader2Icon className="size-3 animate-spin" />
          Executando <span className="font-medium">{label}</span>…
        </div>
        <ToolCollapsible
          title="Entrada"
          content={formatJson(invocation.args)}
        />
      </ToolCardShell>
    );
  }

  // state === 'result'
  const { result } = invocation;
  const errorText = extractError(result);

  if (errorText !== null) {
    return (
      <ToolCardShell tone="error" Icon={AlertCircleIcon}>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium text-destructive">✗ Erro em {label}:</span>
          <span className="text-destructive/90 break-words">{errorText}</span>
        </div>
      </ToolCardShell>
    );
  }

  return (
    <ToolCardShell tone="success" Icon={Icon}>
      <div className="flex items-center gap-1.5 text-xs">
        <CheckIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
        <span className="font-medium">{label}</span>
      </div>
      <ToolCollapsible title="Resultado" content={formatJson(result)} />
    </ToolCardShell>
  );
}

// -----------------------------------------------------------------------------
// Shell visual — borda + ícone esquerdo + slot pro conteúdo.
// -----------------------------------------------------------------------------

function ToolCardShell({
  Icon,
  tone,
  children,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  tone: 'pending' | 'success' | 'error';
  children: React.ReactNode;
}) {
  const toneClass =
    tone === 'error'
      ? 'border-destructive/40 bg-destructive/5'
      : tone === 'success'
        ? 'border-emerald-600/30 bg-emerald-500/5 dark:border-emerald-400/30'
        : 'border-border bg-muted/30';

  return (
    <div className={`my-2 flex gap-2 rounded-md border p-2 text-sm ${toneClass}`}>
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">{children}</div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Collapsible discreto para args / result (JSON pode ser longo).
// -----------------------------------------------------------------------------

function ToolCollapsible({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = React.useState(false);
  if (!content || content === 'null' || content === '""') return null;

  return (
    <div className="rounded border bg-background/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="hover:bg-muted/50 flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] transition-colors"
      >
        <span className="text-muted-foreground font-medium">{title}</span>
        <ChevronDownIcon
          className={`text-muted-foreground size-3 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open ? (
        <pre className="overflow-x-auto rounded-b border-t px-2 py-1.5 font-mono text-[11px] leading-relaxed">
          {content}
        </pre>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    // Estruturas circulares ou BigInt no result viram string crua.
    return String(value);
  }
}

// Convenção do projeto: tools retornam `{ error: '...' }` quando falham.
// Se o result for puro texto começando com "Error:", também trata como erro
// (margem pra tools de terceiros no futuro).
function extractError(result: unknown): string | null {
  if (
    result !== null &&
    typeof result === 'object' &&
    'error' in result &&
    typeof (result as { error: unknown }).error === 'string'
  ) {
    return (result as { error: string }).error;
  }
  return null;
}
