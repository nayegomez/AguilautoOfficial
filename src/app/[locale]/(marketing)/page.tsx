import { HeroSection } from '@/components/landing/HeroSection';
import { ServicesSection } from '@/components/landing/ServicesSection';
import { Separator } from '@/components/ui/separator';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <Separator className="mb-8 md:mb-12" /> 
      <ServicesSection />
    </>
  );
}
