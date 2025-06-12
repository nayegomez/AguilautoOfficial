
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Client, Vehicle } from '@/types';
import { AddEditClientForm } from '@/components/manager/AddEditClientForm';
import { Loader2, User, AlertTriangle, ArrowLeft, Car, PlusCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddVehicleForm } from '@/components/manager/AddVehicleForm';

export default function ClientEditPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = typeof params.clientId === 'string' ? params.clientId : undefined;

  const t_detail = useTranslations('ManagerClientDetailPage');
  const t_add_vehicle_form_dialog = useTranslations('ManagerDashboardPage.AddVehicleForm');

  const [client, setClient] = useState<Client | null>(null);
  const [isLoadingClient, setIsLoadingClient] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);

  const [clientVehicles, setClientVehicles] = useState<Vehicle[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);

  const [isAddVehicleDialogOpen, setIsAddVehicleDialogOpen] = useState(false);

  useEffect(() => {
    if (clientId) {
      setIsLoadingClient(true);
      setClientError(null);
      setClient(null);
      setIsLoadingVehicles(true);
      setVehiclesError(null);
      setClientVehicles([]);

      const fetchClientData = async () => {
        try {
          const clientDocRef = doc(db, "clients", clientId);
          const clientDocSnap = await getDoc(clientDocRef);

          if (clientDocSnap.exists()) {
            const data = clientDocSnap.data();
            setClient({ 
                id: clientDocSnap.id, 
                ...data,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.fromDate(new Date(data.createdAt?.seconds * 1000 || Date.now())),
                updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : Timestamp.fromDate(new Date(data.updatedAt?.seconds * 1000 || Date.now())),
            } as Client);
            setClientError(null);

            try {
              const vehiclesQuery = query(collection(db, "vehicles"), where("ownerId", "==", clientId));
              const vehiclesSnapshot = await getDocs(vehiclesQuery);
              const fetchedVehicles = vehiclesSnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data(),
                createdAt: docSnap.data().createdAt instanceof Timestamp ? docSnap.data().createdAt : Timestamp.fromDate(new Date(docSnap.data().createdAt?.seconds * 1000 || Date.now())),
                updatedAt: docSnap.data().updatedAt instanceof Timestamp ? docSnap.data().updatedAt : Timestamp.fromDate(new Date(docSnap.data().updatedAt?.seconds * 1000 || Date.now())),
              } as Vehicle));
              setClientVehicles(fetchedVehicles.sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
              setVehiclesError(null);
            } catch (vehErr: any) {
              setVehiclesError(t_detail('VehiclesSection.errorFetchingVehicles') + `: ${vehErr.message}`);
            } finally {
              setIsLoadingVehicles(false);
            }

          } else {
            setClientError(t_detail('errorNotFound'));
          }
        } catch (err: any) {
          setClientError(t_detail('errorFetching') + `: ${err.message}`);
        } finally {
          setIsLoadingClient(false);
        }
      };
      fetchClientData();
    } else {
      setClientError(t_detail('errorInvalidId'));
      setIsLoadingClient(false);
      setIsLoadingVehicles(false);
    }
  }, [clientId, t_detail]);

  const handleClientUpdated = (updatedClient: Client) => {
    setClient(updatedClient);
  };

  const handleVehicleAddedToClient = (newVehicle: Vehicle) => {
    setClientVehicles(prev => [newVehicle, ...prev].sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
    setIsAddVehicleDialogOpen(false);
  };

  if (isLoadingClient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">{t_detail('loadingClient')}</p>
      </div>
    );
  }

  if (clientError && !client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">{t_detail('errorTitle')}</h2>
        <p className="text-muted-foreground mb-6">{clientError}</p>
        <Button asChild variant="outline">
            <Link href="/manager/clients">
                <ArrowLeft className="mr-2 h-4 w-4" /> {t_detail('backToList')}
            </Link>
        </Button>
      </div>
    );
  }
  
  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <User className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-xl text-muted-foreground">{clientError === t_detail('errorNotFound') ? t_detail('errorNotFound') : t_detail('noClientData')}</p>
         <Button asChild variant="outline" className="mt-4">
            <Link href="/manager/clients">
                <ArrowLeft className="mr-2 h-4 w-4" /> {t_detail('backToList')}
            </Link>
        </Button>
      </div>
    );
  }
  
  const clientFullName = `${client.firstName || ''} ${client.lastName || ''}`.trim();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
            {t_detail('pageTitle.edit', { clientName: clientFullName || t_detail('noNameClientFallback')})}
            </h1>
            <p className="text-muted-foreground mt-1">
            {t_detail('pageDescription.edit')}
            </p>
        </div>
        <Button asChild variant="outline">
            <Link href="/manager/clients">
                <ArrowLeft className="mr-2 h-4 w-4" /> {t_detail('backToList')}
            </Link>
        </Button>
      </div>
      
      <Separator />

      <AddEditClientForm
        clientToEdit={client}
        onClientSaved={handleClientUpdated}
        isOnPage={true}
      />

      <Separator />

      <Card>
        <CardHeader className="flex flex-row justify-between items-start sm:items-center">
            <div>
                <div className="flex items-center gap-3">
                    <Car className="h-6 w-6 text-primary" />
                    <CardTitle>{t_detail('VehiclesSection.title')}</CardTitle>
                </div>
                <CardDescription>
                {t_detail('VehiclesSection.description', { clientName: clientFullName || t_detail('noNameClientFallback') })}
                </CardDescription>
            </div>
            <Dialog open={isAddVehicleDialogOpen} onOpenChange={setIsAddVehicleDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="mt-2 sm:mt-0 sm:ml-4 flex-shrink-0">
                    <PlusCircle className="mr-2 h-4 w-4" /> 
                    {t_detail('VehiclesSection.addNewVehicleButton', { clientName: clientFullName || t_detail('noNameClientFallbackForButton') })}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t_add_vehicle_form_dialog('dialogTitle')}</DialogTitle>
                  <DialogDescription>{t_add_vehicle_form_dialog('dialogDescription')}</DialogDescription>
                </DialogHeader>
                <AddVehicleForm
                  clients={client ? [client] : []}
                  onVehicleAdded={handleVehicleAddedToClient}
                  closeDialog={() => setIsAddVehicleDialogOpen(false)}
                  preselectedOwnerId={clientId}
                />
              </DialogContent>
            </Dialog>
        </CardHeader>
        <CardContent>
            {isLoadingVehicles ? (
                <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-3 text-muted-foreground">{t_detail('VehiclesSection.loadingVehicles')}</p>
                </div>
            ) : vehiclesError ? (
                 <p className="text-destructive text-center py-4">{vehiclesError}</p>
            ) : clientVehicles.length > 0 ? (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>{t_detail('VehiclesSection.tableHeaderMake')}</TableHead>
                            <TableHead>{t_detail('VehiclesSection.tableHeaderModel')}</TableHead>
                            <TableHead>{t_detail('VehiclesSection.tableHeaderYear')}</TableHead>
                            <TableHead>{t_detail('VehiclesSection.tableHeaderLicensePlate')}</TableHead>
                            <TableHead className="text-right">{t_detail('VehiclesSection.tableHeaderActions')}</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {clientVehicles.map((vehicle) => (
                            <TableRow key={vehicle.id}>
                            <TableCell>{vehicle.make}</TableCell>
                            <TableCell>{vehicle.model}</TableCell>
                            <TableCell>{vehicle.year}</TableCell>
                            <TableCell><Badge variant="secondary">{vehicle.licensePlate}</Badge></TableCell>
                            <TableCell className="text-right">
                                <Button asChild variant="outline" size="sm">
                                <Link href={`/manager/vehicle/${vehicle.id}`}>
                                    {t_detail('VehiclesSection.actionViewManage')}
                                </Link>
                                </Button>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <p className="text-muted-foreground text-center py-8">{t_detail('VehiclesSection.noVehicles')}</p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
    
