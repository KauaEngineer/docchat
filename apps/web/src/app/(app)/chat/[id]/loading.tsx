import { MessagesSkeleton } from '@/components/chat/messages-skeleton';

export default function ChatLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-hidden">
        <MessagesSkeleton />
      </div>
      <div className="border-t px-4 pt-3 pb-4">
        <div className="mx-auto h-[68px] w-full max-w-3xl animate-pulse rounded-2xl border bg-muted/40" />
      </div>
    </div>
  );
}
