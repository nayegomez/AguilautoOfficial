
"use client";
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

export function HeroSection() {
  const t = useTranslations('HeroSection');

  return (
    <section className="flex flex-col flex-grow justify-center py-16 md:py-24 bg-secondary">
      <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary">
            {t('title')}
          </h1>
          <p className="text-lg md:text-xl text-foreground/80">
            {t('subtitle')}
          </p>
          <div className="flex gap-4 justify-center md:justify-start">
            <Button size="lg" asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="#services">{t('ourServicesButton')}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">{t('clientPortalButton')}</Link>
            </Button>
          </div>
        </div>
        <div>
          <Card className="overflow-hidden shadow-xl">
            <CardContent className="p-0">
              <Image
                src="/taller-hero.jpeg"
                alt={t('backgroundImageAlt')}
                width={600}
                height={400}
                className="w-full h-auto object-cover"
                priority
                data-ai-hint="mechanic car"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
