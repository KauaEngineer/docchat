'use client';

import * as React from 'react';
import {
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  FileIcon,
  FileTextIcon,
  PencilIcon,
  RefreshCwIcon,
  XIcon,
} from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { Message, ToolInvocation } from 'ai';

import { Button } from '@repo/ui/components/button';

import { ToolInvocationCard } from './tool-invocation';

export interface MessageBubbleProps {
  message: Message;
  isLastAssistant?: boolean;
  onRegenerate?: () => void;
  onEdit?: (messageId: string, newContent: string) => void;
}

export function MessageBubble({
  message,
  isLastAssistant = false,
  onRegenerate,
  onEdit,
}: MessageBubbleProps) {
  if (message.role === 'user') {
    return <UserBubble message={message} onEdit={onEdit} />;
  }
  return (
    <AssistantBubble
      message={message}
      isLastAssistant={isLastAssistant}
      onRegenerate={onRegenerate}
    />
  );
}

// -----------------------------------------------------------------------------
// User bubble — bolha azul à direita, com modo de edição inline.
// -----------------------------------------------------------------------------

function UserBubble({
  message,
  onEdit,
}: {
  message: Message;
  onEdit?: (messageId: string, newContent: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);

  if (editing && onEdit) {
    return (
      <EditForm
        initialValue={message.content}
        onCancel={() => setEditing(false)}
        onSave={(next) => {
          setEditing(false);
          onEdit(message.id, next);
        }}
      />
    );
  }

  const attachments = message.experimental_attachments ?? [];

  return (
    <div className="group flex w-full flex-col items-end py-2">
      {attachments.length > 0 ? (
        <div className="mb-1.5 flex max-w-[85%] flex-wrap justify-end gap-1.5">
          {attachments.map((att, i) => (
            <AttachmentPreview key={i} attachment={att} />
          ))}
        </div>
      ) : null}

      {message.content.length > 0 ? (
        <div className="bg-muted text-foreground max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
      ) : null}

      {onEdit ? (
        <div className="mt-1 flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            aria-label="Editar mensagem"
            className="text-muted-foreground h-7 gap-1.5 px-2 text-xs"
          >
            <PencilIcon className="size-3.5" />
            Editar
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// Thumbnail pra imagem, chip de filename/ícone pros demais. Linka pro URL
// (signed ou domínio público) para o usuário inspecionar o original.
function AttachmentPreview({
  attachment,
}: {
  attachment: { name?: string; contentType?: string; url: string };
}) {
  const isImage = (attachment.contentType ?? '').startsWith('image/');
  const filename = attachment.name ?? 'arquivo';

  if (isImage) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer noopener"
        className="block overflow-hidden rounded-lg border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={filename}
          className="max-h-48 max-w-[240px] object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer noopener"
      className="bg-muted hover:bg-muted/80 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition"
      title={filename}
    >
      <FileIcon className="text-muted-foreground size-4 shrink-0" />
      <span className="max-w-[180px] truncate">{filename}</span>
    </a>
  );
}

function EditForm({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(initialValue);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Foca + posiciona caret no fim ao abrir.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  // Auto-resize do textarea conforme o conteúdo (mesmo padrão do Composer).
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [value]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== initialValue.trim();

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
    // Cmd/Ctrl+Enter salva — atalho comum em editores inline.
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSave) {
      e.preventDefault();
      onSave(trimmed);
    }
  }

  return (
    <div className="flex w-full justify-end py-2">
      <div className="bg-muted/60 flex w-full max-w-[85%] flex-col gap-2 rounded-2xl border p-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Editar mensagem"
          className="max-h-[320px] min-h-[44px] w-full resize-none bg-transparent text-sm leading-6 outline-none"
        />
        <div className="flex justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            <XIcon className="size-3.5" />
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onSave(trimmed)}
            disabled={!canSave}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            <CheckIcon className="size-3.5" />
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Assistant bubble — markdown + ações (copiar, regenerar).
// -----------------------------------------------------------------------------

function AssistantBubble({
  message,
  isLastAssistant,
  onRegenerate,
}: {
  message: Message;
  isLastAssistant: boolean;
  onRegenerate?: () => void;
}) {
  const text = message.content;
  const ragSources = extractRagSources(message.annotations);
  // useChat hidrata `parts` automaticamente — texto, tool-invocations, etc.
  // Pra mensagens carregadas do banco (initialMessages com só `content`),
  // o SDK preenche parts com um único TextUIPart, então não há regressão.
  const renderables = buildAssistantRenderables(message);
  const showActions = text.length > 0;

  return (
    <div className="group flex w-full gap-3 py-2">
      <div className="bg-primary text-primary-foreground mt-1 flex size-7 shrink-0 items-center justify-center rounded-full">
        <BotIcon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        {renderables.map((item, i) => {
          if (item.kind === 'text') {
            return <Markdown key={`t-${i}`} content={item.text} />;
          }
          return (
            <ToolInvocationCard
              key={`tool-${item.invocation.toolCallId}`}
              invocation={item.invocation}
            />
          );
        })}

        {ragSources.length > 0 ? <RagSourcesPanel sources={ragSources} /> : null}

        {showActions ? (
          <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <CopyButton text={text} />
            {isLastAssistant && onRegenerate ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRegenerate}
                aria-label="Regenerar resposta"
                className="text-muted-foreground h-7 gap-1.5 px-2 text-xs"
              >
                <RefreshCwIcon className="size-3.5" />
                Regenerar
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type AssistantRenderable =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; invocation: ToolInvocation };

function buildAssistantRenderables(message: Message): AssistantRenderable[] {
  const parts = message.parts;
  if (Array.isArray(parts) && parts.length > 0) {
    const out: AssistantRenderable[] = [];
    for (const p of parts) {
      if (p.type === 'text' && p.text.length > 0) {
        out.push({ kind: 'text', text: p.text });
      } else if (p.type === 'tool-invocation') {
        out.push({ kind: 'tool', invocation: p.toolInvocation });
      }
      // Outros tipos (reasoning, source, file, step-start) são ignorados
      // — o portfólio não exibe nada além de texto e tool calls.
    }
    if (out.length > 0) return out;
  }
  // Fallback: mensagens muito antigas (sem parts) ou content fora do stream.
  return message.content.length > 0
    ? [{ kind: 'text', text: message.content }]
    : [];
}

// -----------------------------------------------------------------------------
// RAG sources — collapsible com chunks recuperados.
// -----------------------------------------------------------------------------

interface RagSource {
  documentId: string;
  filename: string;
  similarity: number;
  content: string;
}

function extractRagSources(annotations: Message['annotations']): RagSource[] {
  if (!Array.isArray(annotations)) return [];
  // Iteramos: o streamData pode ter empilhado outras annotations no futuro;
  // ficamos só com a do tipo 'rag-context'.
  for (const a of annotations) {
    if (
      a !== null &&
      typeof a === 'object' &&
      !Array.isArray(a) &&
      (a as { type?: unknown }).type === 'rag-context' &&
      Array.isArray((a as { sources?: unknown }).sources)
    ) {
      const raw = (a as { sources: unknown[] }).sources;
      return raw.filter(
        (s): s is RagSource =>
          s !== null &&
          typeof s === 'object' &&
          typeof (s as RagSource).filename === 'string' &&
          typeof (s as RagSource).content === 'string',
      );
    }
  }
  return [];
}

function RagSourcesPanel({ sources }: { sources: RagSource[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="mt-3 rounded-lg border bg-muted/30 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="hover:bg-muted/60 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-medium">
          <FileTextIcon className="size-3.5" />
          Fontes ({sources.length})
        </span>
        <ChevronDownIcon
          className={`text-muted-foreground size-4 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open ? (
        <div className="border-t px-3 py-2">
          <ul className="flex flex-col gap-2">
            {sources.map((s, i) => (
              <li
                key={`${s.documentId}-${i}`}
                className="bg-background rounded-md border p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                    <FileTextIcon className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="truncate" title={s.filename}>
                      {s.filename}
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                    {(s.similarity * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-muted-foreground mt-1.5 line-clamp-4 text-xs leading-relaxed whitespace-pre-wrap">
                  {s.content}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Markdown — rehype-highlight aplica classes do highlight.js nos <code>; o tema
// vem do CSS importado em globals.css. As classes Tailwind abaixo cuidam só
// do espaçamento/tipografia ao redor.
// -----------------------------------------------------------------------------

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-3 leading-7 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-6 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-6 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-xl font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 text-lg font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-2 text-base font-semibold first:mt-0">{children}</h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-border text-muted-foreground my-3 border-l-2 pl-4 italic">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...rest }) => {
    const isBlock = typeof className === 'string' && className.includes('language-');
    if (isBlock) {
      // Bloco — pai já é <pre>, então só aplicar a classe de linguagem aqui.
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.85em]"
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-muted my-3 overflow-x-auto rounded-lg p-3 text-sm">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="border-border w-full border-collapse border text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-border bg-muted border px-3 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-border border px-3 py-1.5">{children}</td>
  ),
};

function Markdown({ content }: { content: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={MARKDOWN_COMPONENTS}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard pode estar indisponível (contexto não-seguro); silencioso.
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      aria-label="Copiar mensagem"
      className="text-muted-foreground h-7 gap-1.5 px-2 text-xs"
    >
      {copied ? (
        <>
          <CheckIcon className="size-3.5" />
          Copiado
        </>
      ) : (
        <>
          <CopyIcon className="size-3.5" />
          Copiar
        </>
      )}
    </Button>
  );
}
