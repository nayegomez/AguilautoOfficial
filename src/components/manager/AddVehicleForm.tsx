
"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Vehicle, Client } from "@/types";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { ref as storageRefFirebase, uploadBytes, getDownloadURL } from "firebase/storage";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

const vehicleFormSchema = z.object({
  make: z.string().min(2, { message: "Make must be at least 2 characters." }),
  model: z.string().min(1, { message: "Model is required." }),
  year: z.coerce.number().min(1900, { message: "Year must be 1900 or later." }).max(new Date().getFullYear() + 2, { message: "Year cannot be too far in the future."}),
  licensePlate: z.string().min(3, { message: "License plate must be at least 3 characters." }).regex(/^[A-Z0-9-]+$/, { message: "Invalid license plate format."}).toUpperCase(),
  vin: z.string().length(17, { message: "VIN must be 17 characters." }).regex(/^[A-HJ-NPR-Z0-9]{17}$/, { message: "Invalid VIN format."}).toUpperCase(),
  ownerId: z.string().min(1, { message: "Client selection is required."}),
  engineCode: z.string().optional().transform(val => val === "" ? undefined : val),
  currentMileage: z.coerce.number().min(0, { message: "Mileage cannot be negative."}).optional(),
  imageFile: z.instanceof(File).optional().nullable(),
  lastServiceDate: z.string().optional().transform(val => val === "" ? undefined : val),
});

type AddVehicleFormValues = z.infer<typeof vehicleFormSchema>;

interface AddVehicleFormProps {
  clients: Client[];
  onVehicleAdded: (newVehicle: Vehicle) => void;
  closeDialog?: () => void;
  preselectedOwnerId?: string;
}

