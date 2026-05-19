'use client';

import * as React from 'react';
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  XIcon,
} from 'lucide-react';
import hljs from 'highlight.js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { cn } from '@repo/ui/lib/utils';

import {
  getArtifactVersionsAction,
  type ArtifactVersionDTO,
} from '@/lib/actions/artifacts';
import { useArtifactStore } from '@/lib/stores/artifact-store';

type TabKey = 'preview' | 'code';

// Tabs disponíveis por kind: CODE só tem o código bruto (não há "preview");
// os demais sempre têm os dois.
function tabsForKind(kind: ArtifactVersionDTO['kind']): TabKey[] {
  if (kind === 'CODE') return ['code'];
  return ['preview', 'code'];
}

const TAB_LABELS: Record<TabKey, string> = {
  preview: 'Visualizar',
  code: 'Código',
};

export function ArtifactPanel() {
  const openArtifact = useArtifactStore((s) => s.openArtifact);
  const close = useArtifactStore((s) => s.close);

  if (!openArtifact) return null;
  return (
    <ArtifactPanelInner
      // key forçando remount ao trocar de artefato — reseta tabs/versão/fetch.
      key={`${openArtifact.conversationId}:${openArtifact.title}`}
      conversationId={openArtifact.conversationId}
      title={openArtifact.title}
      onClose={close}
    />
  );
}

// -----------------------------------------------------------------------------
// Inner: assume sempre estar montado com um artefato em aberto.
// -----------------------------------------------------------------------------

