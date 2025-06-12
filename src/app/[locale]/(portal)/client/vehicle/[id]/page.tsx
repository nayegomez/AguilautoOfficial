
"use client";

import { useState, useEffect, use } from 'react';
import { MaintenanceSchedule } from '@/components/client/MaintenanceSchedule';
import { InvoiceList } from '@/components/client/InvoiceList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Tag, CalendarDays, Car, AlertTriangleIcon, Loader2, ShieldAlert, Gauge } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import type { Vehicle, MaintenanceItem, Invoice } from '@/types';
import { onAuthStateChanged } from 'firebase/auth';

interface ClientVehicleDetailPageProps {
  params: Promise<{ id: string; locale: string }>;
}

const formatLastServiceDate = (dateValue: string | Timestamp | Date | undefined): string => {
  if (!dateValue) return 'N/A';
  try {
    if (dateValue instanceof Timestamp) {
      return dateValue.toDate().toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    return String(dateValue);
  } catch (e) {
    console.error("Error formatting date:", e, "Original value:", dateValue);
    return String(dateValue);
  }
};

const ensureTimestampInstance = (value: any, fieldName: string, docId: string): Timestamp => {
    if (value instanceof Timestamp) {
        return value;
    }
    if (value && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
        return new Timestamp(value.seconds, value.nanoseconds);
    }
    if (value) {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
            return Timestamp.fromDate(d);
        }
    }
    console.warn(`[ClientVehicleDetailPage] Invalid or missing '${fieldName}' for doc ${docId}. Using epoch as fallback.`);
    return Timestamp.fromDate(new Date(0));
};


