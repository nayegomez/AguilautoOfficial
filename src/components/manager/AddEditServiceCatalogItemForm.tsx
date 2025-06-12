
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { ServiceCatalogItem } from "@/types";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, setDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const serviceCatalogItemFormSchema = z.object({
  name: z.string().min(3, { message: "Service name must be at least 3 characters." }),
  description: z.string().optional().or(z.literal('')),
  defaultUnitPrice: z.coerce.number().min(0, { message: "Price cannot be negative."}).optional(),
  category: z.string().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

type ServiceCatalogItemFormValues = z.infer<typeof serviceCatalogItemFormSchema>;

interface AddEditServiceCatalogItemFormProps {
  serviceToEdit?: ServiceCatalogItem | null;
  onServiceSaved: (service: ServiceCatalogItem) => void;
  closeDialog: () => void;
}

export function AddEditServiceCatalogItemForm({ serviceToEdit, onServiceSaved, closeDialog }: AddEditServiceCatalogItemFormProps) {
  const { toast } = useToast();
  const t = useTranslations('ManagerServiceCatalogPage.AddEditServiceForm');
  const isEditMode = !!serviceToEdit;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ServiceCatalogItemFormValues>({
    resolver: zodResolver(serviceCatalogItemFormSchema),
    defaultValues: serviceToEdit ? {
        ...serviceToEdit,
        description: serviceToEdit.description || "",
        defaultUnitPrice: serviceToEdit.defaultUnitPrice || undefined,
        category: serviceToEdit.category || "",
      } : {
        name: "",
        description: "",
        defaultUnitPrice: undefined,
        category: "",
        isActive: true,
      },
  });

  async function onSubmit(values: ServiceCatalogItemFormValues) {
    setIsSubmitting(true);
    const now = serverTimestamp();

    const servicePayload = {
      ...values,
      defaultUnitPrice: values.defaultUnitPrice !== undefined ? Number(values.defaultUnitPrice) : null,
      description: values.description || null,
      category: values.category || null,
      updatedAt: now,
    };

    try {
      let savedServiceData: ServiceCatalogItem;
      if (isEditMode && serviceToEdit) {
        const serviceRef = doc(db, "serviceCatalog", serviceToEdit.id);
        await updateDoc(serviceRef, servicePayload);
        savedServiceData = { 
            ...serviceToEdit, 
            ...servicePayload,
            defaultUnitPrice: servicePayload.defaultUnitPrice === null ? undefined : servicePayload.defaultUnitPrice,
            description: servicePayload.description === null ? undefined : servicePayload.description,
            category: servicePayload.category === null ? undefined : servicePayload.category,
            updatedAt: Timestamp.now()
        };
        toast({
          title: t('toastUpdateSuccessTitle'),
          description: t('toastUpdateSuccessDescription', { name: values.name }),
        });
      } else {
        const fullPayload = { ...servicePayload, createdAt: now };
        const docRef = await addDoc(collection(db, "serviceCatalog"), fullPayload);
        savedServiceData = { 
            id: docRef.id, 
            ...fullPayload,
            defaultUnitPrice: fullPayload.defaultUnitPrice === null ? undefined : fullPayload.defaultUnitPrice,
            description: fullPayload.description === null ? undefined : fullPayload.description,
            category: fullPayload.category === null ? undefined : fullPayload.category,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        toast({
          title: t('toastCreateSuccessTitle'),
          description: t('toastCreateSuccessDescription', { name: values.name }),
        });
      }
      onServiceSaved(savedServiceData);
      form.reset();
      closeDialog();

    } catch (error: any) {
      console.error("Error saving service catalog item:", error);
      toast({
        title: t('toastErrorTitle'),
        description: t('toastErrorGeneric', { error: error.message }),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t('nameLabel')}</FormLabel><FormControl><Input placeholder={t('namePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>{t('descriptionLabel')}</FormLabel><FormControl><Textarea placeholder={t('descriptionPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="defaultUnitPrice" render={({ field }) => (<FormItem><FormLabel>{t('defaultUnitPriceLabel')}</FormLabel><FormControl><Input type="number" step="0.01" placeholder={t('defaultUnitPricePlaceholder')} {...field} value={field.value === undefined ? '' : field.value} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>{t('categoryLabel')}</FormLabel><FormControl><Input placeholder={t('categoryPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <FormField control={form.control} name="isActive" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>{t('isActiveLabel')}</FormLabel></div></FormItem>)} />
        
        <div className="flex justify-end pt-4 space-x-2">
          <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>{t('cancelButton')}</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? (isEditMode ? t('savingButton') : t('addingButton')) : (isEditMode ? t('saveButton') : t('addButton'))}
          </Button>
        </div>
      </form>
    </Form>
  );
}

