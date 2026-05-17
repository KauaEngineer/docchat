'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { Input } from '@repo/ui/components/input';
import { cn } from '@repo/ui/lib/utils';

import { deleteConversation, renameConversation } from '@/lib/actions/conversations';

export interface ConversationSummary {
  id: string;
  title: string;
  model: string;
  updatedAt: Date;
}

export interface GroupedConversations {
  hoje: ConversationSummary[];
  ontem: ConversationSummary[];
  ultimos7Dias: ConversationSummary[];
  anteriores: ConversationSummary[];
}

const SECTIONS: ReadonlyArray<{ key: keyof GroupedConversations; label: string }> = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'ontem', label: 'Ontem' },
  { key: 'ultimos7Dias', label: 'Últimos 7 dias' },
  { key: 'anteriores', label: 'Anteriores' },
];

export function ConversationList({
  grouped,
  onNavigate,
}: {
  grouped: GroupedConversations;
  onNavigate?: () => void;
}) {
  const isEmpty = SECTIONS.every((s) => grouped[s.key].length === 0);

  if (isEmpty) {
    return (
      <p className="text-muted-foreground p-4 text-center text-xs">
        Nenhuma conversa ainda.
        <br />
        Clique em <span className="font-medium">+ Nova conversa</span> para começar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-2 py-3">
      {SECTIONS.map((section) => {
        const items = grouped[section.key];
        if (items.length === 0) return null;
        return (
          <div key={section.key} className="flex flex-col gap-0.5">
            <h3 className="text-muted-foreground px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
              {section.label}
            </h3>
            {items.map((c) => (
              <ConversationItem key={c.id} conversation={c} onNavigate={onNavigate} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ConversationItem({
  conversation,
  onNavigate,
}: {
  conversation: ConversationSummary;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = pathname === `/chat/${conversation.id}`;

  const [renaming, setRenaming] = React.useState(false);
  const [title, setTitle] = React.useState(conversation.title);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setTitle(conversation.title);
  }, [conversation.title]);

  function commitRename() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === conversation.title) {
      setTitle(conversation.title);
      setRenaming(false);
      return;
    }
    startTransition(async () => {
      try {
        await renameConversation(conversation.id, trimmed);
        setRenaming(false);
      } catch {
        toast.error('Não foi possível renomear a conversa.');
        setTitle(conversation.title);
        setRenaming(false);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Apagar "${conversation.title}"? Esta ação é permanente.`)) return;
    startTransition(async () => {
      try {
        await deleteConversation(conversation.id);
        if (isActive) router.push('/chat');
      } catch {
        toast.error('Não foi possível apagar a conversa.');
      }
    });
  }

  if (renaming) {
    return (
      <div className="px-1">
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitRename();
            } else if (e.key === 'Escape') {
              setTitle(conversation.title);
              setRenaming(false);
            }
          }}
          disabled={isPending}
          className="h-8"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group hover:bg-accent flex items-center gap-1 rounded-md transition-colors',
        isActive && 'bg-accent',
        isPending && 'opacity-50',
      )}
    >
      <Link
        href={`/chat/${conversation.id}`}
        onClick={onNavigate}
        className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm"
        title={conversation.title}
      >
        {conversation.title}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label="Ações da conversa"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <PencilIcon className="size-4" />
            Renomear
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
            <Trash2Icon className="size-4" />
            Apagar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
