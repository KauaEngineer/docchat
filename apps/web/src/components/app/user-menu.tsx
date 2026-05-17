'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOutIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar';
import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';

import { authClient } from '@/lib/auth-client';

export interface UserMenuUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export function UserMenu({ user }: { user: UserMenuUser }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const initial = (user.name ?? user.email).slice(0, 1).toUpperCase();

  async function handleSignOut(): Promise<void> {
    setPending(true);
    const { error } = await authClient.signOut();
    if (error) {
      toast.error('Não foi possível sair. Tente novamente.');
      setPending(false);
      return;
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Menu do usuário"
          disabled={pending}
        >
          <Avatar className="size-7">
            {user.image ? <AvatarImage src={user.image} alt={user.name ?? ''} /> : null}
            <AvatarFallback className="text-xs">{initial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{user.name ?? 'Sem nome'}</span>
          <span className="text-muted-foreground truncate text-xs font-normal">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handleSignOut} disabled={pending}>
          <LogOutIcon className="size-4" />
          {pending ? 'Saindo...' : 'Sair'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
