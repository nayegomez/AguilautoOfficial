
"use client"; 

import { useState, useEffect, type ReactNode } from 'react';
import { VehicleCard } from '@/components/client/VehicleCard';
import type { Vehicle } from '@/types';
import { Separator } from '@/components/ui/separator';
import { useTranslations } from 'next-intl'; 
import { auth, db } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const ensureVehicleTimestamp = (value: any): Timestamp => {
    if (value instanceof Timestamp) {
        return value;
    }
    if (value && typeof value.toDate === 'function') {
        return Timestamp.fromDate(value.toDate());
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            return Timestamp.fromDate(date);
        }
    }
    console.warn("Invalid or missing timestamp data for vehicle, using fallback:", value);
    return Timestamp.fromDate(new Date(0));
};


export default function DashboardPage() {
  const t = useTranslations('ClientDashboardPage');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userVehicles, setUserVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (user) {
        setVehiclesLoading(true);
        try {
          const vehiclesQuery = query(collection(db, "vehicles"), where("ownerId", "==", user.uid));
          const vehiclesSnapshot = await getDocs(vehiclesQuery);
          const fetchedVehicles = vehiclesSnapshot.docs.map(docSnapshot => {
            const vehicleDocData = docSnapshot.data();
            return {
              id: docSnapshot.id,
              ...vehicleDocData,
              createdAt: ensureVehicleTimestamp(vehicleDocData.createdAt),
              updatedAt: ensureVehicleTimestamp(vehicleDocData.updatedAt),
              lastServiceDate: vehicleDocData.lastServiceDate,
            } as Vehicle;
          });
          setUserVehicles(fetchedVehicles.sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
        } catch (error) {
          console.error("Error fetching user vehicles:", error);
          setUserVehicles([]); 
        } finally {
          setVehiclesLoading(false);
        }
      } else {
        setUserVehicles([]);
        setVehiclesLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);


  let content: ReactNode;

  if (authLoading) {
    content = (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">{t('loadingAuth')}</p>
      </div>
    );
  } else if (!currentUser) {
    content = (
      <div className="text-center py-12">
        <p className="text-xl text-muted-foreground">{t('notLoggedIn')}</p>
        <Button asChild className="mt-4">
          <Link href="/login">{t('goToLogin')}</Link>
        </Button>
      </div>
    );
  } else {
    content = (
      <>
        {currentUser && (
          <div className="mb-4 p-4 bg-accent/10 border border-accent/30 rounded-lg text-center">
            <p className="text-sm text-accent-foreground">
              {t('loggedInAs', { email: currentUser.email })}
            </p>
          </div>
        )}
        {vehiclesLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">{t('VehiclesSection.loading', {ns: 'ClientProfilePage'})}</p> 
          </div>
        ) :userVehicles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {userVehicles.map((vehicle: Vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-xl text-muted-foreground">{t('noVehicles')}</p>
            <p className="mt-2">{t('noVehiclesContact')}</p>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('description')}
        </p>
      </div>
      <Separator />
      {content}
    </div>
  );
}
