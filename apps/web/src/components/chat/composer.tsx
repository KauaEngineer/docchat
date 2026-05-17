'use client';

import * as React from 'react';
import { PaperclipIcon, SendHorizontalIcon, SquareIcon } from 'lucide-react';

import { Button } from '@repo/ui/components/button';
import { cn } from '@repo/ui/lib/utils';

const MAX_HEIGHT_PX = 200;
const CHAR_WARNING_THRESHOLD = 4000;

export interface ComposerProps {
  onSubmit: (text: string) => void | Promise<void>;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function Composer({
  onSubmit,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = 'Envie uma mensagem...',
  autoFocus = false,
  className,
}: ComposerProps) {
  const [value, setValue] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

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
  const canSend = !disabled && !isStreaming && trimmed.length > 0;

  async function handleSubmit(): Promise<void> {
    if (!canSend) return;
    const toSend = trimmed;
    setValue('');
    await onSubmit(toSend);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    // Enter envia; Shift+Enter quebra linha; também respeita IME (composição).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="bg-background focus-within:border-ring focus-within:ring-ring/20 relative flex flex-col rounded-2xl border shadow-sm transition focus-within:ring-2">
        <textarea
          ref={textareaRef}
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled
            title="Anexar (em breve)"
            aria-label="Anexar arquivo"
            className="size-8"
          >
            <PaperclipIcon className="size-4" />
          </Button>

          <div className="flex items-center gap-2">
            {value.length > CHAR_WARNING_THRESHOLD ? (
              <span
                className={cn(
                  'text-xs tabular-nums',
                  value.length > 8000
                    ? 'text-destructive'
                    : 'text-muted-foreground',
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
