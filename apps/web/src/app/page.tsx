import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  BoxesIcon,
  BrainCircuitIcon,
  GithubIcon,
  MessageSquareIcon,
  SparklesIcon,
} from 'lucide-react';

import { Button } from '@repo/ui/components/button';

import { auth } from '@/lib/auth';

const GITHUB_URL = 'https://github.com/KauaEngineer/docchat';

export default async function HomePage() {
  // Usuário logado pula direto pro app — landing é para visitantes anônimos.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect('/chat');

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <Hero />
        <Features />
        <DemoStrip />
      </main>

      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
            <SparklesIcon className="size-4" />
          </div>
          <span className="text-sm font-semibold">DocChat</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">Criar conta</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <span className="bg-muted text-muted-foreground mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <SparklesIcon className="size-3.5" />
          Multi-LLM · RAG · Artefatos
        </span>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Seu chatbot pessoal, com seus documentos.
        </h1>
        <p className="text-muted-foreground mt-6 max-w-2xl text-balance text-base sm:text-lg">
          Converse com vários modelos de IA em uma interface só. Conecte PDFs e arquivos
          para respostas embasadas no seu conteúdo, e gere artefatos prontos em código,
          markdown ou texto.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/register">Começar agora</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Já tenho conta</Link>
          </Button>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Sem cartão de crédito. Use seus próprios provedores.
        </p>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
        <div className="grid gap-6 sm:grid-cols-3">
          <FeatureCard
            icon={<BrainCircuitIcon className="size-5" />}
            title="Multi-LLM"
            description="Alterne entre Gemini, Claude e outros provedores na hora. Cada conversa lembra o modelo escolhido."
          />
          <FeatureCard
            icon={<BoxesIcon className="size-5" />}
            title="Documentos com RAG"
            description="Suba PDFs, markdown ou texto. O chatbot busca trechos relevantes via embeddings e cita as fontes."
          />
          <FeatureCard
            icon={<MessageSquareIcon className="size-5" />}
            title="Artefatos visuais"
            description="Código, documentos e diagramas geram artefatos versionados no painel lateral. Edite e reaproveite."
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-lg border p-6">
      <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-md">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function DemoStrip() {
  return (
    <section className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
        <div className="mb-8 flex flex-col items-center text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Uma interface, várias capacidades
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm">
            Mensagens em streaming, anexos, tool use, painel de artefatos lado a lado.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DemoShot src="/screenshots/chat.png" label="Interface do chat" />
          <DemoShot src="/screenshots/documentos.png" label="Documentos com RAG" />
        </div>
      </div>
    </section>
  );
}

function DemoShot({ src, label }: { src: string; label: string }) {
  return (
    <figure className="bg-card overflow-hidden rounded-lg border">
      <Image
        src={src}
        alt={label}
        width={1920}
        height={940}
        className="h-auto w-full"
      />
      <figcaption className="text-muted-foreground border-t px-3 py-2 text-center text-xs">
        {label}
      </figcaption>
    </figure>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
        <p className="text-muted-foreground text-xs">
          © {new Date().getFullYear()} DocChat — Projeto pessoal.
        </p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-xs transition-colors"
        >
          <GithubIcon className="size-4" />
          Código no GitHub
        </a>
      </div>
    </footer>
  );
}
