'use client';

import * as React from 'react';
import {
  BookOpenIcon,
  CalculatorIcon,
  ClockIcon,
  FileIcon,
  GlobeIcon,
  ImageIcon,
  Loader2Icon,
  PaperclipIcon,
  SendHorizontalIcon,
  SquareIcon,
  WrenchIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { Switch } from '@repo/ui/components/switch';
import { cn } from '@repo/ui/lib/utils';

const USE_RAG_STORAGE_KEY = 'chat:useRAG';
const ENABLED_TOOLS_STORAGE_KEY = 'chat:enabledTools';

// Lista canônica para o UI. Os `name`s precisam casar com as keys do registry
// em @repo/ai/tools (calculator/webSearch/currentTime); errar um nome silencia
// a tool no backend porque o getTools ignora desconhecidos.
const TOOL_OPTIONS = [
  { name: 'calculator', label: 'Calculadora', Icon: CalculatorIcon },
  { name: 'webSearch', label: 'Busca na web', Icon: GlobeIcon },
  { name: 'currentTime', label: 'Hora atual', Icon: ClockIcon },
] as const;

type ToolOptionName = (typeof TOOL_OPTIONS)[number]['name'];

const ALL_TOOL_NAMES: readonly ToolOptionName[] = TOOL_OPTIONS.map((t) => t.name);

function isToolName(name: string): name is ToolOptionName {
  return (ALL_TOOL_NAMES as readonly string[]).includes(name);
}

const MAX_HEIGHT_PX = 200;
const CHAR_WARNING_THRESHOLD = 4000;
const ACCEPT_ATTR =
  'image/png,image/jpeg,image/webp,image/gif,application/pdf,text/*,application/json';

export interface SubmittedAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

interface ComposerAttachment {
  localId: string;
  filename: string;
  mimeType: string;
  size: number;
  status: 'uploading' | 'ready' | 'error';
  id?: string;
  url?: string;
  errorMessage?: string;
}

export interface ComposerProps {
  onSubmit: (
    text: string,
    options?: {
      attachments?: SubmittedAttachment[];
      useRAG?: boolean;
      enabledTools?: string[];
    },
  ) => void | Promise<void>;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  // Valor inicial do textarea (sugestão de prompt clicada, etc). Usado só
  // na inicialização do state — para atualizar depois, remonte o Composer
  // via `key` no JSX pai.
  initialValue?: string;
  // Desabilita Paperclip + drag/drop. Usado na landing (sem conversationId
  // ainda — anexos órfãos seriam confusos).
  disableAttachments?: boolean;
  // Desabilita o toggle de RAG. Usamos na landing (sem conversa, sem turno).
  disableRag?: boolean;
  // Desabilita o seletor de tools. Usado na landing pela mesma razão.
  disableTools?: boolean;
  className?: string;
}

export function Composer({
  onSubmit,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = 'Envie uma mensagem...',
  autoFocus = false,
  initialValue = '',
  disableAttachments = false,
  disableRag = false,
  disableTools = false,
  className,
}: ComposerProps) {
  const [value, setValue] = React.useState(initialValue);
  const [attachments, setAttachments] = React.useState<ComposerAttachment[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  // Default `false` no SSR pra evitar hydration mismatch; rehidratamos do
  // localStorage logo após o mount. Se o usuário enviar antes do effect rodar,
  // perde-se um turno com RAG desligado — aceitável (1 frame de UX).
  const [useRAG, setUseRAG] = React.useState(false);
  const [enabledTools, setEnabledTools] = React.useState<ToolOptionName[]>([]);

  React.useEffect(() => {
    if (disableRag) return;
    try {
      const stored = window.localStorage.getItem(USE_RAG_STORAGE_KEY);
      if (stored === 'true') setUseRAG(true);
    } catch {
      // localStorage indisponível (modo privado / SSR-only); segue com default.
    }
  }, [disableRag]);

  React.useEffect(() => {
    if (disableTools) return;
    try {
      const raw = window.localStorage.getItem(ENABLED_TOOLS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      // Sanitiza: aceita só nomes do registry atual. Itens antigos/inválidos
      // (ex.: tool removida em uma versão futura) são silenciosamente descartados.
      if (Array.isArray(parsed)) {
        setEnabledTools(parsed.filter((v): v is ToolOptionName =>
          typeof v === 'string' && isToolName(v),
        ));
      }
    } catch {
      // JSON corrompido ou storage bloqueado — fica com default vazio.
    }
  }, [disableTools]);

  function toggleRag(next: boolean): void {
    setUseRAG(next);
    try {
      window.localStorage.setItem(USE_RAG_STORAGE_KEY, next ? 'true' : 'false');
    } catch {
      // Sem persistência se o storage estiver bloqueado; estado local segue.
    }
  }

  function toggleTool(name: ToolOptionName, next: boolean): void {
    setEnabledTools((prev) => {
      const set = new Set(prev);
      if (next) set.add(name);
      else set.delete(name);
      // Preserva a ordem canônica do TOOL_OPTIONS pra ficar estável
      // independente da ordem de cliques.
      const arr = ALL_TOOL_NAMES.filter((n) => set.has(n));
      try {
        window.localStorage.setItem(ENABLED_TOOLS_STORAGE_KEY, JSON.stringify(arr));
      } catch {
        // sem persistência
      }
      return arr;
    });
  }

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // dragenter/dragleave disparam recursivamente nos filhos. Usamos um contador
  // pra só desativar o highlight quando saímos do composer inteiro.
  const dragCounterRef = React.useRef(0);

  // Auto-resize: zera a altura para o scrollHeight refletir só o conteúdo,
  // depois aplica clampado em MAX_HEIGHT_PX.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, MAX_HEIGHT_PX);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, [value]);

  const trimmed = value.trim();
  const hasReadyAttachment = attachments.some((a) => a.status === 'ready');
  const isUploading = attachments.some((a) => a.status === 'uploading');
  const canSend =
    !disabled &&
    !isStreaming &&
    !isUploading &&
    (trimmed.length > 0 || hasReadyAttachment);

  async function handleFiles(fileList: FileList | File[]): Promise<void> {
    if (disableAttachments) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;

    // Cria placeholders 'uploading' imediatamente — UX percebe os arquivos
    // antes do round-trip pro servidor.
    const newEntries: ComposerAttachment[] = files.map((f) => ({
      localId: crypto.randomUUID(),
      filename: f.name,
      mimeType: f.type,
      size: f.size,
      status: 'uploading',
    }));
    setAttachments((prev) => [...prev, ...newEntries]);

    const formData = new FormData();
    for (const f of files) formData.append('files', f);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Erro no upload (${res.status}).`);
      }
      const data = (await res.json()) as {
        attachments: Array<{
          id: string;
          filename: string;
          mimeType: string;
          size: number;
          url: string;
        }>;
      };

      // Server preserva ordem do FormData — mapeamos 1:1 contra newEntries.
      setAttachments((prev) => {
        const next = [...prev];
        data.attachments.forEach((sa, i) => {
          const local = newEntries[i];
          if (!local) return;
          const idx = next.findIndex((a) => a.localId === local.localId);
          if (idx >= 0) {
            next[idx] = {
              ...next[idx]!,
              status: 'ready',
              id: sa.id,
              url: sa.url,
            };
          }
        });
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro no upload.';
      toast.error(message);
      setAttachments((prev) =>
        prev.map((a) =>
          newEntries.some((n) => n.localId === a.localId)
            ? { ...a, status: 'error', errorMessage: message }
            : a,
        ),
      );
    }
  }

  function removeAttachment(localId: string): void {
    // Nota: o objeto no R2 fica como órfão (limpeza fora de escopo). Mesma
    // coisa se a aba for fechada com anexo pendente.
    setAttachments((prev) => prev.filter((a) => a.localId !== localId));
  }

  async function handleSubmit(): Promise<void> {
    if (!canSend) return;
    const ready = attachments
      .filter(
        (a): a is ComposerAttachment & { id: string; url: string; status: 'ready' } =>
          a.status === 'ready' && typeof a.id === 'string' && typeof a.url === 'string',
      )
      .map<SubmittedAttachment>((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        url: a.url,
      }));

    const toSend = trimmed;
    setValue('');
    setAttachments([]);
    await onSubmit(toSend, {
      attachments: ready.length > 0 ? ready : undefined,
      useRAG: disableRag ? undefined : useRAG,
      enabledTools:
        disableTools || enabledTools.length === 0 ? undefined : [...enabledTools],
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    // Enter envia; Shift+Enter quebra linha; também respeita IME (composição).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  // -- Drag & drop ----------------------------------------------------------

  function isFileDrag(e: React.DragEvent): boolean {
    // dataTransfer.types pode incluir 'Files' quando arquivos do SO estão
    // sendo arrastados. Ignora drags de texto/HTML pra não piscar o overlay.
    return Array.from(e.dataTransfer.types).includes('Files');
  }

  function onDragEnter(e: React.DragEvent): void {
    if (disableAttachments || !isFileDrag(e)) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  }
  function onDragLeave(e: React.DragEvent): void {
    if (disableAttachments) return;
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  }
  function onDragOver(e: React.DragEvent): void {
    if (disableAttachments || !isFileDrag(e)) return;
    e.preventDefault();
  }
  function onDrop(e: React.DragEvent): void {
    if (disableAttachments) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  }

  return (
    <div
      className={cn('w-full', className)}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <AttachmentChip
              key={a.localId}
              attachment={a}
              onRemove={() => removeAttachment(a.localId)}
            />
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          'bg-background focus-within:border-ring focus-within:ring-ring/20 relative flex flex-col rounded-2xl border shadow-sm transition focus-within:ring-2',
          isDragging && 'border-primary ring-primary/20 ring-2',
        )}
      >
        {isDragging ? (
          <div className="bg-primary/5 text-primary pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl text-sm font-medium">
            Solte os arquivos aqui
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          data-slot="composer-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          autoFocus={autoFocus}
          disabled={disabled}
          aria-label="Mensagem"
          className="placeholder:text-muted-foreground max-h-[200px] min-h-[44px] w-full resize-none bg-transparent px-4 py-3 text-sm leading-6 outline-none disabled:opacity-50"
        />

        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex items-center gap-1">
            {disableAttachments ? null : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT_ATTR}
                  hidden
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      void handleFiles(e.target.files);
                    }
                    // Reset pra permitir re-selecionar o mesmo arquivo.
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  title="Anexar arquivos"
                  aria-label="Anexar arquivos"
                  className="size-8"
                >
                  <PaperclipIcon className="size-4" />
                </Button>
              </>
            )}

            {disableRag ? null : (
              <label
                className={cn(
                  'text-muted-foreground hover:text-foreground ml-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors select-none',
                  useRAG && 'text-foreground',
                )}
                title="Usar conteúdo dos seus documentos como contexto"
              >
                <BookOpenIcon className="size-3.5" />
                <span>Usar meus documentos</span>
                <Switch
                  checked={useRAG}
                  onCheckedChange={toggleRag}
                  aria-label="Usar meus documentos"
                />
              </label>
            )}

            {disableTools ? null : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2 text-xs',
                      enabledTools.length > 0 && 'text-foreground',
                    )}
                    aria-label="Ferramentas"
                  >
                    <WrenchIcon className="size-3.5" />
                    Ferramentas
                    {enabledTools.length > 0 ? (
                      <span className="bg-primary text-primary-foreground ml-0.5 rounded-full px-1.5 text-[10px] leading-4 tabular-nums">
                        {enabledTools.length}
                      </span>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>Ferramentas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {TOOL_OPTIONS.map(({ name, label, Icon }) => (
                    <DropdownMenuCheckboxItem
                      key={name}
                      checked={enabledTools.includes(name)}
                      // Radix dispara onSelect ao clicar — preserva o menu
                      // aberto pra usuário marcar várias sem reabrir.
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) => toggleTool(name, checked)}
                    >
                      <Icon className="size-3.5" />
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex items-center gap-2">
            {value.length > CHAR_WARNING_THRESHOLD ? (
              <span
                className={cn(
                  'text-xs tabular-nums',
                  value.length > 8000 ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {value.length.toLocaleString('pt-BR')}
              </span>
            ) : null}

            {isStreaming ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={onStop}
                aria-label="Parar geração"
                className="size-8"
              >
                <SquareIcon className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={() => void handleSubmit()}
                disabled={!canSend}
                aria-label="Enviar mensagem"
                className="size-8"
              >
                <SendHorizontalIcon className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: ComposerAttachment;
  onRemove: () => void;
}) {
  const isImage = attachment.mimeType.startsWith('image/');
  const isError = attachment.status === 'error';

  return (
    <div
      className={cn(
        'bg-muted relative flex items-center gap-2 rounded-lg border py-1.5 pr-7 pl-1.5 text-xs',
        isError && 'border-destructive/40',
      )}
    >
      <div className="bg-background flex size-9 shrink-0 items-center justify-center overflow-hidden rounded">
        {attachment.status === 'uploading' ? (
          <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
        ) : isImage && attachment.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.url}
            alt=""
            className="size-9 object-cover"
          />
        ) : isImage ? (
          <ImageIcon className="text-muted-foreground size-4" />
        ) : (
          <FileIcon className="text-muted-foreground size-4" />
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        <span className="max-w-[180px] truncate font-medium" title={attachment.filename}>
          {attachment.filename}
        </span>
        <span
          className={cn(
            'tabular-nums',
            isError ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {isError
            ? (attachment.errorMessage ?? 'erro')
            : attachment.status === 'uploading'
              ? 'enviando…'
              : formatBytes(attachment.size)}
        </span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover ${attachment.filename}`}
        className="hover:bg-background absolute top-1 right-1 rounded p-0.5"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
