
import { Footer } from '@/components/layout/Footer';

export default function BasePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-secondary">
      {children}
      <Footer />
    </div>
  );
}
