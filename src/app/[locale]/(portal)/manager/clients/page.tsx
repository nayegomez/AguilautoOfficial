
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Client } from '@/types';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Loader2, Users, ChevronLeft, ChevronRight } from 'lucide-react'; 
import { ClientListTable } from '@/components/manager/ClientListTable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';

const ITEMS_PER_PAGE = 10;

export default function ManagerClientsPage() {
  const t = useTranslations('ManagerClientsPage');
  const commonT = useTranslations();
  const { toast } = useToast();
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isConfirmToggleActiveDialogOpen, setIsConfirmToggleActiveDialogOpen] = useState(false);
  const [clientToToggleActive, setClientToToggleActive] = useState<Client | null>(null);


  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "clients"), orderBy("lastName", "asc"), orderBy("firstName", "asc"));
      const querySnapshot = await getDocs(q);
      const clientsData = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as Client));
      setClients(clientsData);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast({
        title: t('toastErrorTitle'),
        description: t('toastErrorGeneric', { error: (error as Error).message }),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);
  
  const handleNavigateToEditClient = (client: Client) => {
    router.push(`/manager/clients/${client.id}`);
  };


  const handleToggleClientActive = async () => {
    if (!clientToToggleActive) return;

    const newIsActiveStatus = !clientToToggleActive.isActive;
    try {
      const clientRef = doc(db, "clients", clientToToggleActive.id);
      await updateDoc(clientRef, { 
        isActive: newIsActiveStatus,
        updatedAt: serverTimestamp(),
      });
      
      const updatedClient = { ...clientToToggleActive, isActive: newIsActiveStatus, updatedAt: new Date() as any };
      setClients(prev => 
        prev.map(c => c.id === clientToToggleActive.id ? updatedClient : c)
      );

      toast({
        title: newIsActiveStatus ? t('toastActivateSuccess', { clientName: `${clientToToggleActive.firstName} ${clientToToggleActive.lastName}` }) : t('toastDeactivateSuccess', { clientName: `${clientToToggleActive.firstName} ${clientToToggleActive.lastName}` }),
      });
    } catch (error) {
      console.error("Error toggling client active status:", error);
      toast({
        title: t('toastErrorTitle'),
        description: t('toastToggleStatusError', { error: (error as Error).message }),
        variant: "destructive",
      });
    } finally {
      setIsConfirmToggleActiveDialogOpen(false);
      setClientToToggleActive(null);
    }
  };

  const openConfirmToggleActiveDialog = (client: Client) => {
    setClientToToggleActive(client);
    setIsConfirmToggleActiveDialogOpen(true);
  };


  const filteredClients = clients.filter(client => {
    const term = searchTerm.toLowerCase();
    const fullName = `${client.firstName || ''} ${client.lastName || ''}`.toLowerCase();
    return (
      fullName.includes(term) ||
      (client.email || '').toLowerCase().includes(term) ||
      (client.identityDocument?.number || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentDisplayedClients = filteredClients.slice(startIndex, endIndex);

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


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>
      <Separator />
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <Input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md shadow-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-xl text-muted-foreground">{t('loadingClients')}</p>
        </div>
      ) : currentDisplayedClients.length > 0 ? (
        <>
          <ClientListTable 
              clients={currentDisplayedClients} 
              onEdit={handleNavigateToEditClient}
              onToggleActive={openConfirmToggleActiveDialog} 
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Button 
                variant="outline" 
                size="icon"
                onClick={handlePrevPage} 
                disabled={currentPage === 1}
                aria-label={commonT('paginationPreviousAriaLabel')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {commonT('paginationPageInfo', { currentPage, totalPages })}
              </span>
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleNextPage} 
                disabled={currentPage === totalPages}
                aria-label={commonT('paginationNextAriaLabel')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground">
            {clients.length === 0 && searchTerm === '' ? t('noClientsFoundDB') : t('noClientsFoundCriteria')}
          </p>
        </div>
      )}

      <AlertDialog open={isConfirmToggleActiveDialogOpen} onOpenChange={setIsConfirmToggleActiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {clientToToggleActive?.isActive 
                ? t('ConfirmDeactivateDialog.title') 
                : t('ConfirmActivateDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clientToToggleActive?.isActive
                ? t('ConfirmDeactivateDialog.description', { clientName: `${clientToToggleActive?.firstName} ${clientToToggleActive?.lastName}` })
                : t('ConfirmActivateDialog.description', { clientName: `${clientToToggleActive?.firstName} ${clientToToggleActive?.lastName}` })
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClientToToggleActive(null)}>{commonT('paginationCancelButton')}</AlertDialogCancel> 
            <AlertDialogAction 
              onClick={handleToggleClientActive}
              className={clientToToggleActive?.isActive ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}
            >
              {clientToToggleActive?.isActive ? t('ConfirmDeactivateDialog.confirmButton') : t('ConfirmActivateDialog.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
