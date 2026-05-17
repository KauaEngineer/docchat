'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileTextIcon, MessageSquarePlusIcon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar';
import { Button } from '@repo/ui/components/button';
import { ScrollArea } from '@repo/ui/components/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@repo/ui/components/sheet';

import { createConversation } from '@/lib/actions/conversations';
import { DEFAULT_MODEL_ID } from '@/lib/models';

import {
  ConversationList,
  type GroupedConversations,
} from './conversation-list';

export interface SidebarUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

// -----------------------------------------------------------------------------
// AppShell context — compartilha entre Sidebar e Topbar:
//  - estado do Sheet móvel (hamburger no topbar dispara setMobileOpen)
//  - modelo atualmente selecionado (topbar é quem muda, sidebar usa ao criar)
// -----------------------------------------------------------------------------

interface AppShellState {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  selectedModel: string;
  setSelectedModel: (id: string) => void;
}

const AppShellContext = React.createContext<AppShellState | null>(null);

export function AppShellProvider({
  children,
  defaultModel = DEFAULT_MODEL_ID,
}: {
  children: React.ReactNode;
  defaultModel?: string;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [selectedModel, setSelectedModel] = React.useState<string>(defaultModel);

  const value = React.useMemo<AppShellState>(
    () => ({ mobileOpen, setMobileOpen, selectedModel, setSelectedModel }),
    [mobileOpen, selectedModel],
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell(): AppShellState {
  const ctx = React.useContext(AppShellContext);
  if (!ctx) throw new Error('useAppShell deve estar dentro de <AppShellProvider>.');
  return ctx;
}

// -----------------------------------------------------------------------------
// Sidebar
// -----------------------------------------------------------------------------

export function Sidebar({
  grouped,
  user,
}: {
  grouped: GroupedConversations;
  user: SidebarUser;
}) {
  const { mobileOpen, setMobileOpen } = useAppShell();
  const closeMobile = React.useCallback(() => setMobileOpen(false), [setMobileOpen]);

  return (
    <>
      <aside className="bg-background hidden w-64 shrink-0 border-r lg:flex lg:flex-col">
        <SidebarInner grouped={grouped} user={user} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <SidebarInner grouped={grouped} user={user} onNavigate={closeMobile} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function SidebarInner({
  grouped,
  user,
  onNavigate,
}: {
  grouped: GroupedConversations;
  user: SidebarUser;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { selectedModel } = useAppShell();
  const [creating, setCreating] = React.useState(false);

  async function handleNewConversation(): Promise<void> {
    setCreating(true);
    try {
      const { id } = await createConversation(selectedModel);
      onNavigate?.();
      router.push(`/chat/${id}`);
    } catch {
      toast.error('Não foi possível criar uma nova conversa.');
    } finally {
      setCreating(false);
    }
  }

  const initial = (user.name ?? user.email).slice(0, 1).toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <SparklesIcon className="size-4" />
        </div>
        <span className="truncate text-sm font-semibold">Chatbot Portfolio</span>
      </div>

      <div className="p-3">
        <Button
          onClick={handleNewConversation}
          disabled={creating}
          className="w-full justify-start gap-2"
        >
          <MessageSquarePlusIcon className="size-4" />
          {creating ? 'Criando...' : 'Nova conversa'}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <ConversationList grouped={grouped} onNavigate={onNavigate} />
      </ScrollArea>

      <div className="flex flex-col gap-1 border-t p-3">
        <Link
          href="/documents"
          onClick={onNavigate}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
        >
          <FileTextIcon className="size-4" />
          Documentos
        </Link>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Avatar className="size-7">
            {user.image ? <AvatarImage src={user.image} alt={user.name ?? ''} /> : null}
            <AvatarFallback className="text-xs">{initial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">
              {user.name ?? 'Sem nome'}
            </p>
            <p className="text-muted-foreground truncate text-xs leading-tight">{user.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
