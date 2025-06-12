
"use client";
import { useState, useEffect } from 'react';
import type { User as FirebaseUser } from 'firebase/auth'; 
import { onAuthStateChanged } from 'firebase/auth'; 
import type { Vehicle, Client } from '@/types';
import { VehicleListTable } from '@/components/manager/VehicleListTable';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Car, Loader2, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { auth, db } from '@/lib/firebase'; 
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddVehicleForm } from '@/components/manager/AddVehicleForm';

interface EnrichedVehicle extends Vehicle {
  ownerName?: string;
  ownerDni?: string;
  clientEmail?: string;
}

const ITEMS_PER_PAGE = 10;

export default function ManagerDashboardPage() {
  const t_page = useTranslations('ManagerDashboardPage');
  const t_pagination = useTranslations(); 
  const [searchTerm, setSearchTerm] = useState('');
  const [allVehicles, setAllVehicles] = useState<EnrichedVehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddVehicleDialogOpen, setIsAddVehicleDialogOpen] = useState(false);
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null); 
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    console.log('[ManagerDashboardPage] useEffect triggered.');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[ManagerDashboardPage] Auth state changed. User:', user?.uid || 'null');
      setCurrentUser(user);
      if (user) {
        fetchData(user);
      } else {
        setIsLoading(false);
        setAllVehicles([]);
        setClients([]);
        console.log('[ManagerDashboardPage] No authenticated user, clearing data.');
      }
    });
    return () => {
      console.log('[ManagerDashboardPage] useEffect cleanup.');
      unsubscribe();
    }
  }, []); 

  const fetchData = async (user: FirebaseUser) => {
    console.log(`[ManagerDashboardPage] fetchData called for user: ${user.uid}`);
    setIsLoading(true);
    try {
      console.log('[ManagerDashboardPage] Attempting to fetch clients...');
      const clientsSnapshot = await getDocs(collection(db, "clients"));
      console.log(`[ManagerDashboardPage] Fetched ${clientsSnapshot.docs.length} client documents.`);

      
      const ensureTimestamp = (value: any): Timestamp => {
        if (value instanceof Timestamp) return value;
        if (value && typeof value.toDate === 'function') return Timestamp.fromDate(value.toDate());
        if (typeof value === 'string' || typeof value === 'number') {
          const date = new Date(value);
          if (!isNaN(date.getTime())) return Timestamp.fromDate(date);
        }
        console.warn("[ManagerDashboardPage] Invalid or missing timestamp data, using fallback:", value);
        return Timestamp.fromDate(new Date(0));
      };

      const clientsData = clientsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          firstName: data.firstName as string,
          lastName: data.lastName as string,
          email: data.email as string,
          profileImageUrl: data.profileImageUrl as string | undefined,
          identityDocument: data.identityDocument as { number: string; type: import('@/types').IdentityDocumentType; } | undefined,
          phone1: data.phone1 as string | undefined,
          phone2: data.phone2 as string | undefined,
          fiscalAddress: data.fiscalAddress as import('@/types').Address | undefined,
          postalAddress: data.postalAddress as import('@/types').Address | undefined,
          role: data.role as 'client' | 'manager',
          createdAt: ensureTimestamp(data.createdAt),
          updatedAt: ensureTimestamp(data.updatedAt),
          isActive: data.isActive as boolean,
        } as Client;
      });
      setClients(clientsData);
      console.log('[ManagerDashboardPage] Clients data processed and set.');

      
      const managerClientDoc = clientsData.find(c => c.id === user.uid);
      if (managerClientDoc) {
        console.log(`[ManagerDashboardPage] Logged-in user (${user.uid}) role found in clientsData: ${managerClientDoc.role}`);
      } else {
        console.warn(`[ManagerDashboardPage] Logged-in user (${user.uid}) NOT FOUND in fetched clientsData. This is problematic for role-based access.`);
      }

      console.log('[ManagerDashboardPage] Attempting to fetch vehicles...');
      const vehiclesSnapshot = await getDocs(collection(db, "vehicles"));
      console.log(`[ManagerDashboardPage] Fetched ${vehiclesSnapshot.docs.length} vehicle documents.`);
      
      if (vehiclesSnapshot.empty) {
          console.warn("[ManagerDashboardPage] No vehicles found in the 'vehicles' collection based on current rules for this user.");
      }


      const vehiclesData = vehiclesSnapshot.docs.map(doc => {
        const data = doc.data();
        const vehicle: Vehicle = {
          id: doc.id,
          make: data.make as string,
          model: data.model as string,
          year: data.year as number,
          licensePlate: data.licensePlate as string,
          vin: data.vin as string,
          ownerId: data.ownerId as string,
          engineCode: data.engineCode as string | undefined,
          currentMileage: data.currentMileage as number | undefined,
          imageUrl: data.imageUrl as string | undefined,
          imagePath: data.imagePath as string | undefined,
          lastServiceDate: data.lastServiceDate,
          createdAt: ensureTimestamp(data.createdAt),
          updatedAt: ensureTimestamp(data.updatedAt),
        };
        return vehicle;
      });
      console.log('[ManagerDashboardPage] Vehicles data processed.');

      const clientMap = new Map(clientsData.map(client => [client.id, client]));
      const enrichedVehicles = vehiclesData.map(vehicle => {
        const owner = clientMap.get(vehicle.ownerId);
        return {
          ...vehicle,
          ownerName: owner ? `${owner.firstName} ${owner.lastName}` : 'N/A',
          ownerDni: owner?.identityDocument?.number || 'N/A',
          clientEmail: owner?.email || 'N/A',
        };
      });

      setAllVehicles(enrichedVehicles.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
      console.log('[ManagerDashboardPage] Enriched vehicles set. Total:', enrichedVehicles.length);

    } catch (error: any) {
      console.error("[ManagerDashboardPage] Error fetching data from Firestore:", error.message, error.code ? `(Code: ${error.code})` : '', error.stack);
      toast({
        title: t_page('toastErrorTitle'),
        description: `${t_page('toastErrorDescription')} (Error: ${error.message})`,
        variant: "destructive",
      });
      setAllVehicles([]);
      setClients([]);
    } finally {
      setIsLoading(false);
      console.log('[ManagerDashboardPage] fetchData finished, isLoading set to false.');
    }
  };


  const handleVehicleAdded = (newVehicleData: Vehicle) => {
    const owner = clients.find(c => c.id === newVehicleData.ownerId);
    const newEnrichedVehicle: EnrichedVehicle = {
      ...newVehicleData,
      ownerName: owner ? `${owner.firstName} ${owner.lastName}` : 'N/A',
      ownerDni: owner?.identityDocument?.number || 'N/A',
      clientEmail: owner?.email || 'N/A',
    };
    setAllVehicles(prev => [newEnrichedVehicle, ...prev].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
    setIsAddVehicleDialogOpen(false);
  };


  const filteredVehicles = allVehicles.filter(vehicle => {
    const term = searchTerm.toLowerCase();
    return (
      vehicle.licensePlate.toLowerCase().includes(term) ||
      (vehicle.ownerDni && vehicle.ownerDni.toLowerCase().includes(term)) ||
      vehicle.make.toLowerCase().includes(term) ||
      vehicle.model.toLowerCase().includes(term) ||
      (vehicle.ownerName && vehicle.ownerName.toLowerCase().includes(term)) ||
      (vehicle.clientEmail && vehicle.clientEmail.toLowerCase().includes(term)) ||
      vehicle.vin.toLowerCase().includes(term)
    );
  });
  
  const totalPages = Math.ceil(filteredVehicles.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentDisplayedVehicles = filteredVehicles.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };


  if (isLoading && !currentUser) { 
     return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-xl text-muted-foreground">{t_page('loading')}</p>
      </div>
    );
  }
  
  if (!currentUser && !isLoading) { 
    return (
      <div className="text-center py-12">
        <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-xl text-muted-foreground">
          {t_page('ManagerLoginForm.title', {ns: '_components'})}
        </p>
        <p className="mt-2 text-sm">{t_page('ManagerLoginForm.description', {ns: '_components'})}</p>
        <Button asChild className="mt-4">
          <a href="/manager/login">{t_page('ManagerLoginForm.signInButton', {ns: '_components'})}</a>
        </Button>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">{t_page('title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t_page('description')}
        </p>
      </div>
      <Separator />
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <Input
          type="text"
          placeholder={t_page('searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md shadow-sm"
        />
        <Dialog open={isAddVehicleDialogOpen} onOpenChange={setIsAddVehicleDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> {t_page('addNewVehicleButton')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t_page('AddVehicleForm.dialogTitle')}</DialogTitle>
              <DialogDescription>{t_page('AddVehicleForm.dialogDescription')}</DialogDescription>
            </DialogHeader>
            <AddVehicleForm
              clients={clients}
              onVehicleAdded={handleVehicleAdded}
              closeDialog={() => setIsAddVehicleDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-xl text-muted-foreground">{t_page('loading')}</p>
        </div>
      ) : currentDisplayedVehicles.length > 0 ? (
        <>
          <VehicleListTable vehicles={currentDisplayedVehicles} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Button 
                variant="outline"
                size="icon" 
                onClick={handlePrevPage} 
                disabled={currentPage === 1}
                aria-label={t_pagination('paginationPreviousAriaLabel')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {t_pagination('paginationPageInfo', { currentPage, totalPages })}
              </span>
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleNextPage} 
                disabled={currentPage === totalPages}
                aria-label={t_pagination('paginationNextAriaLabel')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground">
            {allVehicles.length === 0 && searchTerm === '' ? t_page('noVehiclesFoundDB') : t_page('noVehiclesFoundCriteria')}
          </p>
          {allVehicles.length === 0 && searchTerm === '' && <p className="mt-2">{t_page('considerAddingVehicles')}</p>}
        </div>
      )}
    </div>
  );
}
