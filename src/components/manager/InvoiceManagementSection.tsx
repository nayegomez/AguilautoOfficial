
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Invoice, InvoiceServiceItem, ServiceCatalogItem, Client, InvoiceStatus } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, FileText, Download, Trash2, Loader2, Edit, MessageSquare, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp, getDoc, getDocs, query, where } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useTranslations } from 'next-intl';

const VAT_RATE = 0.21;

const invoiceServiceItemSchema = z.object({
  serviceCatalogId: z.string().optional(),
  description: z.string().min(1, { message: "La descripción del servicio es obligatoria." }),
  quantity: z.coerce.number().min(0.01, { message: "La cantidad debe ser mayor que 0." }),
  unitPrice: z.coerce.number().min(0, { message: "El precio unitario no puede ser negativo." }),
});

const manageInvoiceFormSchema = z.object({
  invoiceNumber: z.string().min(1, { message: "El número de factura es obligatorio." }),
  date: z.string().min(1, { message: "La fecha es obligatoria." }),
  status: z.enum(['pending', 'paid', 'overdue'] as [InvoiceStatus, ...InvoiceStatus[]], { required_error: "El estado de la factura es obligatorio."}),
  notes: z.string().optional().or(z.literal('')),
  invoiceServices: z.array(invoiceServiceItemSchema).min(1, { message: "Debe añadir al menos un servicio a la factura." }),
  pdfFile: z.instanceof(File).optional().nullable(),
});

type ManageInvoiceFormValues = z.infer<typeof manageInvoiceFormSchema>;

interface ManageInvoiceFormDialogProps {
  vehicleId: string;
  clientId: string;
  invoiceToEdit?: Invoice | null;
  onInvoiceSaved: (savedInvoice: Invoice) => void;
  closeDialog: () => void;
}

