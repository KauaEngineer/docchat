import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

import { DocumentsPanel } from '@/components/documents/documents-panel';

export default async function DocumentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <DocumentsPanel />
    </div>
  );
}
