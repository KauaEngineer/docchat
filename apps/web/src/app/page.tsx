import { Button } from '@repo/ui/components/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Chatbot Portfolio</h1>
      <p className="text-muted-foreground max-w-prose text-center">
        Validação do Shadcn/UI + Tailwind v4 + dark mode (next-themes) + Geist sans/mono.
      </p>
      <div className="flex gap-3">
        <Button>Botão padrão</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
      <p className="text-muted-foreground font-mono text-xs">
        font-mono renderiza Geist Mono · font-sans renderiza Geist Sans
      </p>
    </main>
  );
}
