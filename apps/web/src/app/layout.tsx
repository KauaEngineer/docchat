import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

import { Providers } from './providers';
import './globals.css';

const APP_NAME = 'Chatbot Portfolio';
const APP_DESCRIPTION =
  'Chatbot multi-LLM com RAG sobre seus documentos e artefatos visuais. Construído com Next.js 15, React 19 e Vercel AI SDK.';

// metadataBase resolve URLs relativas de OG/twitter no build. Lê de envs
// padrão da Vercel; fallback localhost só pra dev não quebrar.
const SITE_URL: URL = (() => {
  const explicit = process.env['NEXT_PUBLIC_SITE_URL'];
  if (explicit) return new URL(explicit);
  const vercel = process.env['VERCEL_PROJECT_PRODUCTION_URL'] ?? process.env['VERCEL_URL'];
  if (vercel) return new URL(`https://${vercel}`);
  return new URL('http://localhost:3000');
})();

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: [
    'chatbot',
    'IA',
    'LLM',
    'RAG',
    'Next.js',
    'Vercel AI SDK',
    'portfolio',
  ],
  authors: [{ name: 'Kauã' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: '/',
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} bg-background text-foreground min-h-screen font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
