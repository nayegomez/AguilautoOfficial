import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      {/* Aseguramos que main sea un contenedor flex columnar que pueda crecer */}
      <main className="flex flex-col flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}