export function AddVehicleForm({ clients, onVehicleAdded, closeDialog, preselectedOwnerId }: AddVehicleFormProps) {
  const { toast } = useToast();
  const t = useTranslations('ManagerDashboardPage.AddVehicleForm');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const form = useForm<AddVehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      make: "",
      model: "",
      year: new Date().getFullYear(),
      licensePlate: "",
      vin: "",
      ownerId: preselectedOwnerId || "",
      engineCode: "",
      currentMileage: undefined,
      imageFile: null,
      lastServiceDate: "",
    },
  });

  useEffect(() => {
    if (preselectedOwnerId) {
      form.setValue('ownerId', preselectedOwnerId);
    }
  }, [preselectedOwnerId, form]);


  async function onSubmit(values: AddVehicleFormValues) {
    setIsSubmitting(true);
    let imageUrlFromStorage: string | undefined = undefined;
    let imagePathInStorage: string | undefined = undefined;

    const finalOwnerId = preselectedOwnerId || values.ownerId;
    if (!finalOwnerId) {
        toast({ title: "Error", description: "Client owner ID is missing.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    try {
      if (values.imageFile) {
        try {
          const file = values.imageFile;
          const imageFileName = `${values.vin || Date.now()}-${file.name}`;
          const imageStoragePath = `vehicle_images/${imageFileName}`;
          const fileRef = storageRefFirebase(storage, imageStoragePath);
          
          toast({ title: "Subiendo imagen...", description: "Por favor espera." });
          await uploadBytes(fileRef, file);
          imageUrlFromStorage = await getDownloadURL(fileRef);
          imagePathInStorage = imageStoragePath;
          toast({ title: "Imagen subida", description: "La imagen se ha subido correctamente." });
        } catch (uploadError) {
          console.error("Error uploading image: ", uploadError);
          toast({
            title: "Error al subir imagen",
            description: `No se pudo subir la imagen: ${(uploadError as Error).message}. El vehículo se añadirá sin imagen.`,
            variant: "destructive",
          });
        }
      }

      const nowForDB = serverTimestamp();
      
      const vehicleDataPayload: Partial<Omit<Vehicle, 'id'>> & { createdAt: unknown, updatedAt: unknown } = {
        make: values.make,
        model: values.model,
        year: Number(values.year),
        licensePlate: values.licensePlate.toUpperCase(),
        vin: values.vin.toUpperCase(),
        ownerId: finalOwnerId,
        createdAt: nowForDB,
        updatedAt: nowForDB,
      };

      if (values.engineCode) vehicleDataPayload.engineCode = values.engineCode;
      if (values.currentMileage !== undefined) vehicleDataPayload.currentMileage = Number(values.currentMileage);
      if (imageUrlFromStorage) vehicleDataPayload.imageUrl = imageUrlFromStorage;
      if (imagePathInStorage) vehicleDataPayload.imagePath = imagePathInStorage;
      if (values.lastServiceDate) vehicleDataPayload.lastServiceDate = values.lastServiceDate;
      
      const docRef = await addDoc(collection(db, "vehicles"), vehicleDataPayload);
      
      toast({
        title: t('toastSuccessTitle'),
        description: t('toastSuccessDescription', { make: values.make, model: values.model }),
      });
      
      const clientTimestamp = Timestamp.now();
      const newVehicleForUI: Vehicle = {
        id: docRef.id,
        make: values.make,
        model: values.model,
        year: Number(values.year),
        licensePlate: values.licensePlate.toUpperCase(),
        vin: values.vin.toUpperCase(),
        ownerId: finalOwnerId,
        engineCode: values.engineCode || undefined,
        currentMileage: values.currentMileage !== undefined ? Number(values.currentMileage) : undefined,
        imageUrl: imageUrlFromStorage || undefined,
        imagePath: imagePathInStorage || undefined,
        lastServiceDate: values.lastServiceDate || undefined,
        createdAt: clientTimestamp, 
        updatedAt: clientTimestamp,
      };
      
      onVehicleAdded(newVehicleForUI); 
      form.reset({
        make: "", model: "", year: new Date().getFullYear(), licensePlate: "", vin: "",
        ownerId: preselectedOwnerId || "", 
        engineCode: "", currentMileage: undefined, imageFile: null, lastServiceDate: "",
      });
      setSelectedFileName(null);
      if (closeDialog) closeDialog();

    } catch (error) {
      console.error("Error adding vehicle: ", error);
      let errorMessage = (error as Error).message;
      if (errorMessage.includes("Unsupported field value: undefined")) {
        errorMessage = "Uno o más campos opcionales tienen un valor no válido. Revisa los datos del formulario."
      }
      toast({
        title: t('toastErrorTitle'),
        description: t('toastErrorDescription', { error: errorMessage }),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const ownerDisplayName = preselectedOwnerId && clients.length === 1 && clients[0].id === preselectedOwnerId
    ? `${clients[0].firstName} ${clients[0].lastName} (${clients[0].email})`
    : t('ownerPlaceholder');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="make"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('makeLabel')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('makePlaceholder')} {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('modelLabel')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('modelPlaceholder')} {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('yearLabel')}</FormLabel>
                <FormControl>
                  <Input type="number" placeholder={t('yearPlaceholder')} {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="licensePlate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('licensePlateLabel')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('licensePlatePlaceholder')} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vin"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>{t('vinLabel')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('vinPlaceholder')} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ownerId"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>{t('ownerLabel')}</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value}
                  disabled={isSubmitting || !!preselectedOwnerId}
                >
                  <FormControl>
                    <SelectTrigger>
                       <SelectValue placeholder={preselectedOwnerId ? ownerDisplayName : t('ownerPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {/* If preselectedOwnerId is set, only show that client or even no options if it's truly disabled */}
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.firstName} {client.lastName} ({client.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="engineCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('engineCodeLabel')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('engineCodePlaceholder')} {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currentMileage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('currentMileageLabel')}</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder={t('currentMileagePlaceholder')} 
                    {...field} 
                    value={field.value === undefined ? '' : field.value}
                    onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="imageFile"
            render={({ field: { onChange, value, ...restField }}) => (
              <FormItem>
                <FormLabel>{t('imageUrlLabel')}</FormLabel>
                <FormControl>
                  <Input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      onChange(file || null);
                      setSelectedFileName(file?.name || null);
                    }}
                    {...restField} 
                    disabled={isSubmitting}
                  />
                </FormControl>
                {selectedFileName && <FormDescription>{t('formSelectedFile', { fileName: selectedFileName })}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="lastServiceDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('lastServiceDateLabel')}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ''} disabled={isSubmitting} />
                </FormControl>
                <FormDescription>{t('lastServiceDateDescription')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end pt-4 space-x-2">
            <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>{t('cancelButton')}</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? t('addingButton') : t('addButton')}
            </Button>
        </div>
      </form>
    </Form>
  );
}

