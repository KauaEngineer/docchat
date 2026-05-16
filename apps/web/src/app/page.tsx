import { Button } from '@repo/ui/components/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Chatbot Portfolio</h1>
      <p className="max-w-prose text-center text-[var(--muted-foreground)]">
        Monorepo Turborepo com Next.js 15, React 19, Tailwind v4, Prisma, Better Auth e Vercel AI
        SDK.
      </p>
      <div className="flex gap-3">
        <Button>Começar conversa</Button>
        <Button variant="outline">Ver projetos</Button>
      </div>
    </main>
  );
}
