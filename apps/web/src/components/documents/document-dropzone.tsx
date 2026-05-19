'use client';

import * as React from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { Loader2Icon, UploadCloudIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@repo/ui/components/button';

const MAX_FILE_BYTES = 50 * 1024 * 1024;

// Restringimos por extensão E por mime: alguns navegadores mandam mime vazio
// para .md / .csv, então a allowlist via extensão é a que efetivamente filtra
// no diálogo nativo do SO. O backend revalida de qualquer jeito.
const ACCEPTED: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'text/csv': ['.csv'],
  'application/json': ['.json'],
};

export function DocumentDropzone({ onSuccess }: { onSuccess: () => void }) {
  const [uploading, setUploading] = React.useState(false);
  const [progressFile, setProgressFile] = React.useState<string | null>(null);

  const onDrop = React.useCallback(
    async (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        const first = rejected[0]!;
        const reason = first.errors[0]?.message ?? 'Arquivo inválido';
        toast.error(`"${first.file.name}": ${reason}`);
        return;
      }
      if (accepted.length === 0) return;

      // Spec: 1 arquivo por vez. react-dropzone com maxFiles=1 já garante
      // no caminho feliz, mas defendemos contra drop multi-arquivo programático.
      const file = accepted[0]!;
      setUploading(true);
      setProgressFile(file.name);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Falha no upload (${res.status}).`);
        }
        toast.success(`"${file.name}" enviado. Processando...`);
        onSuccess();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Falha ao enviar.');
      } finally {
        setUploading(false);
        setProgressFile(null);
      }
    },
    [onSuccess],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: 1,
    multiple: false,
    maxSize: MAX_FILE_BYTES,
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={[
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 text-center transition-colors',
        isDragActive && !isDragReject ? 'border-primary bg-primary/5' : 'border-border',
        isDragReject ? 'border-destructive bg-destructive/5' : '',
        uploading ? 'pointer-events-none opacity-60' : 'hover:bg-muted/40',
      ].join(' ')}
    >
      <input {...getInputProps()} />

      {uploading ? (
        <>
          <Loader2Icon className="text-muted-foreground size-8 animate-spin" />
          <p className="text-sm font-medium">Enviando...</p>
          {progressFile ? (
            <p className="text-muted-foreground truncate text-xs">{progressFile}</p>
          ) : null}
        </>
      ) : (
        <>
          <UploadCloudIcon className="text-muted-foreground size-8" />
          <p className="text-sm font-medium">
            {isDragActive
              ? isDragReject
                ? 'Tipo de arquivo não suportado'
                : 'Solte para enviar'
              : 'Arraste um arquivo ou clique para selecionar'}
          </p>
          <p className="text-muted-foreground text-xs">
            PDF, TXT, MD, CSV ou JSON — até 50&nbsp;MB
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-2">
            Selecionar arquivo
          </Button>
        </>
      )}
    </div>
  );
}
