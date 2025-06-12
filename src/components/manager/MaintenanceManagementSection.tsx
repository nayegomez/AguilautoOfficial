
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { MaintenanceItem, ServiceCatalogItem } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Wrench, Trash2, Edit, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp, getDocs, query, where, orderBy } from "firebase/firestore";
import { useTranslations } from 'next-intl';

const maintenanceTaskSchema = z.object({
  text: z.string().min(1, "Task description is required."),
});

const maintenanceItemFormSchema = z.object({
  description: z.string().min(3, { message: "Main description must be at least 3 characters." }),
  serviceTasks: z.array(maintenanceTaskSchema).min(1, { message: "At least one service task is required." }),
  dueDate: z.string().optional().transform(val => val === "" ? undefined : val),
  dueMileage: z.coerce.number().min(0, { message: "Mileage cannot be negative."}).optional().nullable(),
  status: z.enum(['upcoming', 'due', 'completed']),
  notes: z.string().optional().transform(val => val === "" ? undefined : val),
});

type MaintenanceItemFormValues = z.infer<typeof maintenanceItemFormSchema>;

interface ManageMaintenanceItemFormDialogProps {
  vehicleId: string;
  clientId: string;
  itemToEdit?: MaintenanceItem | null;
  onItemSaved: (savedItem: MaintenanceItem) => void;
  closeDialog: () => void;
}

