import { Skeleton } from '@repo/ui/components/skeleton';

// Fallback geral para qualquer rota dentro de (app) que ainda não tem
// loading.tsx mais específico. Renderiza apenas a área de conteúdo —
// sidebar + topbar vêm do layout e seguem renderizadas.
export default function AppLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 px-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-80" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}
