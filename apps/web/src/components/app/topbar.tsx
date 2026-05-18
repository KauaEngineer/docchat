'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDownIcon, MenuIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';

import { DEFAULT_MODEL_ID, MODELS, getModel } from '@/lib/models';

import { useAppShell } from './sidebar';
import { UserMenu, type UserMenuUser } from './user-menu';

interface TopbarConversation {
  id: string;
  title: string;
}

export function Topbar({
  user,
  conversations,
}: {
  user: UserMenuUser;
  conversations: TopbarConversation[];
}) {
  const { setMobileOpen, selectedModel, setSelectedModel } = useAppShell();
  const pathname = usePathname();

  const title = deriveTitle(pathname, conversations);
  const currentModel =
    getModel(selectedModel) ?? getModel(DEFAULT_MODEL_ID) ?? MODELS[0]!;

  return (
    <header className="bg-background flex h-12 shrink-0 items-center justify-between gap-2 border-b px-2 lg:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
        >
          <MenuIcon className="size-5" />
        </Button>
        <h1 className="truncate text-sm font-medium">{title}</h1>
      </div>

      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              {currentModel.displayName}
              <ChevronDownIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Modelo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {MODELS.map((m) => (
              <DropdownMenuItem key={m.id} onSelect={() => setSelectedModel(m.id)}>
                {m.displayName}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

function deriveTitle(pathname: string, conversations: TopbarConversation[]): string {
  const chatMatch = pathname.match(/^\/chat\/([^/]+)/);
  if (chatMatch) {
    const id = chatMatch[1];
    const active = conversations.find((c) => c.id === id);
    return active?.title ?? 'Conversa';
  }
  if (pathname === '/chat') return 'Nova conversa';
  if (pathname.startsWith('/documents')) return 'Documentos';
  return '';
}

function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const { setTheme, resolvedTheme } = useTheme();

  // Render a fixed-size placeholder antes do mount para evitar layout shift.
  if (!mounted) {
    return <Button variant="ghost" size="icon" disabled aria-hidden className="opacity-0" />;
  }

  const isDark = resolvedTheme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  );
}
