/**
 * Mapeia mensagens cruas do Better Auth para PT-BR amigáveis.
 * Better Auth ainda muda mensagens entre releases, então fazemos match
 * por substring case-insensitive — sempre com fallback seguro.
 */
export function translateAuthError(message: string | undefined, fallback?: string): string {
  const fb = fallback ?? 'Algo deu errado. Tente novamente.';
  if (!message) return fb;
  const m = message.toLowerCase();

  if (
    m.includes('already exists') ||
    m.includes('email exists') ||
    m.includes('duplicate') ||
    m.includes('user with this email')
  ) {
    return 'Já existe uma conta com este e-mail.';
  }

  if (
    m.includes('invalid credentials') ||
    m.includes('invalid password') ||
    m.includes('invalid email or password') ||
    m.includes('user not found')
  ) {
    return 'E-mail ou senha incorretos.';
  }

  if (m.includes('invalid email')) {
    return 'Informe um e-mail válido.';
  }

  if (m.includes('password') && (m.includes('weak') || m.includes('too short'))) {
    return 'Senha muito fraca. Use ao menos 8 caracteres.';
  }

  if (m.includes('email not verified') || m.includes('verify your email')) {
    return 'Confirme seu e-mail antes de entrar.';
  }

  if (m.includes('too many') || m.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos.';
  }

  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Falha de conexão. Verifique sua internet.';
  }

  return fb;
}
