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

const registerSchema = z.object({
  name: z.string().min(2, 'Informe seu nome.').max(80, 'Nome muito longo.'),
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
});

type RegisterValues = z.infer<typeof registerSchema>;

type Pending = 'email' | 'google' | null;

export default function RegisterPage() {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const errors = form.formState.errors;

  async function onSubmit(values: RegisterValues): Promise<void> {
    setPending('email');
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });
    if (error) {
      toast.error(translateAuthError(error.message, 'Não foi possível criar a conta.'));
      setPending(null);
      return;
    }
    toast.success('Conta criada! Bem-vindo(a).');
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
        <CardTitle className="text-xl">Criar conta</CardTitle>
        <CardDescription>Comece a usar em poucos segundos.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Seu nome"
              aria-invalid={Boolean(errors.name)}
              {...form.register('name')}
            />
            {errors.name ? (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            ) : null}
          </div>

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
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              {...form.register('password')}
            />
            {errors.password ? (
              <p className="text-destructive text-xs">{errors.password.message}</p>
            ) : (
              <p className="text-muted-foreground text-xs">Mínimo de 8 caracteres.</p>
            )}
          </div>

          <Button type="submit" disabled={pending !== null}>
            {pending === 'email' ? 'Criando...' : 'Criar conta'}
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
        <span className="text-muted-foreground">Já tem conta?</span>
        <Link href="/login" className="ml-1 font-medium hover:underline">
          Entrar
        </Link>
      </CardFooter>
    </Card>
  );
}
