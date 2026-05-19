'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog';

import { createConversation } from '@/lib/actions/conversations';
import { useAppShell } from './sidebar';

// Shortcuts globais do app. Montado dentro do AppShellProvider em (app)/layout
// — fora do shell o componente quebra (useAppShell).
//
// - mod+k    → foco no Composer (procura [data-slot="composer-input"] no DOM)
// - mod+n    → nova conversa (server action + push)
// - mod+/    → abre o cheatsheet
//
// `mod` é a abstração do react-hotkeys-hook para Cmd no macOS e Ctrl em
// outros sistemas operacionais. `preventDefault` evita que o browser
// intercepte (mod+n abre janela nova; mod+/ é "find" em alguns lugares).
const HOTKEY_OPTIONS = { preventDefault: true, enableOnFormTags: true } as const;

export function KeyboardShortcuts() {
  const router = useRouter();
  const { selectedModel } = useAppShell();
  const [cheatsheetOpen, setCheatsheetOpen] = React.useState(false);
  const creatingRef = React.useRef(false);

  useHotkeys(
    'mod+k',
    () => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-slot="composer-input"]',
      );
      if (el) {
        el.focus();
        // Posiciona o cursor no fim — se o composer já tinha texto, o
        // usuário continua de onde estava em vez de sobrescrever.
        const end = el.value.length;
        el.setSelectionRange(end, end);
      }
    },
    HOTKEY_OPTIONS,
  );

  useHotkeys(
    'mod+n',
    () => {
      if (creatingRef.current) return;
      creatingRef.current = true;
      void createConversation(selectedModel)
        .then(({ id }) => {
          router.push(`/chat/${id}`);
        })
        .catch(() => {
          toast.error('Não foi possível criar uma nova conversa.');
        })
        .finally(() => {
          creatingRef.current = false;
        });
    },
    HOTKEY_OPTIONS,
  );

  useHotkeys(
    'mod+/',
    () => setCheatsheetOpen((v) => !v),
    HOTKEY_OPTIONS,
  );

  return (
    <Dialog open={cheatsheetOpen} onOpenChange={setCheatsheetOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>
            Use <Kbd>⌘</Kbd>/<Kbd>Ctrl</Kbd> conforme o seu sistema operacional.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y">
          <ShortcutRow keys={['mod', 'K']} label="Focar no composer" />
          <ShortcutRow keys={['mod', 'N']} label="Nova conversa" />
          <ShortcutRow keys={['mod', '/']} label="Abrir esta lista de atalhos" />
          <ShortcutRow keys={['Enter']} label="Enviar mensagem" />
          <ShortcutRow keys={['Shift', 'Enter']} label="Quebrar linha" />
          <ShortcutRow keys={['Esc']} label="Fechar diálogos" />
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <li className="flex items-center justify-between py-2 text-sm">
      <span>{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <React.Fragment key={k + i}>
            {i > 0 ? <span className="text-muted-foreground text-xs">+</span> : null}
            <Kbd>{k === 'mod' ? '⌘ / Ctrl' : k}</Kbd>
          </React.Fragment>
        ))}
      </div>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-muted border-border text-muted-foreground inline-flex h-6 items-center rounded border px-1.5 font-mono text-[11px] font-medium">
      {children}
    </kbd>
  );
}
