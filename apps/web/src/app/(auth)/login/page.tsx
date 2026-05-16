'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from '@repo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Separator } from '@repo/ui/components/separator';

import { authClient } from '@/lib/auth-client';
import { translateAuthError } from '@/lib/auth-errors';

const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
});

type LoginValues = z.infer<typeof loginSchema>;

type Pending = 'email' | 'google' | null;

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const errors = form.formState.errors;

  async function onSubmit(values: LoginValues): Promise<void> {
    setPending('email');
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    if (error) {
      toast.error(translateAuthError(error.message, 'Não foi possível entrar.'));
      setPending(null);
      return;
    }
    toast.success('Bem-vindo de volta!');
    router.push('/chat');
  }

  async function onGoogle(): Promise<void> {
    setPending('google');
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/chat',
    });
    if (error) {
      toast.error(translateAuthError(error.message, 'Não foi possível continuar com Google.'));
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
        <CardDescription>Acesse sua conta para continuar.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              aria-invalid={Boolean(errors.email)}
              {...form.register('email')}
            />
            {errors.email ? (
              <p className="text-destructive text-xs">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...form.register('password')}
            />
            {errors.password ? (
              <p className="text-destructive text-xs">{errors.password.message}</p>
            ) : null}
          </div>

          <Button type="submit" disabled={pending !== null}>
            {pending === 'email' ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs uppercase">ou</span>
          <Separator className="flex-1" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onGoogle}
          disabled={pending !== null}
        >
          {pending === 'google' ? 'Redirecionando...' : 'Continuar com Google'}
        </Button>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span className="text-muted-foreground">Ainda não tem conta?</span>
        <Link href="/register" className="ml-1 font-medium hover:underline">
          Cadastre-se
        </Link>
      </CardFooter>
    </Card>
  );
}
