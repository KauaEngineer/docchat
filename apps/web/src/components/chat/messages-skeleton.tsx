import { Skeleton } from '@repo/ui/components/skeleton';

// Skeleton da timeline de mensagens — usado pelo loading.tsx de chat/[id]
// enquanto o RSC busca a conversa no banco. Alterna larguras pra parecer um
// stream natural de assistant/user em vez de uma grade quadradinha.
export function MessagesSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <MessageRow align="user" widths={['65%']} />
      <MessageRow align="assistant" widths={['90%', '80%', '60%']} />
      <MessageRow align="user" widths={['45%']} />
      <MessageRow align="assistant" widths={['85%', '95%', '70%', '40%']} />
    </div>
  );
}

function MessageRow({
  align,
  widths,
}: {
  align: 'user' | 'assistant';
  widths: string[];
}) {
  const isUser = align === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start gap-3'}>
      {isUser ? null : <Skeleton className="size-7 shrink-0 rounded-full" />}
      <div
        className={
          isUser
            ? 'flex max-w-[80%] flex-col gap-2 rounded-2xl bg-muted/60 px-4 py-3'
            : 'flex max-w-[85%] flex-col gap-2'
        }
      >
        {widths.map((w, i) => (
          <Skeleton key={i} className="h-3.5" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}
