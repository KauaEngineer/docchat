'use client';

import * as React from 'react';
import { BotIcon, CheckIcon, CopyIcon } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { UIMessage } from 'ai';

import { Button } from '@repo/ui/components/button';

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';
  const text = extractText(message);

  if (isUser) {
    return (
      <div className="flex w-full justify-end py-2">
        <div className="bg-muted text-foreground max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap break-words">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex w-full gap-3 py-2">
      <div className="bg-primary text-primary-foreground mt-1 flex size-7 shrink-0 items-center justify-center rounded-full">
        <BotIcon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            return <Markdown key={i} content={part.text} />;
          }
          // tool-*, file, reasoning, etc. — Fases 8/9.
          return null;
        })}

        {text.length > 0 ? (
          <div className="mt-1 flex opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton text={text} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function extractText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n\n');
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

