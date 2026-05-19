'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangleIcon, RotateCcwIcon } from 'lucide-react';

import { Button } from '@repo/ui/components/button';

// Error boundary do grupo (app). Captura erros de qualquer página/layout
// abaixo de /chat, /documents, etc. — fora dele caímos no global-error.tsx.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="bg-destructive/10 text-destructive mb-4 flex size-12 items-center justify-center rounded-full">
          <AlertTriangleIcon className="size-6" />
        </div>
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Não conseguimos carregar esta tela. Pode ser um problema temporário — tente
          novamente em alguns instantes.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground mt-3 font-mono text-[11px]">
            ref: {error.digest}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button onClick={reset} className="gap-2">
            <RotateCcwIcon className="size-4" />
            Tentar de novo
          </Button>
          <Button variant="outline" asChild>
            <Link href="/chat">Voltar pro início</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
