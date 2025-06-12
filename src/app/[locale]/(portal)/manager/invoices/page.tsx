
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Invoice, Client, Vehicle, InvoiceStatus } from '@/types';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc, Timestamp, query, orderBy as firestoreOrderBy, where, documentId, getDoc } from 'firebase/firestore';
import { ref as storageRefFirebase, deleteObject } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileText, MessageSquare, Edit3, Trash2, Filter, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight, Users } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

interface EnrichedInvoice extends Invoice {
  clientName?: string;
  vehicleIdentifier?: string;
}

const ITEMS_PER_PAGE = 10;
const FIRESTORE_IN_CLAUSE_LIMIT = 30;

async function getDocumentsInBatches<T extends {id: string}>(collectionName: string, ids: string[]): Promise<Map<string, T>> {
  const resultsMap = new Map<string, T>();
  if (ids.length === 0) return resultsMap;

  const idChunks: string[][] = [];
  for (let i = 0; i < ids.length; i += FIRESTORE_IN_CLAUSE_LIMIT) {
    idChunks.push(ids.slice(i, i + FIRESTORE_IN_CLAUSE_LIMIT));
  }

  for (const chunk of idChunks) {
    if (chunk.length > 0) {
      const q = query(collection(db, collectionName), where(documentId(), "in", chunk));
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(docSnap => {
        resultsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as T);
      });
    }
  }
  return resultsMap;
}


