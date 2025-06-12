
"use client";

import { useState, useEffect, use } from 'react';
import { doc, getDoc, collection, query, where, getDocs, Timestamp, deleteDoc } from 'firebase/firestore';
import { db, auth, storage } from '@/lib/firebase';
import { ref as storageRefFirebase, deleteObject } from "firebase/storage";
import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { Vehicle, Client, MaintenanceItem, Invoice } from '@/types';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Tag, CalendarDays, Car, User as UserIcon, Edit, AlertTriangleIcon, Loader2, ShieldAlert, Trash2, Mail, BadgeInfo, Contact2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { EditVehicleForm } from '@/components/manager/EditVehicleForm';
import { InvoiceManagementSection } from '@/components/manager/InvoiceManagementSection';
import { MaintenanceManagementSection } from '@/components/manager/MaintenanceManagementSection';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ManagerVehicleDetailPageProps {
  params: Promise<{ id: string; locale: string }>; 
}

const formatDisplayDate = (dateValue: string | Timestamp | Date | undefined): string => {
  if (!dateValue) return 'N/A';
  try {
    const date = (dateValue instanceof Timestamp) ? dateValue.toDate() : new Date(dateValue as string | Date);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return String(dateValue);
  } catch (e) {
    console.error("Error formatting date:", e, "Original value:", dateValue);
    return String(dateValue);
  }
};

const ensureTimestamp = (value: any, fieldName: string, docId: string): Timestamp => {
    if (value instanceof Timestamp) return value;
    if (value && typeof value.toDate === 'function') return Timestamp.fromDate(value.toDate());
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) return Timestamp.fromDate(date);
    }
    console.warn(`Invalid or missing ${fieldName} for ${docId}, using fallback.`);
    return Timestamp.fromDate(new Date(0));
};


