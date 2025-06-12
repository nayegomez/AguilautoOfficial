
"use client";
import Link from 'next/link';
import Image from 'next/image';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';

const LanguageSwitcher = dynamic(() => import('./LanguageSwitcher').then(mod => mod.LanguageSwitcher), { ssr: false });

export function Header() {
  const t = useTranslations('Header');

  return (
<header className="bg-card shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-primary hover:text-primary/90 transition-colors">
          <Image src="/icon.png" alt="Aguilauto Logo" width={28} height={28} unoptimized />
          <span>Aguilauto</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/">{t('home')}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{t('clientPortal')}</span>
              </Link>
          </Button>
          <LanguageSwitcher />
          {/* <Button variant="ghost" asChild>
            <Link href="/manager/login">{t('managerPortal')}</Link>
          </Button> */}
        </nav>
      </div>
    </header>
  );
}
