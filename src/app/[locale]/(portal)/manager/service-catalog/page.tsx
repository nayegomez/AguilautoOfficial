
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { ServiceCatalogItem } from '@/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Loader2, BookMarked, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { ServiceCatalogListTable } from '@/components/manager/ServiceCatalogListTable';
import { AddEditServiceCatalogItemForm } from '@/components/manager/AddEditServiceCatalogItemForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const ITEMS_PER_PAGE = 10; 

export default function ManagerServiceCatalogPage() {
  const t_page = useTranslations('ManagerServiceCatalogPage');
  const t_pagination = useTranslations(); 
  const { toast } = useToast();

  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceCatalogItem | null>(null);

  const [isConfirmToggleActiveDialogOpen, setIsConfirmToggleActiveDialogOpen] = useState(false);
  const [serviceToToggleActive, setServiceToToggleActive] = useState<ServiceCatalogItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "serviceCatalog"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const servicesData = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as ServiceCatalogItem));
      setServices(servicesData);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({
        title: t_page('AddEditServiceForm.toastErrorTitle'),
        description: t_page('AddEditServiceForm.toastErrorGeneric', { error: (error as Error).message }),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, t_page]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleServiceSaved = (savedService: ServiceCatalogItem) => {
    if (editingService) {
      setServices(prev => prev.map(s => (s.id === savedService.id ? savedService : s)));
    } else {
      setServices(prev => [savedService, ...prev].sort((a,b) => (a.name || "").localeCompare(b.name || "")));
    }
    setIsFormOpen(false);
    setEditingService(null);
  };

  const handleOpenEditDialog = (service: ServiceCatalogItem) => {
    setEditingService(service);
    setIsFormOpen(true);
  };

  const handleOpenAddDialog = () => {
    setEditingService(null);
    setIsFormOpen(true);
  };

  const handleToggleServiceActive = async () => {
    if (!serviceToToggleActive) return;

    const newIsActiveStatus = !serviceToToggleActive.isActive;
    try {
      const serviceRef = doc(db, "serviceCatalog", serviceToToggleActive.id);
      await updateDoc(serviceRef, { 
        isActive: newIsActiveStatus,
        updatedAt: serverTimestamp(),
      });
      setServices(prev => 
        prev.map(s => s.id === serviceToToggleActive.id ? { ...s, isActive: newIsActiveStatus, updatedAt: new Date() as any } : s)
      );
      toast({
        title: newIsActiveStatus ? t_page('toastActivateSuccess', { serviceName: serviceToToggleActive.name }) : t_page('toastDeactivateSuccess', { serviceName: serviceToToggleActive.name }),
      });
    } catch (error) {
      console.error("Error toggling service active status:", error);
      toast({
        title: t_page('AddEditServiceForm.toastErrorTitle'),
        description: t_page('toastToggleStatusError', { error: (error as Error).message }),
        variant: "destructive",
      });
    } finally {
      setIsConfirmToggleActiveDialogOpen(false);
      setServiceToToggleActive(null);
    }
  };

  const openConfirmToggleActiveDialog = (service: ServiceCatalogItem) => {
    setServiceToToggleActive(service);
    setIsConfirmToggleActiveDialogOpen(true);
  };

  const filteredServices = services.filter(service => {
    const term = searchTerm.toLowerCase();
    return (
      (service.name || '').toLowerCase().includes(term) ||
      (service.category || '').toLowerCase().includes(term) ||
      (service.description || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredServices.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentDisplayedServices = filteredServices.slice(startIndex, endIndex);

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
        <h1 className="text-3xl font-bold tracking-tight text-primary">{t_page('title')}</h1>
        <p className="text-muted-foreground mt-1">{t_page('description')}</p>
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
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
            setIsFormOpen(isOpen);
            if (!isOpen) setEditingService(null);
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenAddDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> {t_page('addNewServiceButton')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle>
                {editingService ? t_page('AddEditServiceForm.dialogTitleEdit') : t_page('AddEditServiceForm.dialogTitleAdd')}
              </DialogTitle>
              <DialogDescription>
                {t_page('AddEditServiceForm.dialogDescription')}
              </DialogDescription>
            </DialogHeader>
            <AddEditServiceCatalogItemForm
              serviceToEdit={editingService}
              onServiceSaved={handleServiceSaved}
              closeDialog={() => {
                setIsFormOpen(false);
                setEditingService(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-xl text-muted-foreground">{t_page('loadingServices')}</p>
        </div>
      ) : currentDisplayedServices.length > 0 ? (
        <>
          <ServiceCatalogListTable 
              services={currentDisplayedServices} 
              onEdit={handleOpenEditDialog} 
              onToggleActive={openConfirmToggleActiveDialog} 
          />
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
          <BookMarked className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground">
            {services.length === 0 && searchTerm === '' ? t_page('noServicesFoundDB') : t_page('noServicesFoundCriteria')}
          </p>
        </div>
      )}

      <AlertDialog open={isConfirmToggleActiveDialogOpen} onOpenChange={setIsConfirmToggleActiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {serviceToToggleActive?.isActive 
                ? t_page('ConfirmDeactivateDialog.title') 
                : t_page('ConfirmActivateDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {serviceToToggleActive?.isActive
                ? t_page('ConfirmDeactivateDialog.description', { serviceName: serviceToToggleActive?.name })
                : t_page('ConfirmActivateDialog.description', { serviceName: serviceToToggleActive?.name })
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setServiceToToggleActive(null)}>{t_pagination('paginationCancelButton')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleToggleServiceActive}
              className={serviceToToggleActive?.isActive ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}
            >
              {serviceToToggleActive?.isActive ? t_page('ConfirmDeactivateDialog.confirmButton') : t_page('ConfirmActivateDialog.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