function ArtifactPanelInner({
  conversationId,
  title,
  onClose,
}: {
  conversationId: string;
  title: string;
  onClose: () => void;
}) {
  const [versions, setVersions] = React.useState<ArtifactVersionDTO[] | null>(null);
  const [selectedVersion, setSelectedVersion] = React.useState<number | null>(null);
  const [activeTab, setActiveTab] = React.useState<TabKey>('preview');
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Fetch + atualização. Releva re-streams: enquanto o usuário está vendo
  // uma versão, se o modelo gerar outra (live), o painel reflete ao abrir
  // de novo. Não fazemos polling — o painel é um drilldown, não um realtime.
  React.useEffect(() => {
    let cancelled = false;
    setVersions(null);
    setLoadError(null);
    getArtifactVersionsAction(conversationId, title)
      .then((data) => {
        if (cancelled) return;
        setVersions(data);
        const latest = data.length > 0 ? data[data.length - 1]!.version : null;
        setSelectedVersion(latest);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Falha ao carregar.');
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, title]);

  // ESC fecha; ouvinte em window pra capturar mesmo quando o foco ainda não
  // saltou pro painel (transição de abertura).
  React.useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Foco inicial + restauração ao fechar. O Button do @repo/ui ainda não
  // encaminha ref, então localizamos o botão de fechar via data attribute.
  React.useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current
      ?.querySelector<HTMLButtonElement>('[data-artifact-close]')
      ?.focus();
    return () => {
      // Devolve o foco pra de onde o usuário veio (o card no chat).
      previouslyFocused?.focus?.();
    };
  }, []);

  // Focus trap: keydown TAB no painel cicla entre o primeiro e último
  // focusable. Sem isso, Tab "vaza" pro chat por baixo e o usuário se perde.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      // Considera só elementos visíveis e habilitados — descarta hidden inputs etc.
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      // Quando o foco está FORA do painel (caso raro: shortcut deu foco em
      // algo na sidebar), sequestra pro primeiro elemento.
      if (!active || !root.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const current =
    versions?.find((v) => v.version === selectedVersion) ?? null;
  // Memo evita que availableTabs vire um array novo a cada render — o
  // useEffect abaixo depende dele e dispararia em loop infinito do contrário.
  const availableTabs = React.useMemo(
    () => (current ? tabsForKind(current.kind) : []),
    [current],
  );

  // Se a tab ativa não pertence ao kind atual (ex.: usuário trocou de versão
  // / artifact), normaliza pro primeiro disponível.
  React.useEffect(() => {
    if (!current) return;
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]!);
    }
  }, [current, availableTabs, activeTab]);

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Artefato: ${title}`}
      className="bg-background flex h-full min-h-0 flex-col border-l"
    >
      <PanelHeader
        title={title}
        current={current}
        versions={versions}
        selectedVersion={selectedVersion}
        onSelectVersion={setSelectedVersion}
        onClose={onClose}
      />

      {availableTabs.length > 1 ? (
        <TabBar
          tabs={availableTabs}
          active={activeTab}
          onChange={setActiveTab}
        />
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {loadError ? (
          <div className="text-destructive p-6 text-sm">{loadError}</div>
        ) : !versions ? (
          <div className="text-muted-foreground p-6 text-sm">Carregando…</div>
        ) : versions.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">
            Nenhuma versão encontrada para este artefato.
          </div>
        ) : current ? (
          <ArtifactBody artifact={current} tab={activeTab} />
        ) : null}
      </div>
    </aside>
  );
}

// -----------------------------------------------------------------------------
// Header
// -----------------------------------------------------------------------------

function PanelHeader({
  title,
  current,
  versions,
  selectedVersion,
  onSelectVersion,
  onClose,
}: {
  title: string;
  current: ArtifactVersionDTO | null;
  versions: ArtifactVersionDTO[] | null;
  selectedVersion: number | null;
  onSelectVersion: (v: number) => void;
  onClose: () => void;
}) {
  const hasMany = (versions?.length ?? 0) > 1;

  return (
    <div className="flex items-center gap-2 border-b px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold" title={title}>
          {title}
        </div>
        {current ? (
          <div className="text-muted-foreground text-xs">
            {current.kind}
            {current.language ? ` · ${current.language}` : ''}
            {' · '}v{current.version}
          </div>
        ) : null}
      </div>

      {hasMany && versions && selectedVersion !== null ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              v{selectedVersion}
              <ChevronDownIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-32">
            {[...versions]
              .sort((a, b) => b.version - a.version)
              .map((v) => (
                <DropdownMenuItem
                  key={v.id}
                  onSelect={() => onSelectVersion(v.version)}
                >
                  v{v.version}
                  {v.version === selectedVersion ? (
                    <CheckIcon className="size-3.5" />
                  ) : null}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <CopyButton content={current?.content ?? ''} />
      <DownloadButton artifact={current} />

      <Button
        data-artifact-close
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Fechar painel"
        className="size-7"
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = React.useState(false);
  async function handle(): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handle}
      disabled={content.length === 0}
      aria-label="Copiar conteúdo"
      className="size-7"
    >
      {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
    </Button>
  );
}

function DownloadButton({ artifact }: { artifact: ArtifactVersionDTO | null }) {
  function handle(): void {
    if (!artifact) return;
    const blob = new Blob([artifact.content], {
      type: mimeForKind(artifact.kind),
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filenameFor(artifact);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handle}
      disabled={!artifact}
      aria-label="Baixar"
      className="size-7"
    >
      <DownloadIcon className="size-4" />
    </Button>
  );
}

// -----------------------------------------------------------------------------
// Tab bar (simples — sem dep nova de Radix Tabs)
// -----------------------------------------------------------------------------

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: TabKey[];
  active: TabKey;
  onChange: (t: TabKey) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b px-3 pt-2">
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={active === t}
          onClick={() => onChange(t)}
          className={cn(
            'rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors',
            active === t
              ? 'border-foreground/40 bg-muted/60 text-foreground border-b-2'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {TAB_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Body — render por kind/tab
// -----------------------------------------------------------------------------

function ArtifactBody({
  artifact,
  tab,
}: {
  artifact: ArtifactVersionDTO;
  tab: TabKey;
}) {
  if (artifact.kind === 'CODE') {
    return <CodeView code={artifact.content} language={artifact.language} />;
  }

  if (artifact.kind === 'MARKDOWN') {
    return tab === 'preview' ? (
      <MarkdownView content={artifact.content} />
    ) : (
      <CodeView code={artifact.content} language="markdown" />
    );
  }

  if (artifact.kind === 'HTML') {
    return tab === 'preview' ? (
      <HtmlView html={artifact.content} title={artifact.title} />
    ) : (
      <CodeView code={artifact.content} language="html" />
    );
  }

  // SVG
  return tab === 'preview' ? (
    <SvgView svg={artifact.content} />
  ) : (
    <CodeView code={artifact.content} language="xml" />
  );
}

function CodeView({ code, language }: { code: string; language: string | null }) {
  const highlighted = React.useMemo(() => {
    if (!language) {
      // auto-detect — dá conta de C-like, py, etc.; preço de uns ms a mais.
      return hljs.highlightAuto(code).value;
    }
    // hljs aceita aliases (ts/typescript, py/python); se a linguagem for
    // desconhecida, retornamos o texto cru pra não estourar.
    if (!hljs.getLanguage(language)) {
      return escapeHtml(code);
    }
    return hljs.highlight(code, { language }).value;
  }, [code, language]);

  return (
    <pre className="m-0 overflow-auto p-4 text-xs leading-relaxed">
      <code
        className="hljs font-mono"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </pre>
  );
}

function MarkdownView({ content }: { content: string }) {
  // Reaproveita os mesmos plugins do chat: GFM + highlight pra blocos.
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none p-6">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function HtmlView({ html, title }: { html: string; title: string }) {
  // sandbox="allow-scripts" sem allow-same-origin: scripts rodam mas não
  // acessam o cookie/localStorage da app. Sem `allow-forms` pra evitar phishing.
  return (
    <iframe
      title={title}
      sandbox="allow-scripts"
      srcDoc={html}
      className="bg-background h-full w-full"
    />
  );
}

function SvgView({ svg }: { svg: string }) {
  // SVG-as-HTML é considerado XSS-vector se o conteúdo vier de input
  // não-confiável (pode embutir <script>). Aqui o conteúdo veio do próprio
  // LLM do usuário — risk surface limitado, mas mantemos a observação.
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div
        className="max-h-full max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function mimeForKind(kind: ArtifactVersionDTO['kind']): string {
  switch (kind) {
    case 'HTML':
      return 'text/html';
    case 'SVG':
      return 'image/svg+xml';
    case 'MARKDOWN':
      return 'text/markdown';
    case 'CODE':
      return 'text/plain';
  }
}

function filenameFor(a: ArtifactVersionDTO): string {
  const safe = a.title.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'artifact';
  const ext = extensionFor(a);
  return `${safe}-v${a.version}.${ext}`;
}

function extensionFor(a: ArtifactVersionDTO): string {
  if (a.kind === 'HTML') return 'html';
  if (a.kind === 'SVG') return 'svg';
  if (a.kind === 'MARKDOWN') return 'md';
  // CODE — usa o language como extensão quando reconhecível, senão `.txt`.
  const lang = (a.language ?? '').toLowerCase();
  const map: Record<string, string> = {
    typescript: 'ts',
    javascript: 'js',
    python: 'py',
    rust: 'rs',
    go: 'go',
    java: 'java',
    csharp: 'cs',
    c: 'c',
    cpp: 'cpp',
    ruby: 'rb',
    php: 'php',
    swift: 'swift',
    kotlin: 'kt',
    shell: 'sh',
    bash: 'sh',
    sql: 'sql',
    yaml: 'yaml',
    json: 'json',
  };
  return map[lang] ?? 'txt';
}