export default function ManagerVehicleDetailPage(props: ManagerVehicleDetailPageProps) {
  const resolvedParams = use(props.params);
  const vehicleId = resolvedParams.id;
  const router = useRouter();
  const t = useTranslations('ManagerVehicleDetailPage');
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [vehicleData, setVehicleData] = useState<Vehicle | null>(null);
  const [ownerData, setOwnerData] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);

  const [dataLoading, setDataLoading] = useState({
    vehicle: true,
    owner: true,
    invoices: true,
    maintenance: true,
  });
  const [fetchErrors, setFetchErrors] = useState({
    vehicle: null as string | null,
    owner: null as string | null,
    invoices: null as string | null,
    maintenance: null as string | null,
  });
  
  const [isDeletingVehicle, setIsDeletingVehicle] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (user) {
        setDataLoading({ vehicle: true, owner: true, invoices: true, maintenance: true });
        setFetchErrors({ vehicle: null, owner: null, invoices: null, maintenance: null });
        setVehicleData(null); 
        setOwnerData(null);
        setInvoices([]);
        setMaintenanceItems([]);

        try {
          const vehicleDocRef = doc(db, "vehicles", vehicleId);
          const vehicleSnap = await getDoc(vehicleDocRef);

          if (vehicleSnap.exists()) {
            const rawVehicleData = vehicleSnap.data();
            const vehicle = { 
              id: vehicleSnap.id, 
              ...rawVehicleData,
              createdAt: ensureTimestamp(rawVehicleData.createdAt, 'createdAt', vehicleSnap.id),
              updatedAt: ensureTimestamp(rawVehicleData.updatedAt, 'updatedAt', vehicleSnap.id),
            } as Vehicle;
            setVehicleData(vehicle);
            setDataLoading(prev => ({ ...prev, vehicle: false }));

            if (vehicle.ownerId) {
              try {
                const ownerDocRef = doc(db, "clients", vehicle.ownerId);
                const ownerSnap = await getDoc(ownerDocRef);
                if (ownerSnap.exists()) {
                  const rawOwnerData = ownerSnap.data();
                  const owner = { 
                    id: ownerSnap.id, 
                    ...rawOwnerData,
                     createdAt: ensureTimestamp(rawOwnerData.createdAt, 'createdAt', ownerSnap.id),
                     updatedAt: ensureTimestamp(rawOwnerData.updatedAt, 'updatedAt', ownerSnap.id),
                  } as Client;
                  setOwnerData(owner);
                } else {
                  setFetchErrors(prev => ({ ...prev, owner: t('errorLoadingOwner') }));
                }
              } catch (ownerError: any) {
                setFetchErrors(prev => ({ ...prev, owner: `${t('errorLoadingOwner')} (Code: ${ownerError.code})` }));
              } finally {
                setDataLoading(prev => ({ ...prev, owner: false }));
              }
            } else {
              setFetchErrors(prev => ({ ...prev, owner: t('errorLoadingOwner') + " (Vehículo no tiene ownerId)" }));
              setDataLoading(prev => ({ ...prev, owner: false }));
            }

            try {
              const invoicesQuery = query(collection(db, "invoices"), where("vehicleId", "==", vehicleId));
              const invoicesSnapshot = await getDocs(invoicesQuery);
              const fetchedInvoices = invoicesSnapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return { 
                    id: docSnap.id, 
                    ...data, 
                    date: ensureTimestamp(data.date, 'date', docSnap.id),
                    createdAt: ensureTimestamp(data.createdAt, 'createdAt', docSnap.id),
                    updatedAt: ensureTimestamp(data.updatedAt, 'updatedAt', docSnap.id),
                } as Invoice;
              });
              setInvoices(fetchedInvoices.sort((a,b) => b.date.toMillis() - a.date.toMillis()));
            } catch (invoicesError: any) {
              setFetchErrors(prev => ({ ...prev, invoices: `${t('errorLoadingInvoices')} (Code: ${invoicesError.code})` }));
            } finally {
              setDataLoading(prev => ({ ...prev, invoices: false }));
            }

            try {
              const maintenanceQuery = query(collection(db, "maintenanceItems"), where("vehicleId", "==", vehicleId));
              const maintenanceSnapshot = await getDocs(maintenanceQuery);
              const fetchedMaintenanceItems = maintenanceSnapshot.docs.map(docSnap => {
                 const data = docSnap.data();
                 return { 
                    id: docSnap.id, 
                    ...data, 
                    dueDate: data.dueDate ? (data.dueDate instanceof Timestamp ? data.dueDate : ensureTimestamp(data.dueDate, 'dueDate', docSnap.id)) : null,
                    createdAt: ensureTimestamp(data.createdAt, 'createdAt', docSnap.id),
                    updatedAt: ensureTimestamp(data.updatedAt, 'updatedAt', docSnap.id),
                } as MaintenanceItem
              });
              setMaintenanceItems(fetchedMaintenanceItems.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
            } catch (maintenanceError: any) {
              setFetchErrors(prev => ({ ...prev, maintenance: `${t('errorLoadingMaintenance')} (Code: ${maintenanceError.code})` }));
            } finally {
              setDataLoading(prev => ({ ...prev, maintenance: false }));
            }

          } else { 
            setFetchErrors(prev => ({ ...prev, vehicle: t('vehicleNotFoundDescription') }));
            setDataLoading({ vehicle: false, owner: false, invoices: false, maintenance: false });
          }
        } catch (vehicleError: any) { 
          setFetchErrors(prev => ({ ...prev, vehicle: `${t('errorLoadingVehicle')} (Code: ${vehicleError.code})` }));
          setDataLoading({ vehicle: false, owner: false, invoices: false, maintenance: false });
        }
      } else {
        setDataLoading({ vehicle: false, owner: false, invoices: false, maintenance: false });
      }
    });
    return () => unsubscribe();
  }, [vehicleId, t, resolvedParams]);

  const handleDeleteVehicle = async () => {
    if (!vehicleData) return;
    setIsDeletingVehicle(true);

    try {
      if (vehicleData.imagePath) {
        const imageFileRef = storageRefFirebase(storage, vehicleData.imagePath);
        try {
          await deleteObject(imageFileRef);
        } catch (storageError: any) {
          toast({
            title: t('toastDeleteImageErrorDuringVehicleDeleteTitle'),
            description: t('toastDeleteImageErrorDuringVehicleDeleteDescription', { error: storageError.message }),
            variant: "warning", 
          });
        }
      }
      await deleteDoc(doc(db, "vehicles", vehicleData.id));
      toast({
        title: t('toastDeleteVehicleSuccessTitle'),
        description: t('toastDeleteVehicleSuccessDescription', { make: vehicleData.make, model: vehicleData.model }),
      });
      router.push('/manager/dashboard');
    } catch (error: any) {
      toast({
        title: t('toastDeleteVehicleErrorTitle'),
        description: t('toastDeleteVehicleErrorDescription', { error: error.message }),
        variant: "destructive",
      });
    } finally {
      setIsDeletingVehicle(false);
      setIsConfirmDeleteOpen(false);
    }
  };

  const isLoadingOverall = authLoading || dataLoading.vehicle; 

  if (isLoadingOverall) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">
          {authLoading ? t('loadingAuth') :
           dataLoading.vehicle ? t('loadingVehicle') : "Loading..."
          }
        </p>
      </div>
    );
  }

  if (!currentUser) { 
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <ShieldAlert className="mx-auto h-16 w-16 text-destructive mb-6" />
        <h1 className="text-3xl font-semibold text-destructive mb-3">{t('unauthorizedAccessTitle', {ns: 'ClientVehicleDetailPage'})}</h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          {t('notLoggedIn', {ns: 'ClientVehicleDetailPage'})}
        </p>
        <Button asChild variant="outline" size="lg">
          <Link href="/manager/login">
            <ArrowLeft className="mr-2 h-5 w-5" /> {t('goToLogin', {ns: 'ClientVehicleDetailPage'})}
          </Link>
        </Button>
      </div>
    );
  }

  if (fetchErrors.vehicle) { 
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <AlertTriangleIcon className="mx-auto h-16 w-16 text-destructive mb-6" />
        <h1 className="text-3xl font-semibold text-destructive mb-3">{t('vehicleNotFoundTitle')}</h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          {fetchErrors.vehicle}
        </p>
        <Button asChild variant="outline" size="lg">
          <Link href="/manager/dashboard">
            <ArrowLeft className="mr-2 h-5 w-5" /> {t('backToDashboard')}
          </Link>
        </Button>
      </div>
    );
  }
  
  if (!vehicleData) { 
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Car className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold text-destructive">{t('vehicleNotFoundTitle')}</h1>
        <p className="text-muted-foreground mt-2">
            {t('vehicleNotFoundDescription')}
        </p>
        <Button asChild variant="outline" className="mt-6">
            <Link href="/manager/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t('backToDashboard')}
            </Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
        <div className="flex justify-between items-center">
            <Button asChild variant="outline" className="mb-6 print:hidden">
                <Link href="/manager/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" /> {t('backToDashboard')}
                </Link>
            </Button>
            <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mb-6 print:hidden">
                  <Trash2 className="mr-2 h-4 w-4" /> {t('deleteVehicleButton')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('confirmDeleteVehicleTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('confirmDeleteVehicleDescription', { make: vehicleData.make, model: vehicleData.model, licensePlate: vehicleData.licensePlate })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeletingVehicle}>{t('confirmDeleteVehicleCancelButton')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteVehicle} disabled={isDeletingVehicle} className="bg-destructive hover:bg-destructive/90">
                    {isDeletingVehicle && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('confirmDeleteVehicleConfirmButton')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
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
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-3xl font-bold text-primary">{vehicleData.make} {vehicleData.model}</CardTitle>
                                <p className="text-xl text-muted-foreground">{vehicleData.year}</p>
                            </div>
                        </div>
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
                            <strong>{t('lastService')}:</strong> {formatDisplayDate(vehicleData.lastServiceDate)}
                        </div>
                         {vehicleData.engineCode && (
                            <div className="flex items-center gap-2">
                                <Car className="h-5 w-5 text-accent"/> 
                                <strong>{t('engineCode')}:</strong> {vehicleData.engineCode}
                            </div>
                        )}
                        {vehicleData.currentMileage !== undefined && (
                            <div className="flex items-center gap-2">
                                <Car className="h-5 w-5 text-accent"/> 
                                <strong>{t('currentMileage')}:</strong> {vehicleData.currentMileage.toLocaleString()} km
                            </div>
                        )}
                        {dataLoading.owner ? <div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> {t('loadingOwner')}</div> : ownerData ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <UserIcon className="h-5 w-5 text-accent" />
                                    <strong>{t('owner')}:</strong> {ownerData.firstName} {ownerData.lastName}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Mail className="h-5 w-5 text-accent" /> 
                                    <strong>{t('clientEmail')}:</strong> {ownerData.email}
                                </div>
                                {ownerData.identityDocument?.number && (
                                  <div className="flex items-center gap-2">
                                      <Contact2 className="h-5 w-5 text-accent" /> 
                                      <strong>{t('clientDni')}:</strong> {ownerData.identityDocument.number}
                                  </div>
                                )}
                            </>
                        ) : fetchErrors.owner ? <p className="text-sm text-destructive">{fetchErrors.owner}</p> : <p className="text-sm text-muted-foreground">{t('errorLoadingOwner')}</p>}
                    </CardContent>
                    </div>
                </div>
            </Card>
      
      <Separator />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Edit className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">{t('editVehicleDetailsTitle')}</CardTitle>
          </div>
          <CardDescription>{t('editVehicleDetailsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <EditVehicleForm vehicle={vehicleData} onVehicleUpdated={(updatedVehicle) => setVehicleData(updatedVehicle)} />
        </CardContent>
      </Card>

      <Separator />
      
      {dataLoading.invoices ? <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /> <span className="ml-2">{t('loadingInvoices')}</span></div> : fetchErrors.invoices ? <p className="text-destructive text-center py-4">{fetchErrors.invoices}</p> : (
        <InvoiceManagementSection 
            vehicleId={vehicleData.id} 
            clientId={vehicleData.ownerId} 
            initialInvoices={invoices} 
            onInvoiceAdded={(newInvoice) => setInvoices(prev => [newInvoice, ...prev].sort((a,b) => b.date.toMillis() - a.date.toMillis()))}
            onInvoiceUpdated={(updatedInvoice) => setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv).sort((a,b) => b.date.toMillis() - a.date.toMillis()))}
            onInvoiceDeleted={(deletedInvoiceId) => setInvoices(prev => prev.filter(inv => inv.id !== deletedInvoiceId))}
        />
      )}

      <Separator />

      {dataLoading.maintenance ? <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /> <span className="ml-2">{t('loadingMaintenance')}</span></div> : fetchErrors.maintenance ? <p className="text-destructive text-center py-4">{fetchErrors.maintenance}</p> : (
        <MaintenanceManagementSection 
            vehicleId={vehicleData.id}
            clientId={vehicleData.ownerId} 
            initialMaintenanceItems={maintenanceItems} 
            onItemSaved={(item) => {
                setMaintenanceItems(prev => {
                    const existingIndex = prev.findIndex(i => i.id === item.id);
                    if (existingIndex > -1) {
                        const updated = [...prev];
                        updated[existingIndex] = item;
                        return updated.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                    }
                    return [...prev, item].sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                });
            }}
            onItemDeleted={(deletedItemId) => setMaintenanceItems(prev => prev.filter(item => item.id !== deletedItemId))}
        />
      )}
    </div>
  );
}