function ManageMaintenanceItemFormDialog({ vehicleId, clientId, itemToEdit, onItemSaved, closeDialog }: ManageMaintenanceItemFormDialogProps) {
  const t = useTranslations('MaintenanceManagementSection');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceCatalogItems, setServiceCatalogItems] = useState<ServiceCatalogItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  const isEditMode = !!itemToEdit;

  const form = useForm<MaintenanceItemFormValues>({
    resolver: zodResolver(maintenanceItemFormSchema),
    defaultValues: {
      description: itemToEdit?.description || "",
      serviceTasks: itemToEdit?.serviceTasks?.map(task => ({ text: task })) || [{ text: "" }],
      dueDate: itemToEdit?.dueDate instanceof Timestamp ? itemToEdit.dueDate.toDate().toISOString().split('T')[0] : (typeof itemToEdit?.dueDate === 'string' ? itemToEdit.dueDate : ""),
      dueMileage: itemToEdit?.dueMileage || null,
      status: itemToEdit?.status || 'upcoming',
      notes: itemToEdit?.notes || "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "serviceTasks",
  });

  useEffect(() => {
    const fetchServiceCatalog = async () => {
      setIsLoadingCatalog(true);
      try {
        const q = query(collection(db, "serviceCatalog"), where("isActive", "==", true), orderBy("name"));
        const querySnapshot = await getDocs(q);
        const items = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ServiceCatalogItem));
        setServiceCatalogItems(items);
        console.log("[MaintenanceFormDialog] Service catalog fetched:", items.length, "items");
      } catch (error) {
        console.error("[MaintenanceFormDialog] Error fetching service catalog:", error);
        toast({ title: t('toastErrorTitle'), description: t('toastErrorLoadingCatalog', {ns: 'InvoiceManagementSection'}), variant: 'destructive' });
      } finally {
        setIsLoadingCatalog(false);
      }
    };
    fetchServiceCatalog();
  }, [toast, t]);

  const handleCatalogSelection = (catalogItemId: string, taskIndex: number) => {
    const selectedService = serviceCatalogItems.find(s => s.id === catalogItemId);
    if (selectedService) {
      form.setValue(`serviceTasks.${taskIndex}.text`, selectedService.name);
    }
  };

  const onSubmit = async (values: MaintenanceItemFormValues) => {
    setIsSubmitting(true);
    try {
      const now = serverTimestamp();
      const dueDateTimestamp = values.dueDate ? Timestamp.fromDate(new Date(values.dueDate)) : null;

      const payload = {
        vehicleId,
        clientId,
        description: values.description,
        serviceTasks: values.serviceTasks.map(task => task.text),
        dueDate: dueDateTimestamp,
        dueMileage: values.dueMileage ?? null,
        status: values.status,
        notes: values.notes || null,
        updatedAt: now,
      };

      let savedItemData: MaintenanceItem;

      if (isEditMode && itemToEdit) {
        const itemRef = doc(db, "maintenanceItems", itemToEdit.id);
        await updateDoc(itemRef, payload);
        savedItemData = { 
            ...itemToEdit, 
            ...payload, 
            dueDate: dueDateTimestamp,
            updatedAt: Timestamp.now() 
        };
        toast({ title: t('toastSuccessTitle'), description: t('toastSuccessDescription', { description: values.description }) });
      } else {
        const docRef = await addDoc(collection(db, "maintenanceItems"), { ...payload, createdAt: now });
        savedItemData = { 
            id: docRef.id, 
            ...payload, 
            dueDate: dueDateTimestamp,
            createdAt: Timestamp.now(), 
            updatedAt: Timestamp.now() 
        };
        toast({ title: t('toastSuccessTitle'), description: t('toastSuccessDescription', { description: values.description }) });
      }
      onItemSaved(savedItemData);
      form.reset();
      closeDialog();
    } catch (error: any) {
      console.error("Error saving maintenance item:", error);
      toast({ title: t('toastErrorTitle'), description: `${t('toastErrorSavingItem')} ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>{t('formDescription')}</FormLabel><FormControl><Input {...field} placeholder={t('formDescriptionPlaceholder')} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )} />

        <div>
          <FormLabel className="text-md font-semibold">{t('formServiceTasksTitle')}</FormLabel>
          {fields.map((item, index) => (
            <div key={item.id} className="flex items-end gap-2 mt-2 p-3 border rounded-md bg-secondary/30">
              <div className="flex-grow space-y-2">
                <FormField control={form.control} name={`serviceTasks.${index}.text`} render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">{t('formServiceTaskLabel', {number: index + 1})}</FormLabel><FormControl><Input {...field} placeholder={t('formServiceTaskPlaceholder')} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                )} />
                <Controller 
                  control={form.control} 
                  name={`serviceTasks.${index}.text`}
                  render={({ field: textField }) => (
                    <Select 
                      onValueChange={(value) => {
                        if (value && !['__loading__', '__no_tasks__', '__placeholder__'].includes(value)) {
                          handleCatalogSelection(value, index);
                        }
                      }} 
                      disabled={isSubmitting || isLoadingCatalog}
                    >
                        <FormControl>
                            <SelectTrigger className="text-xs h-8">
                                <SelectValue 
                                  placeholder={
                                    isLoadingCatalog ? t('formLoadingTasksPlaceholder') :
                                    serviceCatalogItems.length === 0 ? t('formNoTasksInCatalog') :
                                    t('formServiceTaskCatalogPlaceholder')
                                  } 
                                />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {isLoadingCatalog && <SelectItem value="__loading__" disabled>{t('formLoadingTasksPlaceholder')}</SelectItem>}
                            {!isLoadingCatalog && serviceCatalogItems.length === 0 && <SelectItem value="__no_tasks__" disabled>{t('formNoTasksInCatalog')}</SelectItem>}
                            {!isLoadingCatalog && serviceCatalogItems.length > 0 && (
                              <SelectItem value="__placeholder__" disabled>
                                {t('formServiceTaskCatalogPlaceholder')}
                              </SelectItem>
                            )}
                            {serviceCatalogItems.map(service => (
                                <SelectItem key={service.id} value={service.id} className="text-xs">{service.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )} />
              </div>
              {fields.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={isSubmitting} aria-label={t('formRemoveServiceTaskButtonAria')}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => append({ text: "" })} disabled={isSubmitting} className="mt-2">
            <PlusCircle className="mr-2 h-4 w-4" /> {t('formAddServiceTaskButton')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="dueDate" render={({ field }) => (
            <FormItem><FormLabel>{t('formDueDate')}</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="dueMileage" render={({ field }) => (
            <FormItem><FormLabel>{t('formDueMileage')}</FormLabel>
            <FormControl><Input type="number" {...field} placeholder={t('formDueMileagePlaceholder')} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))} disabled={isSubmitting}/></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="status" render={({ field }) => (
          <FormItem><FormLabel>{t('formStatus')}</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
              <FormControl><SelectTrigger><SelectValue placeholder={t('formStatusPlaceholder')} /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="upcoming">{t('formStatusUpcoming')}</SelectItem>
                <SelectItem value="due">{t('formStatusDue')}</SelectItem>
                <SelectItem value="completed">{t('formStatusCompleted')}</SelectItem>
              </SelectContent>
            </Select><FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem><FormLabel>{t('formNotesLabel')}</FormLabel><FormControl><Textarea {...field} placeholder={t('formNotesPlaceholder')} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )} />

        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={() => { form.reset(); closeDialog(); }} disabled={isSubmitting}>{t('cancelButton', {ns: 'ManagerDashboardPage.AddVehicleForm'})}</Button>
          <Button type="submit" disabled={isSubmitting || isLoadingCatalog}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? t('formSavingButton') : (isEditMode ? t('formButtonSave') : t('formButtonAdd'))}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

interface MaintenanceManagementSectionProps {
  vehicleId: string;
  clientId: string;
  initialMaintenanceItems: MaintenanceItem[];
  onItemSaved: (item: MaintenanceItem) => void;
  onItemDeleted: (itemId: string) => void;
}

export function MaintenanceManagementSection({ vehicleId, clientId, initialMaintenanceItems, onItemSaved: notifyParentItemSaved, onItemDeleted: notifyParentItemDeleted }: MaintenanceManagementSectionProps) {
  const t = useTranslations('MaintenanceManagementSection');
  const { toast } = useToast();
  const [items, setItems] = useState<MaintenanceItem[]>(initialMaintenanceItems);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MaintenanceItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MaintenanceItem | null>(null);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);

  useEffect(() => {
    setItems(initialMaintenanceItems.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
  }, [initialMaintenanceItems]);
  
  const handleLocalItemSaved = (savedItem: MaintenanceItem) => {
    setItems(prevItems => {
      const existingIndex = prevItems.findIndex(i => i.id === savedItem.id);
      if (existingIndex > -1) {
        const updatedItems = [...prevItems];
        updatedItems[existingIndex] = savedItem;
        return updatedItems.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      }
      return [savedItem, ...prevItems].sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    });
    notifyParentItemSaved(savedItem); 
  };
  
  const openAddForm = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item: MaintenanceItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleDeleteRequest = (item: MaintenanceItem) => {
    setItemToDelete(item);
    setIsConfirmDeleteDialogOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, "maintenanceItems", itemToDelete.id));
      setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
      notifyParentItemDeleted(itemToDelete.id); 
      toast({ title: t('toastDeleteSuccessTitle'), description: t('toastDeleteSuccessDescription', { description: itemToDelete.description }) });
    } catch (error: any) {
      console.error("Error deleting maintenance item:", error);
      toast({ title: t('toastErrorTitle'), description: `${t('toastDeleteError')} ${error.message}`, variant: "destructive" });
    } finally {
      setIsConfirmDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };
  
  const formatDateForDisplay = (dateValue?: Timestamp | string | null): string => {
    if (!dateValue) return 'N/A';
    let date: Date;
    if (dateValue instanceof Timestamp) {
        date = dateValue.toDate();
    } else {
        date = new Date(dateValue as string);
    }
    if (isNaN(date.getTime())) return String(dateValue);
    
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row justify-between items-start sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <Wrench className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">{t('title')}</CardTitle>
          </div>
          <CardDescription>{t('description')}</CardDescription>
        </div>
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
            setIsFormOpen(isOpen);
            if (!isOpen) setEditingItem(null);
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" onClick={openAddForm} className="mt-2 sm:mt-0 sm:ml-4 flex-shrink-0">
              <PlusCircle className="mr-2 h-4 w-4" /> {t('addMaintenanceItem')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle>{editingItem ? t('dialogTitleEdit') : t('dialogTitleAdd')}</DialogTitle>
              <DialogDescription>{t('dialogDescription')}</DialogDescription>
            </DialogHeader>
            <ManageMaintenanceItemFormDialog
              vehicleId={vehicleId}
              clientId={clientId}
              itemToEdit={editingItem}
              onItemSaved={handleLocalItemSaved}
              closeDialog={() => { setIsFormOpen(false); setEditingItem(null); }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tableHeaderDescription')}</TableHead>
                  <TableHead>{t('tableHeaderDueDate')}</TableHead>
                  <TableHead>{t('tableHeaderDueMileage')}</TableHead>
                  <TableHead>{t('tableHeaderStatus')}</TableHead>
                  <TableHead className="text-right">{t('tableHeaderActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-xs truncate" title={item.description}>{item.description}</TableCell>
                    <TableCell>{formatDateForDisplay(item.dueDate)}</TableCell>
                    <TableCell>{item.dueMileage?.toLocaleString() || 'N/A'}</TableCell>
                    <TableCell><Badge variant={item.status === 'due' ? 'destructive' : item.status === 'completed' ? 'secondary' : 'default'} className="capitalize">{item.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="icon" onClick={() => openEditForm(item)} aria-label={t('editButtonAriaLabel', {description: item.description})}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteRequest(item)} aria-label={t('deleteButtonAriaLabel', {description: item.description})}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">{t('noItems')}</p>
        )}
      </CardContent>
       <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmDeleteDescription', { description: itemToDelete?.description || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>{t('cancelButton', {ns: 'ManagerDashboardPage.AddVehicleForm'})}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteItem} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {t('deleteButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
