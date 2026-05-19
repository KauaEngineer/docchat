import { Skeleton } from '@repo/ui/components/skeleton';

// Skeleton da lista de conversas — embora o layout (app) carregue tudo de
// uma vez, esse componente é útil em transições "Suspense" e em qualquer
// futuro fetch incremental da sidebar.
export function ConversationListSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-2 py-3" aria-label="Carregando conversas">
      <Section count={3} />
      <Section count={4} />
      <Section count={2} />
    </div>
  );
}

function Section({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton className="ml-2 h-2.5 w-12" />
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-full rounded-md" />
      ))}
    </div>
  );
}
