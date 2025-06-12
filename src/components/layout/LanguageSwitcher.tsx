
"use client";

import { useLocale, useTranslations } from 'next-intl';
import { useRouter as useNextRouter, usePathname as useNextPathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { locales, defaultLocale } from '@/i18n';

export function LanguageSwitcher() {
  const t = useTranslations('LanguageSwitcher');
  const currentLocale = useLocale();
  const nextPathname = useNextPathname();
  const router = useNextRouter();

  let basePathname = nextPathname;
  if (basePathname.startsWith(`/${currentLocale}`)) {
    basePathname = basePathname.substring(`/${currentLocale}`.length);
    if (basePathname === "") {
      basePathname = "/";
    }
  }


  const getDisplayName = (langCode: string) => {
    switch(langCode) {
      case 'en': return t('english');
      case 'es': return t('spanish');
      default: return langCode;
    }
  }

  const handleLocaleChange = (newLocale: string) => {
    let newPath = `/${newLocale}${basePathname}`;
    if (basePathname === "/" && newPath.endsWith("//")) {
        newPath = `/${newLocale}`;
    } else if (basePathname !== "/" && newPath.endsWith("//")) {
        newPath = newPath.slice(0, -1);
    }
    if (newPath.startsWith(`/${newLocale}/`)) {
    } else if (newPath === `/${newLocale}`) {
    } else {
        newPath = `/${newLocale}${basePathname === '/' ? '' : basePathname}`;
    }


    router.replace(newPath);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t('changeLanguageAriaLabel')}>
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            disabled={currentLocale === loc}
            className="cursor-pointer"
            aria-current={currentLocale === loc ? 'page' : undefined}
            onSelect={() => handleLocaleChange(loc)}
          >
            {getDisplayName(loc)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

