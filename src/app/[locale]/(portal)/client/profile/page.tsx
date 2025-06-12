
"use client";

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type { Client, Vehicle } from '@/types';
import { EditProfileForm } from '@/components/client/EditProfileForm';
import { VehicleCard } from '@/components/client/VehicleCard';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

const ensureClientDate = (value: any): Date => {
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  console.warn("Invalid or missing date data for client, using fallback:", value);
  return new Date(0);
};

const ensureVehicleTimestamp = (value: any): Timestamp => {
    if (value && value.seconds !== undefined && value.nanoseconds !== undefined) {
        if (typeof value.toDate === 'function') return value as Timestamp;
        return new Timestamp(value.seconds, value.nanoseconds);
    }
    if (value instanceof Date) {
        return Timestamp.fromDate(value);
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


export default function ClientProfilePage() {
  const t = useTranslations('ClientProfilePage');
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [clientData, setClientData] = useState<Client | null>(null);
  const [userVehicles, setUserVehicles] = useState<Vehicle[]>([]);
  const [loadingClient, setLoadingClient] = useState(true);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
        setLoadingClient(true);
        setLoadingVehicles(true);
        setError(null);

        try {
          const clientDocRef = doc(db, "clients", user.uid);
          const clientDocSnap = await getDoc(clientDocRef);
          if (clientDocSnap.exists()) {
            const data = clientDocSnap.data();
            setClientData({
              id: clientDocSnap.id,
              ...data,
              createdAt: ensureClientDate(data.createdAt),
              updatedAt: ensureClientDate(data.updatedAt),
            } as Client);
          } else {
            setError(t('errorNotFound'));
          }
        } catch (err) {
          console.error("Error fetching client data:", err);
          setError(t('errorFetching'));
        } finally {
          setLoadingClient(false);
        }

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
          setUserVehicles(fetchedVehicles);
        } catch (vehError) {
          console.error("Error fetching vehicles:", vehError);
          setError(prevError => prevError ? prevError + "; " + t('VehiclesSection.errorFetching') : t('VehiclesSection.errorFetching'));
        } finally {
          setLoadingVehicles(false);
        }

      } else {
        setCurrentUser(null);
        setClientData(null);
        setUserVehicles([]);
        setLoadingClient(false);
        setLoadingVehicles(false);
      }
    });
    return () => unsubscribe();
  }, [t]);

  const handleProfileUpdated = (updatedClient: Client) => {
    setClientData(updatedClient);
  };

  if (loadingClient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">{t('loadingProfile')}</p>
      </div>
    );
  }

  if (error && !clientData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">{t('errorTitle')}</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild><Link href="/client/dashboard">{t('backToDashboard')}</Link></Button>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">{t('notLoggedInTitle')}</h2>
        <p className="text-muted-foreground mb-6">{t('notLoggedInMessage')}</p>
        <Button asChild><Link href="/login">{t('goToLogin')}</Link></Button>
      </div>
    );
  }
  
  if (!clientData) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">{t('loadingProfile')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('pageDescription')}
        </p>
      </div>
      <EditProfileForm client={clientData} onProfileUpdated={handleProfileUpdated} />

      <Separator className="my-8" />

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-primary mb-6">
          {t('VehiclesSection.title')}
        </h2>
        {loadingVehicles ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">{t('VehiclesSection.loading')}</p>
          </div>
        ) : userVehicles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {userVehicles.map((vehicle: Vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">{t('VehiclesSection.noVehicles')}</p>
        )}
      </div>
    </div>
  );
}

    