function ManageInvoiceFormDialog({ vehicleId, clientId: vehicleOwnerClientId, invoiceToEdit, onInvoiceSaved, closeDialog }: ManageInvoiceFormDialogProps) {
  const t_form = useTranslations('InvoiceManagementSection.ManageInvoiceForm');
  const t_section = useTranslations('InvoiceManagementSection'); 
  const commonT_formDialog = useTranslations(); 
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [serviceCatalogItems, setServiceCatalogItems] = useState<ServiceCatalogItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  const isEditMode = !!invoiceToEdit;

  const form = useForm<ManageInvoiceFormValues>({
    resolver: zodResolver(manageInvoiceFormSchema),
    defaultValues: {
      invoiceNumber: "",
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: "",
      invoiceServices: [{ description: "", quantity: 1, unitPrice: 0, serviceCatalogId: undefined }],
      pdfFile: null,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "invoiceServices",
  });

  useEffect(() => {
    const initialFormValues: ManageInvoiceFormValues = {
        invoiceNumber: "",
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        notes: "",
        invoiceServices: [{ description: "", quantity: 1, unitPrice: 0, serviceCatalogId: undefined }],
        pdfFile: null,
    };
    let initialSelectedFileName: string | null = null;

    if (isEditMode && invoiceToEdit) {
      initialFormValues.invoiceNumber = invoiceToEdit.invoiceNumber || "";
      initialFormValues.date = invoiceToEdit.date instanceof Timestamp ? invoiceToEdit.date.toDate().toISOString().split('T')[0] : (invoiceToEdit.date ? String(invoiceToEdit.date) : new Date().toISOString().split('T')[0]);
      initialFormValues.status = invoiceToEdit.status || 'pending';
      initialFormValues.notes = invoiceToEdit.notes || "";
      initialFormValues.invoiceServices = invoiceToEdit.services?.map(s => ({
        description: s.description || "",
        quantity: s.quantity || 1,
        unitPrice: s.unitPrice || 0,
        serviceCatalogId: s.serviceCatalogId || undefined,
      })) || [{ description: "", quantity: 1, unitPrice: 0, serviceCatalogId: undefined }];

      if (invoiceToEdit.pdfUrl) {
        initialSelectedFileName = invoiceToEdit.pdfPath?.split('/').pop() || invoiceToEdit.pdfUrl.split('/').pop()?.split('?')[0] || 'Archivo existente';
      }
    }
    form.reset(initialFormValues);
    setSelectedFileName(initialSelectedFileName);
  }, [invoiceToEdit, form, isEditMode]);


  useEffect(() => {
    const fetchServiceCatalog = async () => {
      setIsLoadingCatalog(true);
      try {
        const q = query(collection(db, "serviceCatalog"), where("isActive", "==", true));
        const querySnapshot = await getDocs(q);
        const items = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ServiceCatalogItem));
        setServiceCatalogItems(items);
      } catch (error) {
        console.error("Error fetching service catalog:", error);
        toast({ title: t_section('toastErrorTitle'), description: t_section('toastErrorLoadingCatalog'), variant: 'destructive' });
        setServiceCatalogItems([]);
      } finally {
        setIsLoadingCatalog(false);
      }
    };
    fetchServiceCatalog();
  }, [toast, t_section]);

  const handleServiceCatalogChange = (value: string, index: number) => {
    const selectedService = serviceCatalogItems.find(s => s.id === value);
    if (selectedService) {
      form.setValue(`invoiceServices.${index}.description`, selectedService.description || selectedService.name);
      form.setValue(`invoiceServices.${index}.unitPrice`, selectedService.defaultUnitPrice || 0);
    }
  };

  const onSubmit = async (values: ManageInvoiceFormValues) => {
    setIsSubmitting(true);
    if (!vehicleId) {
        toast({ title: "Error de configuración", description: "Falta ID de vehículo.", variant: "destructive"});
        setIsSubmitting(false);
        return;
    }
    
    const clientIdForInvoice = isEditMode && invoiceToEdit ? invoiceToEdit.clientId : vehicleOwnerClientId;
    if (!clientIdForInvoice) {
        toast({ title: "Error de configuración", description: "Falta ID del cliente para la factura.", variant: "destructive"});
        setIsSubmitting(false);
        return;
    }


    let updatedPdfUrl: string | null = (isEditMode && invoiceToEdit?.pdfUrl) ? invoiceToEdit.pdfUrl : null;
    let updatedPdfPath: string | null = (isEditMode && invoiceToEdit?.pdfPath) ? invoiceToEdit.pdfPath : null;

    if (values.pdfFile) {
      toast({ title: t_form('toastUploadingPDFTitle'), description: t_form('toastUploadingPDFDescription') });
      try {
        if (isEditMode && invoiceToEdit?.pdfPath) {
          try {
            const oldPdfRef = storageRef(storage, invoiceToEdit.pdfPath);
            await deleteObject(oldPdfRef);
            toast({ title: t_form('toastOldPDFDeletedTitle'), description: t_form('toastOldPDFDeletedDescription') });
          } catch (deleteOldError: any) {
            console.warn("[onSubmit] No se pudo borrar el PDF antiguo, puede que no exista o haya otro error:", deleteOldError.message);
          }
        }

        const file = values.pdfFile;
        const pdfFileName = `${values.invoiceNumber || Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const newPdfStoragePath = `invoice_pdfs/${vehicleId}/${pdfFileName}`;
        const newPdfFileRef = storageRef(storage, newPdfStoragePath);

        await uploadBytes(newPdfFileRef, file);
        updatedPdfUrl = await getDownloadURL(newPdfFileRef);
        updatedPdfPath = newPdfStoragePath;
        toast({ title: t_form('toastUploadPDFSuccessTitle'), description: t_form('toastUploadPDFSuccessDescription') });
      } catch (uploadError: any) {
        toast({
          title: t_form('toastUploadPDFErrorTitle'),
          description: `${t_form('toastUploadPDFErrorDescription')} ${uploadError.message}`,
          variant: "destructive",
        });
        if (!isEditMode) {
            updatedPdfUrl = null;
            updatedPdfPath = null;
        }
      }
    } else {
        if (!isEditMode) {
            updatedPdfUrl = null;
            updatedPdfPath = null;
        }
    }

    const processedServices: InvoiceServiceItem[] = values.invoiceServices.map(item => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      return {
        serviceCatalogId: item.serviceCatalogId || undefined,
        description: item.description,
        quantity,
        unitPrice,
        total: parseFloat((quantity * unitPrice).toFixed(2)),
      };
    });

    const subtotalAmount = parseFloat(processedServices.reduce((sum, item) => sum + item.total, 0).toFixed(2));
    const vatAmount = parseFloat((subtotalAmount * VAT_RATE).toFixed(2));
    const totalAmount = parseFloat((subtotalAmount + vatAmount).toFixed(2));

    try {
      const dateParts = values.date.split('-');
      const invoiceDateForDB = Timestamp.fromDate(new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2])));

      const currentTimestamp = serverTimestamp();

      const finalPdfUrlForDB = updatedPdfUrl === undefined ? null : updatedPdfUrl;
      const finalPdfPathForDB = updatedPdfPath === undefined ? null : updatedPdfPath;

      let finalPayload: Partial<Omit<Invoice, 'id'>>;
      let savedInvoiceData: Invoice; 

      if (isEditMode && invoiceToEdit?.id) {
        finalPayload = {
          vehicleId,
          clientId: invoiceToEdit.clientId, 
          invoiceNumber: values.invoiceNumber,
          date: invoiceDateForDB,
          status: values.status,
          notes: values.notes || null,
          services: processedServices,
          subtotalAmount,
          vatAmount,
          totalAmount,
          pdfUrl: finalPdfUrlForDB,
          pdfPath: finalPdfPathForDB,
          updatedAt: currentTimestamp,
        };
         await updateDoc(doc(db, "invoices", invoiceToEdit.id), finalPayload as any);
         savedInvoiceData = {
            ...invoiceToEdit,
            ...(finalPayload as Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>),
            date: invoiceDateForDB,
            notes: finalPayload.notes,
            status: finalPayload.status as InvoiceStatus,
            updatedAt: Timestamp.now(),
        } as Invoice;
        toast({
          title: t_form('toastUpdateSuccessTitle'),
          description: t_form('toastUpdateSuccessDescription', { invoiceNumber: values.invoiceNumber }),
          duration: 5000,
        });
      } else {
        finalPayload = {
          vehicleId,
          clientId: clientIdForInvoice, 
          invoiceNumber: values.invoiceNumber,
          date: invoiceDateForDB,
          status: values.status,
          notes: values.notes || null,
          services: processedServices,
          subtotalAmount,
          vatAmount,
          totalAmount,
          pdfUrl: finalPdfUrlForDB,
          pdfPath: finalPdfPathForDB,
          createdAt: currentTimestamp,
          updatedAt: currentTimestamp,
        };
        const docRef = await addDoc(collection(db, "invoices"), finalPayload);
        savedInvoiceData = {
            id: docRef.id,
            ...(finalPayload as Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>),
            date: invoiceDateForDB,
            notes: finalPayload.notes,
            status: finalPayload.status as InvoiceStatus,
            clientId: clientIdForInvoice,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        } as Invoice;
        toast({
          title: t_form('toastCreateSuccessTitle'),
          description: t_form('toastCreateSuccessDescription', { invoiceNumber: values.invoiceNumber }),
          duration: 5000,
        });
      }

      onInvoiceSaved(savedInvoiceData);
      form.reset();
      setSelectedFileName(null);
      closeDialog();

    } catch (error: any) {
      console.error("[onSubmit] Error general al guardar factura:", error);
      toast({
        title: t_section('toastErrorTitle'),
        description: `${t_section('toastErrorDescriptionSaving')} ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="invoiceNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t_form('formInvoiceNumber')}</FormLabel>
                <FormControl><Input {...field} placeholder="INV-001" disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t_form('formDate')}</FormLabel>
                <FormControl><Input type="date" {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t_form('formStatusLabel')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t_form('formStatusPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pending">{commonT_formDialog('statusPending')}</SelectItem>
                    <SelectItem value="paid">{commonT_formDialog('statusPaid')}</SelectItem>
                    <SelectItem value="overdue">{commonT_formDialog('statusOverdue')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

        <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t_form('formNotesLabel')}</FormLabel>
                <FormControl><Textarea {...field} placeholder={t_form('formNotesPlaceholder')} rows={3} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        <div className="space-y-4">
          <FormLabel className="text-lg font-semibold">{t_form('formServicesTitle')}</FormLabel>
          {fields.map((item, index) => (
            <div key={item.id} className="flex flex-col gap-3 border p-4 rounded-md shadow-sm bg-secondary/30">
              <div className="flex justify-between items-center">
                <p className="font-medium">{t_form('formServiceItemTitle', { number: index + 1 })}</p>
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={isSubmitting} aria-label={t_form('formRemoveServiceButtonAria')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <FormField
                control={form.control}
                name={`invoiceServices.${index}.serviceCatalogId`}
                render={({ field: selectField }) => (
                  <FormItem>
                    <FormLabel>{t_form('formServiceCatalogItemLabel')}</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        if (['__placeholder__', '__loading__', '__no_services__'].includes(value)) {
                           selectField.onChange(undefined);
                        } else {
                           selectField.onChange(value);
                           handleServiceCatalogChange(value, index);
                        }
                      }}
                     value={selectField.value || (serviceCatalogItems.length > 0 ? "__placeholder__" : (isLoadingCatalog ? "__loading__" : "__no_services__"))}
                      disabled={isSubmitting || isLoadingCatalog}
                    >
                      <FormControl>
                        <SelectTrigger>
                           <SelectValue placeholder={isLoadingCatalog ? t_section('formLoadingServicesPlaceholder') : (serviceCatalogItems.length > 0 ? t_form('formServiceCatalogItemPlaceholder') : t_section('formNoServicesInCatalog'))} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingCatalog && <SelectItem value="__loading__" disabled>{t_section('formLoadingServicesPlaceholder')}</SelectItem>}
                        {!isLoadingCatalog && serviceCatalogItems.length === 0 && <SelectItem value="__no_services__" disabled>{t_section('formNoServicesInCatalog')}</SelectItem>}
                        {!isLoadingCatalog && serviceCatalogItems.length > 0 && (
                           <SelectItem value="__placeholder__" disabled>
                             {t_form('formServiceCatalogItemPlaceholder')}
                           </SelectItem>
                        )}
                        {serviceCatalogItems.map((service) => (
                          <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`invoiceServices.${index}.description`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t_form('formServiceDescriptionLabel')}</FormLabel>
                    <FormControl><Input {...field} placeholder={t_form('formServiceDescriptionPlaceholder')} disabled={isSubmitting} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={`invoiceServices.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t_form('formServiceQuantityLabel')}</FormLabel>
                      <FormControl><Input type="number" {...field} placeholder="1" step="0.01" disabled={isSubmitting} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`invoiceServices.${index}.unitPrice`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t_form('formServiceUnitPriceLabel')}</FormLabel>
                      <FormControl><Input type="number" {...field} placeholder="50.00" step="0.01" disabled={isSubmitting} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ description: "", quantity: 1, unitPrice: 0, serviceCatalogId: undefined })}
            disabled={isSubmitting}
            className="mt-2"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> {t_form('formAddServiceButton')}
          </Button>
        </div>

        <FormField
          control={form.control}
          name="pdfFile"
          render={({ field: { onChange, value, ...restField }}) => (
            <FormItem>
              <FormLabel>{t_form('formPdfFile')}</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    onChange(file || null);
                    setSelectedFileName(file?.name || (isEditMode && invoiceToEdit?.pdfUrl ? (invoiceToEdit.pdfPath?.split('/').pop() || invoiceToEdit.pdfUrl.split('/').pop()?.split('?')[0] || 'Archivo existente') : null) );
                  }}
                  disabled={isSubmitting}
                />
              </FormControl>
              {selectedFileName && <FormDescription>{t_form('formSelectedFile', { fileName: selectedFileName })}</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="pt-4">
           <Button type="button" variant="outline" onClick={() => {
               form.reset();
               setSelectedFileName(null);
               closeDialog();
            }}
            disabled={isSubmitting}>
            {t_section('cancelButton')}
          </Button>
          <Button type="submit" disabled={isSubmitting || isLoadingCatalog}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? t_form('formSavingInvoiceButton') : (isEditMode ? t_form('formUpdateInvoiceButton') : t_form('formAddInvoiceButton'))}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

interface InvoiceManagementSectionProps {
  vehicleId: string;
  clientId: string; 
  initialInvoices: Invoice[];
  onInvoiceAdded: (newInvoice: Invoice) => void;
  onInvoiceUpdated: (updatedInvoice: Invoice) => void;
  onInvoiceDeleted: (deletedInvoiceId: string) => void;
}

export function InvoiceManagementSection({
  vehicleId,
  clientId: vehicleOwnerClientId, 
  initialInvoices,
  onInvoiceAdded,
  onInvoiceUpdated,
  onInvoiceDeleted,
}: InvoiceManagementSectionProps) {
  const t_section = useTranslations('InvoiceManagementSection');
  const commonT = useTranslations(); 
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [isManageInvoiceDialogOpen, setIsManageInvoiceDialogOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [invoiceToDeleteId, setInvoiceToDeleteId] = useState<string | null>(null);
  const [invoiceToDeletePdfPath, setInvoiceToDeletePdfPath] = useState<string | null>(null);


  useEffect(() => {
    setInvoices(initialInvoices.sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0)));
  }, [initialInvoices]);

  const getStatusDisplay = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return <span className="flex items-center text-green-600"><CheckCircle2 className="mr-1 h-4 w-4" />{commonT('statusPaid')}</span>;
      case 'pending':
        return <span className="flex items-center text-red-600"><XCircle className="mr-1 h-4 w-4" />{commonT('statusPending')}</span>;
      case 'overdue':
        return <span className="flex items-center text-yellow-600"><AlertCircle className="mr-1 h-4 w-4" />{commonT('statusOverdue')}</span>;
      default:
        const translatedStatus = commonT(`status${status.charAt(0).toUpperCase() + status.slice(1)}` as any, {}, {
          fallback: () => status 
        });
        return <span className="text-muted-foreground">{translatedStatus}</span>;
    }
  };


  const handleOpenAddDialog = () => {
    setInvoiceToEdit(null);
    setIsManageInvoiceDialogOpen(true);
  };

  const handleOpenEditDialog = (invoice: Invoice) => {
    setInvoiceToEdit(invoice);
    setIsManageInvoiceDialogOpen(true);
  };

  const handleInvoiceSaved = (savedInvoice: Invoice) => {
    if (invoiceToEdit) {
      setInvoices(prev => prev.map(inv => inv.id === savedInvoice.id ? savedInvoice : inv).sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0)));
      if (onInvoiceUpdated) onInvoiceUpdated(savedInvoice);
    } else {
      setInvoices(prev => [savedInvoice, ...prev].sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0)));
      if (onInvoiceAdded) onInvoiceAdded(savedInvoice);
    }
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDeleteId) return;

    try {

      if (invoiceToDeletePdfPath) {
        const pdfFileRef = storageRef(storage, invoiceToDeletePdfPath);
        try {
          await deleteObject(pdfFileRef);
          toast({ title: t_section('toastDeletePDFSuccessTitle'), description: t_section('toastDeletePDFSuccessDescription') });
        } catch (storageError: any) {
          console.error("Error deleting PDF from Storage:", storageError);
          if (storageError.code === 'storage/object-not-found') {
            toast({ title: t_section('toastDeletePDFErrorTitle'), description: "El archivo PDF asociado no se encontró en el almacenamiento. Puede que ya haya sido eliminado.", variant: "default" });
          } else {
            toast({ title: t_section('toastDeletePDFErrorTitle'), description: `${t_section('toastDeletePDFErrorDescription')} ${storageError.message}`, variant: "destructive" });
          }
        }
      }

      await deleteDoc(doc(db, "invoices", invoiceToDeleteId));

      setInvoices(prev => prev.filter(inv => inv.id !== invoiceToDeleteId));
      if (onInvoiceDeleted) onInvoiceDeleted(invoiceToDeleteId);
      toast({ title: t_section('toastDeleteInvoiceSuccessTitle'), description: t_section('toastDeleteInvoiceSuccessDescription') });

    } catch (error: any) {
      console.error("Error deleting invoice:", error);
      toast({ title: t_section('toastErrorTitle'), description: `${t_section('toastDeleteInvoiceErrorDescription')} ${error.message}`, variant: "destructive" });
    } finally {
      setIsConfirmDeleteDialogOpen(false);
      setInvoiceToDeleteId(null);
      setInvoiceToDeletePdfPath(null);
    }
  };

  const formatDateForDisplay = (dateValue: Timestamp | string | Date | undefined): string => {
    if (!dateValue) return t_section('notAvailable');
    try {
      const date = (dateValue instanceof Timestamp) ? dateValue.toDate() : new Date(dateValue as string | Date);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
      }
      return String(dateValue);
    } catch (e) {
      return String(dateValue);
    }
  };

  const closeInvoiceDialog = () => {
    setIsManageInvoiceDialogOpen(false);
    setInvoiceToEdit(null);
  };

  const handleNotifyClient = async (invoice: Invoice) => {
    if (!invoice.clientId) {
      toast({ title: t_section('toastErrorTitle'), description: t_section('whatsappClientNotFound'), variant: "destructive" });
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
          console.log(`[handleNotifyClient] No phone number found for client ID: ${invoice.clientId}`);
          toast({ title: t_section('toastErrorTitle'), description: t_section('whatsappClientPhoneNotFound'), variant: "warning" });
        }
      } else {
        console.log(`[handleNotifyClient] Client document not found for ID: ${invoice.clientId}`);
        toast({ title: t_section('toastErrorTitle'), description: t_section('whatsappClientNotFound'), variant: "destructive" });
      }
    } catch (error) {
      console.error("[handleNotifyClient] Error fetching client data or processing WhatsApp notification:", error);
      toast({ title: t_section('toastErrorTitle'), description: "Error al procesar la notificación para WhatsApp.", variant: "destructive" });
    }
  };


  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row justify-between items-start sm:items-center">
        <div className="flex-grow">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">{t_section('title')}</CardTitle>
          </div>
          <CardDescription>{t_section('description')}</CardDescription>
        </div>
        <Dialog
            open={isManageInvoiceDialogOpen}
            onOpenChange={(isOpen) => {
                setIsManageInvoiceDialogOpen(isOpen);
                if (!isOpen) {
                    setInvoiceToEdit(null);
                }
            }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" onClick={handleOpenAddDialog} className="mt-2 sm:mt-0 sm:ml-4 flex-shrink-0">
              <PlusCircle className="mr-2 h-4 w-4" /> {t_section('addNewInvoice')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle>{invoiceToEdit ? t_section('ManageInvoiceForm.dialogTitleEdit') : t_section('ManageInvoiceForm.dialogTitleAdd')}</DialogTitle>
              <DialogDescription>{t_section('ManageInvoiceForm.dialogDescription')}</DialogDescription>
            </DialogHeader>
            <ManageInvoiceFormDialog
              vehicleId={vehicleId}
              clientId={vehicleOwnerClientId} 
              invoiceToEdit={invoiceToEdit}
              onInvoiceSaved={handleInvoiceSaved}
              closeDialog={closeInvoiceDialog}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t_section('tableInvoiceNumberHeader')}</TableHead>
                <TableHead>{t_section('tableDateHeader')}</TableHead>
                <TableHead>{t_section('tableStatusHeader')}</TableHead>
                <TableHead>{t_section('tableSubtotalHeader')}</TableHead>
                <TableHead>{t_section('tableVatHeader')}</TableHead>
                <TableHead>{t_section('tableTotalAmountHeader')}</TableHead>
                <TableHead>{t_section('tablePdfHeader')}</TableHead>
                <TableHead className="text-right">{t_section('tableActionsHeader')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{formatDateForDisplay(invoice.date)}</TableCell>
                  <TableCell>{getStatusDisplay(invoice.status)}</TableCell>
                  <TableCell>{(invoice.subtotalAmount ?? 0).toFixed(2)}€</TableCell>
                  <TableCell>{(invoice.vatAmount ?? 0).toFixed(2)}€</TableCell>
                  <TableCell className="font-semibold">{(invoice.totalAmount ?? 0).toFixed(2)}€</TableCell>
                  <TableCell>
                    {invoice.pdfUrl && invoice.pdfUrl !== '#' ? (
                      <Link href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                        {t_section('viewPdf')}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t_section('notAvailable')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handleNotifyClient(invoice)}
                        aria-label={t_section('notifyClientWhatsAppAriaLabel', {invoiceNumber: invoice.invoiceNumber})}
                        disabled={!invoice.clientId}
                    >
                        <MessageSquare className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(invoice)} aria-label={t_section('editInvoiceAriaLabel', {invoiceNumber: invoice.invoiceNumber})}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" asChild disabled={!invoice.pdfUrl || invoice.pdfUrl === '#' || !invoice.pdfUrl.startsWith('http')}>
                      <Link href={invoice.pdfUrl || '#'} target="_blank" rel="noopener noreferrer" aria-label={t_section('downloadAriaLabel', {invoiceNumber: invoice.invoiceNumber })}>
                        <Download className="h-4 w-4" />
                      </Link>
                    </Button>
                    <AlertDialog open={isConfirmDeleteDialogOpen && invoiceToDeleteId === invoice.id} onOpenChange={(open) => { if(!open) {setIsConfirmDeleteDialogOpen(false); setInvoiceToDeleteId(null); setInvoiceToDeletePdfPath(null); }}}>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" onClick={() => {
                                setInvoiceToDeleteId(invoice.id);
                                setInvoiceToDeletePdfPath(invoice.pdfPath || null);
                                setIsConfirmDeleteDialogOpen(true);
                            }}
                            aria-label={t_section('deleteInvoiceAriaLabel', {invoiceNumber: invoice.invoiceNumber})}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t_section('ConfirmDeleteDialog.title')}</AlertDialogTitle>
                            <AlertDialogDescription>
                            {t_section('ConfirmDeleteDialog.description')}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {
                                setIsConfirmDeleteDialogOpen(false);
                                setInvoiceToDeleteId(null);
                                setInvoiceToDeletePdfPath(null);
                            }}>{t_section('ConfirmDeleteDialog.cancelButton')}</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDeleteInvoice} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                            {t_section('ConfirmDeleteDialog.confirmButton')}
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
        ) : (
          <p className="text-muted-foreground text-center py-4">{t_section('noInvoices')}</p>
        )}
      </CardContent>
    </Card>
  );
}

