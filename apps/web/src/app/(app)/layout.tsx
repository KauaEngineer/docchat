import * as React from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { listConversations } from '@/lib/actions/conversations';

import { AppShellProvider, Sidebar, type SidebarUser } from '@/components/app/sidebar';
import { KeyboardShortcuts } from '@/components/app/keyboard-shortcuts';
import { Topbar } from '@/components/app/topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const grouped = await listConversations();

  // Lista plana só pra resolver o título da conversa ativa no Topbar.
  const flatConversations = [
    ...grouped.hoje,
    ...grouped.ontem,
    ...grouped.ultimos7Dias,
    ...grouped.anteriores,
  ].map((c) => ({ id: c.id, title: c.title }));

  const sidebarUser: SidebarUser = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email,
    image: session.user.image ?? null,
  };

  return (
    <AppShellProvider>
      <div className="bg-background text-foreground flex h-screen w-full overflow-hidden">
        <Sidebar grouped={grouped} user={sidebarUser} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={sidebarUser} conversations={flatConversations} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <KeyboardShortcuts />
    </AppShellProvider>
  );
}
