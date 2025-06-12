
"use client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import type { ServiceConfig } from '@/types'; 
import { useTranslations } from 'next-intl';
import { Wrench, ShieldCheck, Search, KeyRound } from 'lucide-react';

const serviceConfigs: ServiceConfig[] = [
  { id: 'oil_change', icon: Wrench },
  { id: 'brake_services', icon: ShieldCheck },
  { id: 'engine_diagnostics', icon: Search },
  { id: 'used_cars', icon: KeyRound },
];

export function ServicesSection() {
  const t = useTranslations('ServicesSection');

  return (
    <section id="services" className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-primary">{t('title')}</h2>
          <p className="text-lg text-foreground/80 mt-2">
            {t('subtitle')}
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {serviceConfigs.map((serviceConfig: ServiceConfig) => {
            const IconComponent = serviceConfig.icon;
            const titleKey = `items.${serviceConfig.id}.title`;
            const descriptionKey = `items.${serviceConfig.id}.description`;
            
            const serviceTitle = t(titleKey as any);
            const serviceDescription = t(descriptionKey as any);

            return (
              <Card key={serviceConfig.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="items-center text-center">
                  {IconComponent && <IconComponent className="h-12 w-12 text-accent mb-3" />}
                  <CardTitle className="text-xl">{serviceTitle}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardDescription className="text-center">{serviceDescription}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
