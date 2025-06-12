
import Image from 'next/image';
import Link from 'next/link';
import type { Vehicle } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Tag } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import { useTranslations } from 'next-intl';

interface VehicleCardProps {
  vehicle: Vehicle;
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const t = useTranslations('VehicleCard');

  const formatLastServiceDate = () => {
    if (!vehicle.lastServiceDate) {
      return 'N/A';
    }
    if (typeof vehicle.lastServiceDate === 'string') {
      try {
        return vehicle.lastServiceDate;
      } catch (e) {
        return vehicle.lastServiceDate;
      }
    }
    if (vehicle.lastServiceDate && typeof (vehicle.lastServiceDate as Timestamp).toDate === 'function') {
      const date = (vehicle.lastServiceDate as Timestamp).toDate();
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return 'Invalid Date';
  };


  return (
    <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="p-0 relative">
        <Image
          src={vehicle.imageUrl || "https://placehold.co/300x200.png"}
          alt={`${vehicle.make} ${vehicle.model}`}
          width={300}
          height={200}
          className="w-full h-48 object-cover"
          unoptimized
        />
      </CardHeader>
      <CardContent className="p-6 flex-grow">
        <CardTitle className="text-2xl font-semibold text-primary">{vehicle.make} {vehicle.model}</CardTitle>
        <CardDescription className="text-lg text-foreground/80">{vehicle.year}</CardDescription>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Tag className="h-4 w-4 text-accent" />
            <span>{t('license')}: {vehicle.licensePlate}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-accent" />
            <span>{t('lastService')}: {formatLastServiceDate()}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-6 bg-muted/50">
        <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href={`/client/vehicle/${vehicle.id}`}>{t('viewDetails')}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

    