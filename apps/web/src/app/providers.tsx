'use client';

import * as React from 'react';
import { ThemeProvider, type ThemeProviderProps } from 'next-themes';

import { Toaster } from '@repo/ui/components/sonner';
import { TooltipProvider } from '@repo/ui/components/tooltip';

export type ProvidersProps = Omit<ThemeProviderProps, 'children'> & {
  children: React.ReactNode;
};

export function Providers({ children, ...themeProps }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...themeProps}
    >
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster richColors closeButton />
    </ThemeProvider>
  );
}
