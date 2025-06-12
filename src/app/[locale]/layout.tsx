
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '../globals.css';
import { Toaster } from '@/components/ui/toaster';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

type Props = {
  children: ReactNode;
  params: { locale: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = params.locale;
  unstable_setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'RootLayout' });
  return {
    title: t('title'),
    description: t('description'),
    icons: {
      icon: '/icon.png',
      shortcut: '/icon.png',
      apple: '/icon.png',

    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const locale = params.locale;
  unstable_setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
