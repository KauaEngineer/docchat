'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDownIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { cn } from '@repo/ui/lib/utils';

import {
  DEFAULT_MODEL_ID,
  MODELS,
  PROVIDER_LABELS,
  getModel,
  isValidModelId,
  type ModelDef,
  type ModelProvider,
} from '@/lib/models';
import { updateConversationModel } from '@/lib/actions/conversations';

import { useAppShell } from './sidebar';

const STORAGE_KEY = 'chatbot:selected-model';

// Agrupa os modelos por provider preservando a ordem original do array.
const MODELS_BY_PROVIDER: Array<{ provider: ModelProvider; items: ModelDef[] }> = (() => {
  const map = new Map<ModelProvider, ModelDef[]>();
  for (const m of MODELS) {
    const list = map.get(m.provider) ?? [];
    list.push(m);
    map.set(m.provider, list);
  }
  return Array.from(map, ([provider, items]) => ({ provider, items }));
})();

export function ModelSelector({ className }: { className?: string }) {
  const { selectedModel, setSelectedModel } = useAppShell();
  const pathname = usePathname();
  const conversationId = extractConversationId(pathname);

  // Hidrata a partir do localStorage no mount. Roda só no client, então não
  // causa hydration mismatch — o servidor renderiza com o default do contexto.
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isValidModelId(stored) && stored !== selectedModel) {
        setSelectedModel(stored);
      }
    } catch {
      // localStorage indisponível (modo privado, etc.) — usa o default.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = getModel(selectedModel) ?? getModel(DEFAULT_MODEL_ID) ?? MODELS[0]!;

  function handleSelect(id: string): void {
    if (id === selectedModel) return;
    setSelectedModel(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignora falha de storage
    }
    if (conversationId) {
      void updateConversationModel(conversationId, id).catch(() => {
        toast.error('Não foi possível atualizar o modelo da conversa.');
      });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('gap-1.5 text-xs', className)}
          aria-label={`Modelo: ${current.displayName}`}
        >
          <ProviderIcon provider={current.provider} />
          <span className="truncate">{current.displayName}</span>
          <ChevronDownIcon className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        {MODELS_BY_PROVIDER.map(({ provider, items }, index) => (
          <React.Fragment key={provider}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="flex items-center gap-2 text-xs">
              <ProviderIcon provider={provider} />
              {PROVIDER_LABELS[provider]}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {items.map((m) => (
                <ModelMenuItem
                  key={m.id}
                  model={m}
                  active={m.id === current.id}
                  onSelect={() => handleSelect(m.id)}
                />
              ))}
            </DropdownMenuGroup>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ModelMenuItem({
  model,
  active,
  onSelect,
}: {
  model: ModelDef;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className={cn('flex flex-col items-start gap-0.5 py-2', active && 'bg-accent/60')}
    >
      <span className="text-sm font-medium">{model.displayName}</span>
      <span className="text-muted-foreground text-[11px]">
        {formatContext(model.contextWindow)} ctx
        {model.supportsVision ? ' · visão' : ''}
        {model.supportsTools ? ' · tools' : ''}
      </span>
    </DropdownMenuItem>
  );
}

function ProviderIcon({ provider }: { provider: ModelProvider }) {
  const styles: Record<ModelProvider, { letter: string; className: string }> = {
    anthropic: {
      letter: 'A',
      className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    },
    openai: {
      letter: 'O',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    },
    google: {
      letter: 'G',
      className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
    },
  };
  const { letter, className } = styles[provider];
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-bold',
        className,
      )}
    >
      {letter}
    </span>
  );
}

function extractConversationId(pathname: string): string | null {
  const match = pathname.match(/^\/chat\/([^/]+)$/);
  return match ? match[1]! : null;
}

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  return `${Math.round(tokens / 1000)}k`;
}
