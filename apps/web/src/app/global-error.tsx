'use client';

import * as React from 'react';

// global-error.tsx substitui o RootLayout quando o próprio layout falha.
// Por isso ele DEVE renderizar <html> e <body> próprios. Não usamos os
// componentes do @repo/ui nem fonts customizadas aqui — quanto menos
// dependências, mais chance da tela aparecer.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: '#fafafa',
          color: '#0a0a0a',
          minHeight: '100vh',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
        }}
      >
        <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <div
            style={{
              fontSize: '0.75rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#b91c1c',
              fontWeight: 600,
            }}
          >
            Erro crítico
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginTop: '0.5rem',
              marginBottom: '0.75rem',
            }}
          >
            Algo deu muito errado
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#525252', lineHeight: 1.6 }}>
            Aconteceu um erro inesperado e a aplicação não conseguiu se recuperar.
            Tente recarregar a página — se o problema persistir, volte mais tarde.
          </p>
          {error.digest ? (
            <p
              style={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.75rem',
                color: '#737373',
                marginTop: '0.75rem',
              }}
            >
              ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.625rem 1.25rem',
              background: '#0a0a0a',
              color: '#fafafa',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