export default function ClientVehicleDetailPage(props: ClientVehicleDetailPageProps) {
  const resolvedParams = use(props.params);
  const vehicleId = resolvedParams.id;

  const t = useTranslations('ClientVehicleDetailPage');
  
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [vehicleData, setVehicleData] = useState<Vehicle | null>(null);
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (!vehicleId) {
      setFetchError(t('vehicleNotFoundDescription')); 
      setAuthLoading(false);
      setDataLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (user) {
        setDataLoading(true);
        setFetchError(null);
        setIsAuthorized(null);

        try {
          const vehicleDocRef = doc(db, "vehicles", vehicleId);
          const vehicleSnap = await getDoc(vehicleDocRef);

          if (vehicleSnap.exists()) {
            const rawData = vehicleSnap.data();

            if (rawData.ownerId !== user.uid) {
              setFetchError(t('vehicleNotFoundDescription'));
              setIsAuthorized(false);
              setVehicleData(null);
              setDataLoading(false);
              return; 
            }
            setIsAuthorized(true);

            const parsedVehicle: Vehicle = {
              id: vehicleSnap.id,
              make: rawData.make,
              model: rawData.model,
              year: rawData.year,
              licensePlate: rawData.licensePlate,
              vin: rawData.vin,
              ownerId: rawData.ownerId,
              engineCode: rawData.engineCode,
              currentMileage: rawData.currentMileage,
              imageUrl: rawData.imageUrl,
              imagePath: rawData.imagePath,
              lastServiceDate: rawData.lastServiceDate,
              createdAt: ensureTimestampInstance(rawData.createdAt, 'createdAt', vehicleSnap.id),
              updatedAt: ensureTimestampInstance(rawData.updatedAt, 'updatedAt', vehicleSnap.id),
            };
            setVehicleData(parsedVehicle);

            const maintenanceQuery = query(collection(db, "maintenanceItems"), where("vehicleId", "==", vehicleId), where("clientId", "==", user.uid));
            const maintenanceSnapshot = await getDocs(maintenanceQuery);
            const fetchedMaintenanceItems = maintenanceSnapshot.docs.map(docSnap => {
              const itemData = docSnap.data();
              let dueDateString: string | null = null;
              if (itemData.dueDate) {
                if (itemData.dueDate instanceof Timestamp) {
                  dueDateString = itemData.dueDate.toDate().toISOString().split('T')[0];
                } else if (typeof itemData.dueDate === 'string') {
                  dueDateString = itemData.dueDate;
                }
              }
              return { 
                ...itemData, 
                id: docSnap.id, 
                dueDate: dueDateString,
                createdAt: ensureTimestampInstance(itemData.createdAt, 'createdAt', docSnap.id),
                updatedAt: ensureTimestampInstance(itemData.updatedAt, 'updatedAt', docSnap.id),
              } as MaintenanceItem;
            });
            setMaintenanceItems(fetchedMaintenanceItems.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));

            const invoicesQuery = query(collection(db, "invoices"), where("vehicleId", "==", vehicleId), where("clientId", "==", user.uid));
            const invoicesSnapshot = await getDocs(invoicesQuery);
            const fetchedInvoices = invoicesSnapshot.docs.map(docSnap => {
              const invoiceData = docSnap.data();
              return { 
                ...invoiceData, 
                id: docSnap.id, 
                date: ensureTimestampInstance(invoiceData.date, 'date', docSnap.id),
                createdAt: ensureTimestampInstance(invoiceData.createdAt, 'createdAt', docSnap.id),
                updatedAt: ensureTimestampInstance(invoiceData.updatedAt, 'updatedAt', docSnap.id),
              } as Invoice;
            });
            setInvoices(fetchedInvoices.sort((a,b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0)));

          } else {
            setFetchError(t('vehicleNotFoundDescription'));
            setVehicleData(null);
            setIsAuthorized(false); 
          }
        } catch (error: any) {
          if (error.code === 'permission-denied') {
            setFetchError(t('vehicleNotFoundDescription')); 
            setIsAuthorized(false); 
          } else {
            setFetchError(t('errorFetching'));
          }
          setVehicleData(null);
        } finally {
          setDataLoading(false);
        }
      } else {
        setDataLoading(false);
        setVehicleData(null);
        setMaintenanceItems([]);
        setInvoices([]);
        setIsAuthorized(null); 
      }
    });

    return () => unsubscribe();
  }, [vehicleId, t, resolvedParams]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">{t('loadingAuth', {ns: 'ClientDashboardPage'})}</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <AlertTriangleIcon className="mx-auto h-16 w-16 text-destructive mb-6" />
        <h1 className="text-3xl font-semibold text-destructive mb-3">{t('vehicleNotFoundTitle')}</h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          {t('notLoggedIn', {ns: 'ClientDashboardPage'})}
        </p>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">
            <ArrowLeft className="mr-2 h-5 w-5" /> {t('goToLogin', {ns: 'ClientDashboardPage'})}
          </Link>
        </Button>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">{t('loadingVehicle')}</p>
      </div>
    );
  }
  
  if (isAuthorized === false || (fetchError && !vehicleData) ) { 
     const title = isAuthorized === false && !fetchError ? t('unauthorizedAccessTitle') : t('vehicleNotFoundTitle');
     const description = fetchError || t('unauthorizedAccessMessage');
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        {isAuthorized === false ? <ShieldAlert className="mx-auto h-16 w-16 text-destructive mb-6" /> : <AlertTriangleIcon className="mx-auto h-16 w-16 text-destructive mb-6" />}
        <h1 className="text-3xl font-semibold text-destructive mb-3">{title}</h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          {description}
        </p>
        <Button asChild variant="outline" size="lg">
          <Link href="/client/dashboard">
            <ArrowLeft className="mr-2 h-5 w-5" /> {t('backToDashboard')}
          </Link>
        </Button>
      </div>
    );
  }
  
  if (!vehicleData) { 
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
         <AlertTriangleIcon className="mx-auto h-16 w-16 text-destructive mb-6" />
        <h1 className="text-3xl font-semibold text-destructive mb-3">{t('vehicleNotFoundTitle')}</h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          {t('vehicleNotFoundDescription')}
        </p>
        <Button asChild variant="outline" size="lg">
          <Link href="/client/dashboard">
            <ArrowLeft className="mr-2 h-5 w-5" /> {t('backToDashboard')}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="outline" className="mb-6">
          <Link href="/client/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t('backToDashboard')}
          </Link>
        </Button>
        <Card className="overflow-hidden shadow-lg">
          <div className="md:flex">
            <div className="md:w-1/3 relative h-64 md:h-auto">
              <Image
                src={vehicleData.imageUrl || "https://placehold.co/400x300.png"}
                alt={`${vehicleData.make} ${vehicleData.model}`}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover"
                priority
                unoptimized
              />
            </div>
            <div className="md:w-2/3">
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-primary">{vehicleData.make} {vehicleData.model}</CardTitle>
                <p className="text-xl text-muted-foreground">{vehicleData.year}</p>
              </CardHeader>
              <CardContent className="space-y-3 text-md">
                <div className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-accent" />
                  <strong>{t('licensePlate')}:</strong> {vehicleData.licensePlate}
                </div>
                <div className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-accent" />
                  <strong>{t('vin')}:</strong> {vehicleData.vin}
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-accent" />
                  <strong>{t('lastService')}:</strong> {formatLastServiceDate(vehicleData.lastServiceDate)}
                </div>
                {vehicleData.engineCode && (
                    <div className="flex items-center gap-2">
                        <Car className="h-5 w-5 text-accent" /> 
                        <strong>{t('engineCode')}:</strong> {vehicleData.engineCode}
                    </div>
                )}
                {vehicleData.currentMileage !== undefined && (
                    <div className="flex items-center gap-2">
                         <Gauge className="h-5 w-5 text-accent" /> 
                        <strong>{t('currentMileage')}:</strong> {vehicleData.currentMileage.toLocaleString()} km
                    </div>
                )}
              </CardContent>
            </div>
          </div>
        </Card>
      </div>
      
      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MaintenanceSchedule items={maintenanceItems} />
        <InvoiceList invoices={invoices} />
      </div>
    </div>
  );
}
