'use client';

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileTextIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  UploadCloudIcon,
} from 'lucide-react';
import useSWR from 'swr';
import { toast } from 'sonner';

import { Button } from '@repo/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog';

import { DocumentDropzone } from './document-dropzone';

// -----------------------------------------------------------------------------
// Tipos compartilhados com a API.
// -----------------------------------------------------------------------------

type DocumentStatus = 'PROCESSING' | 'READY' | 'FAILED';

export interface DocumentRow {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

const POLL_INTERVAL_MS = 3000;

const fetcher = async (url: string): Promise<{ documents: DocumentRow[] }> => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Falha ao buscar documentos (${res.status}).`);
  }
  return res.json() as Promise<{ documents: DocumentRow[] }>;
};

export function DocumentsPanel() {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data, error, isLoading, mutate } = useSWR<{ documents: DocumentRow[] }>(
    '/api/documents',
    fetcher,
    {
      // Polling adaptativo: se algum doc está PROCESSING, refaz a cada 3s.
      // Quando todos estão READY/FAILED retorna 0 e o SWR pausa o intervalo.
      refreshInterval: (latest) => {
        if (!latest) return 0;
        return latest.documents.some((d) => d.status === 'PROCESSING')
          ? POLL_INTERVAL_MS
          : 0;
      },
      revalidateOnFocus: true,
    },
  );

  const documents = data?.documents ?? [];

  async function handleDelete(doc: DocumentRow): Promise<void> {
    if (!confirm(`Remover "${doc.filename}"?`)) return;
    // Otimismo: tira da UI já, e devolve se a request falhar.
    const previous = data;
    void mutate(
      previous
        ? { documents: previous.documents.filter((d) => d.id !== doc.id) }
        : previous,
      { revalidate: false },
    );
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Falha ao deletar (${res.status}).`);
      }
      toast.success(`"${doc.filename}" removido.`);
      void mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao deletar documento.');
      void mutate(previous, { revalidate: true });
    }
  }

  function handleUploadSuccess(): void {
    setDialogOpen(false);
    // Disparo imediato — não esperamos o próximo tick do polling.
    void mutate();
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Documentos</h1>
          <p className="text-muted-foreground text-sm">
            Envie arquivos para a base de conhecimento do chatbot.
          </p>
        </div>

        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <PlusIcon className="size-4" />
          Adicionar Documento
        </Button>
      </div>

      {error ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-4 text-sm">
          {error instanceof Error ? error.message : 'Erro ao carregar documentos.'}
        </div>
      ) : isLoading ? (
        <DocumentsSkeleton />
      ) : documents.length === 0 ? (
        <EmptyState onAdd={() => setDialogOpen(true)} />
      ) : (
        <DocumentsTable documents={documents} onDelete={handleDelete} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar documento</DialogTitle>
            <DialogDescription>
              PDF, TXT, MD, CSV ou JSON. Máximo 50&nbsp;MB por arquivo.
            </DialogDescription>
          </DialogHeader>
          <DocumentDropzone onSuccess={handleUploadSuccess} />
        </DialogContent>
      </Dialog>
    </>
  );
}

// -----------------------------------------------------------------------------
// Tabela
// -----------------------------------------------------------------------------

function DocumentsTable({
  documents,
  onDelete,
}: {
  documents: DocumentRow[];
  onDelete: (doc: DocumentRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr className="text-left">
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">Tipo</th>
            <th className="px-4 py-2 font-medium">Tamanho</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Criado em</th>
            <th className="w-12 px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className="border-t">
              <td className="max-w-xs px-4 py-2">
                <div className="flex items-center gap-2">
                  <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
                  <span className="truncate" title={doc.filename}>
                    {doc.filename}
                  </span>
                </div>
              </td>
              <td className="text-muted-foreground px-4 py-2">
                {formatType(doc.mimeType)}
              </td>
              <td className="text-muted-foreground px-4 py-2">
                {formatSize(doc.size)}
              </td>
              <td className="px-4 py-2">
                <StatusBadge status={doc.status} errorMessage={doc.errorMessage} />
              </td>
              <td className="text-muted-foreground px-4 py-2">
                {formatRelative(doc.createdAt)}
              </td>
              <td className="px-4 py-2 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(doc)}
                  aria-label={`Remover ${doc.filename}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({
  status,
  errorMessage,
}: {
  status: DocumentStatus;
  errorMessage: string | null;
}) {
  if (status === 'PROCESSING') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
        <Loader2Icon className="size-3 animate-spin" />
        Processando
      </span>
    );
  }
  if (status === 'READY') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
        Pronto
      </span>
    );
  }
  return (
    <span
      title={errorMessage ?? undefined}
      className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200"
    >
      Falhou
    </span>
  );
}

// -----------------------------------------------------------------------------
// Empty / Skeleton
// -----------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-12 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <UploadCloudIcon className="size-6" />
      </div>
      <div>
        <p className="font-medium">Nenhum documento ainda</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Envie um PDF, TXT, MD, CSV ou JSON para começar a usar com o chatbot.
        </p>
      </div>
      <Button onClick={onAdd} className="mt-2 gap-2">
        <PlusIcon className="size-4" />
        Adicionar Documento
      </Button>
    </div>
  );
}

function DocumentsSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-muted/50 h-12 animate-pulse rounded-md" />
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Format helpers
// -----------------------------------------------------------------------------

const MIME_LABEL: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/json': 'JSON',
  'text/plain': 'TXT',
  'text/markdown': 'MD',
  'text/csv': 'CSV',
};

function formatType(mime: string): string {
  if (MIME_LABEL[mime]) return MIME_LABEL[mime];
  if (mime.startsWith('text/')) return mime.slice(5).toUpperCase();
  return mime;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
}
