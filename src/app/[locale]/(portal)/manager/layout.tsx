
import { ManagerHeader } from '@/components/layout/ManagerHeader';

export default function ManagerAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ManagerHeader />
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
    </>
  );
}