export default function ManagerInvoicesPage() {
  const t = useTranslations('ManagerInvoicesPage');
  const commonT = useTranslations();
  const { toast } = useToast();
  const router = useRouter();

  const [allInvoices, setAllInvoices] = useState<EnrichedInvoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | 'all'>('all');
  const [filterClient, setFilterClient] = useState<string | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [invoiceToDelete, setInvoiceToDelete] = useState<EnrichedInvoice | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const fetchInvoicesData = useCallback(async () => {
    setIsLoading(true);
    try {
      const invoicesSnapshot = await getDocs(query(collection(db, "invoices"), firestoreOrderBy("date", "desc")));
      const invoicesData = invoicesSnapshot.docs.map(docSnap => {
        const invoiceRaw = docSnap.data();
        return { 
          id: docSnap.id, 
          ...invoiceRaw,
          date: invoiceRaw.date instanceof Timestamp ? invoiceRaw.date : Timestamp.fromDate(new Date(invoiceRaw.date?.seconds * 1000 || Date.now())),
          createdAt: invoiceRaw.createdAt instanceof Timestamp ? invoiceRaw.createdAt : Timestamp.fromDate(new Date(invoiceRaw.createdAt?.seconds * 1000 || Date.now())),
          updatedAt: invoiceRaw.updatedAt instanceof Timestamp ? invoiceRaw.updatedAt : Timestamp.fromDate(new Date(invoiceRaw.updatedAt?.seconds * 1000 || Date.now())),
        } as Invoice;
      });

      const allClientsSnapshot = await getDocs(query(collection(db, "clients"), firestoreOrderBy("lastName", "asc"), firestoreOrderBy("firstName", "asc")));
      const allClientsData = allClientsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Client));
      setClients(allClientsData);

      if (invoicesData.length === 0) {
        setAllInvoices([]);
        setIsLoading(false);
        return;
      }

      const uniqueClientIdsForEnrichment = Array.from(new Set(invoicesData.map(inv => inv.clientId).filter(id => !!id)));
      const uniqueVehicleIds = Array.from(new Set(invoicesData.map(inv => inv.vehicleId).filter(id => !!id)));

      const clientsMapForEnrichment = new Map(allClientsData.map(client => [client.id, client]));
      const vehiclesMap = await getDocumentsInBatches<Vehicle>("vehicles", uniqueVehicleIds);

      const enrichedInvoicesData = invoicesData.map(invoice => {
        const client = clientsMapForEnrichment.get(invoice.clientId);
        const vehicle = vehiclesMap.get(invoice.vehicleId);
        return {
          ...invoice,
          clientName: client ? `${client.firstName} ${client.lastName}` : 'N/A',
          vehicleIdentifier: vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})` : 'N/A',
        };
      });
      setAllInvoices(enrichedInvoicesData);
    } catch (error) {
      console.error("Error fetching invoices data:", error);
      toast({
        title: t('toastErrorLoadingData'),
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    fetchInvoicesData();
  }, [fetchInvoicesData]);

  const filteredInvoices = useMemo(() => {
    return allInvoices.filter(invoice => {
      const statusMatch = filterStatus === 'all' || invoice.status === filterStatus;
      const clientMatch = filterClient === 'all' || invoice.clientId === filterClient;
      return statusMatch && clientMatch;
    });
  }, [allInvoices, filterStatus, filterClient]);

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  const getStatusDisplay = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />{commonT('statusPaid')}</Badge>;
      case 'pending':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3.5 w-3.5" />{commonT('statusPending')}</Badge>;
      case 'overdue':
        return <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600 text-black"><AlertCircle className="mr-1 h-3.5 w-3.5" />{commonT('statusOverdue')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateValue: Timestamp | string | Date | undefined): string => {
    if (!dateValue) return 'N/A';
    const date = (dateValue instanceof Timestamp) ? dateValue.toDate() : new Date(dateValue as string | Date);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
  };
  
  const handleEditInvoice = (invoice: EnrichedInvoice) => {
    router.push(`/manager/vehicle/${invoice.vehicleId}?editInvoice=${invoice.id}`);
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    try {
      if (invoiceToDelete.pdfPath) {
        const pdfFileRef = storageRefFirebase(storage, invoiceToDelete.pdfPath);
        try {
          await deleteObject(pdfFileRef);
        } catch (storageError: any) {
          console.warn("Error deleting PDF from Storage, it might not exist:", storageError);
        }
      }
      await deleteDoc(doc(db, "invoices", invoiceToDelete.id));
      toast({
        title: t('toastDeleteSuccessTitle'),
        description: t('toastDeleteSuccessDescription', { invoiceNumber: invoiceToDelete.invoiceNumber }),
      });
      fetchInvoicesData(); 
    } catch (error) {
      toast({
        title: t('toastDeleteErrorTitle'),
        description: t('toastDeleteErrorDescription', { error: (error as Error).message }),
        variant: "destructive",
      });
    } finally {
      setIsConfirmDeleteOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const handleNotifyClient = async (invoice: EnrichedInvoice) => {
    if (!invoice.clientId) {
      toast({ title: commonT('InvoiceManagementSection.toastErrorTitle'), description: commonT('InvoiceManagementSection.whatsappClientNotFound'), variant: "destructive" });
      return;
    }
    try {
      const clientDocRef = doc(db, "clients", invoice.clientId);
      const clientSnap = await getDoc(clientDocRef); 
      if (clientSnap.exists()) {
        const clientData = clientSnap.data() as Client;
        const clientPhone = clientData.phone1;
        if (clientPhone) {
          const cleanedPhone = clientPhone.replace(/[^0-9]/g, '');
          const formattedTotalAmount = `${invoice.totalAmount.toFixed(2)}€`;
          const whatsappMessage = commonT('InvoiceManagementSection.whatsappNotificationMessage', {
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: formattedTotalAmount
          });
          const whatsappLink = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(whatsappMessage)}`;
          window.open(whatsappLink, '_blank');
        } else {
          toast({ title: commonT('InvoiceManagementSection.toastErrorTitle'), description: commonT('InvoiceManagementSection.whatsappClientPhoneNotFound'), variant: "warning" });
        }
      } else {
        toast({ title: commonT('InvoiceManagementSection.toastErrorTitle'), description: commonT('InvoiceManagementSection.whatsappClientNotFound'), variant: "destructive" });
      }
    } catch (error) {
      toast({ title: commonT('InvoiceManagementSection.toastErrorTitle'), description: (error as Error).message, variant: "destructive" });
    }
  };


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>
      <Separator />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <label htmlFor="status-filter" className="text-sm font-medium text-muted-foreground">
            {t('filterByStatusLabel')}
            </label>
            <Select
            value={filterStatus}
            onValueChange={(value) => {
                setFilterStatus(value as InvoiceStatus | 'all');
                setCurrentPage(1); 
            }}
            >
            <SelectTrigger id="status-filter" className="w-[180px] shadow-sm">
                <SelectValue placeholder={t('filterStatusAll')} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">{t('filterStatusAll')}</SelectItem>
                <SelectItem value="pending">{commonT('statusPending')}</SelectItem>
                <SelectItem value="paid">{commonT('statusPaid')}</SelectItem>
                <SelectItem value="overdue">{commonT('statusOverdue')}</SelectItem>
            </SelectContent>
            </Select>
        </div>
        <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <label htmlFor="client-filter" className="text-sm font-medium text-muted-foreground">
            {t('filterByClientLabel')}
            </label>
            <Select
                value={filterClient}
                onValueChange={(value) => {
                    setFilterClient(value);
                    setCurrentPage(1);
                }}
                disabled={isLoading || clients.length === 0}
            >
                <SelectTrigger id="client-filter" className="w-full sm:w-[250px] shadow-sm">
                    <SelectValue placeholder={clients.length === 0 && !isLoading ? "No clients found" : t('filterClientAll')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('filterClientAll')}</SelectItem>
                    {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                        {client.firstName} {client.lastName} ({client.email})
                    </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-xl text-muted-foreground">{t('loadingInvoices')}</p>
        </div>
      ) : paginatedInvoices.length > 0 ? (
        <>
        <div className="rounded-lg border shadow-sm bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tableHeaderInvoiceNo')}</TableHead>
                <TableHead>{t('tableHeaderDate')}</TableHead>
                <TableHead>{t('tableHeaderClient')}</TableHead>
                <TableHead>{t('tableHeaderVehicle')}</TableHead>
                <TableHead>{t('tableHeaderStatus')}</TableHead>
                <TableHead className="text-right">{t('tableHeaderTotal')}</TableHead>
                <TableHead className="text-right">{t('tableHeaderActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{formatDate(invoice.date)}</TableCell>
                  <TableCell>{invoice.clientName}</TableCell>
                  <TableCell>{invoice.vehicleIdentifier}</TableCell>
                  <TableCell>{getStatusDisplay(invoice.status)}</TableCell>
                  <TableCell className="text-right font-semibold">€{invoice.totalAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="outline" size="icon" onClick={() => handleNotifyClient(invoice)} aria-label={t('actionNotifyClient')}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleEditInvoice(invoice)} aria-label={t('actionEditInvoice')}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <AlertDialog open={isConfirmDeleteOpen && invoiceToDelete?.id === invoice.id} onOpenChange={(open) => { if(!open) {setIsConfirmDeleteOpen(false); setInvoiceToDelete(null); }}}>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" onClick={() => { setInvoiceToDelete(invoice); setIsConfirmDeleteOpen(true);}} aria-label={t('actionDeleteInvoice')}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('confirmDeleteTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('confirmDeleteDescription', { invoiceNumber: invoiceToDelete?.invoiceNumber || '' })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setInvoiceToDelete(null)}>{commonT('paginationCancelButton')}</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteInvoice} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                            {commonT('InvoiceManagementSection.ConfirmDeleteDialog.confirmButton')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground">
            {allInvoices.length === 0 ? t('noInvoicesFoundDB') : t('noInvoicesFoundCriteria')}
          </p>
        </div>
      )}
    </div>
  );
}

