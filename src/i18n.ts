import {getRequestConfig} from 'next-intl/server';
import {notFound} from 'next/navigation';

export const locales = ['en', 'es'] as const;
export const defaultLocale = 'es';

export default getRequestConfig(async ({locale}) => {
  if (!locales.includes(locale as (typeof locales)[number])) notFound();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});