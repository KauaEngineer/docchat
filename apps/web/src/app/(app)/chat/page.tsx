import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

import { ChatLanding } from '@/components/chat/chat-landing';

export default async function NewChatPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  return <ChatLanding userName={session.user.name ?? null} />;
}
