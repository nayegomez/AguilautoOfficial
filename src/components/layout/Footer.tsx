
"use client";
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('Footer');
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted text-muted-foreground py-8 mt-auto">
      <div className="container mx-auto px-4 text-center">
        <p>{t('copyright', { year: currentYear })}</p>
        <p className="text-sm mt-1">{t('tagline')}</p>
      </div>
    </footer>
  );
}
