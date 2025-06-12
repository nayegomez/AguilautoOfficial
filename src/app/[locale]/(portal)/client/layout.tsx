
import { ClientHeader } from '@/components/layout/ClientHeader';

export default function ClientAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ClientHeader />
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
    </>
  );
}
