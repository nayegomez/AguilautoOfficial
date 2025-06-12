
"use client";

import React, { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Client, Vehicle } from "@/types";
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
import { doc, updateDoc, serverTimestamp, Timestamp, deleteField, collection, getDocs, query, orderBy } from "firebase/firestore";
import { ref as storageRefFirebase, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Camera, Trash2, RotateCcw, Loader2 } from "lucide-react";
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

const editVehicleFormSchema = z.object({
  make: z.string().min(2, { message: "Make must be at least 2 characters." }),
  model: z.string().min(1, { message: "Model is required." }),
  year: z.coerce.number().min(1900, { message: "Year must be 1900 or later." }).max(new Date().getFullYear() + 2, { message: "Year cannot be too far in the future."}),
  licensePlate: z.string().min(3, { message: "License plate must be at least 3 characters." }).regex(/^[A-Z0-9-]+$/, { message: "Invalid license plate format."}).toUpperCase(),
  vin: z.string().length(17, { message: "VIN must be 17 characters." }).regex(/^[A-HJ-NPR-Z0-9]{17}$/, { message: "Invalid VIN format."}).toUpperCase(),
  ownerId: z.string().min(1, { message: "Client owner selection is required." }),
  engineCode: z.string().optional(),
  currentMileage: z.coerce.number().min(0, { message: "Mileage cannot be negative."}).optional(),
  lastServiceDate: z.string().optional(),
  imageFile: z.instanceof(File).optional().nullable(),
});

type EditVehicleFormValues = z.infer<typeof editVehicleFormSchema>;

interface EditVehicleFormProps {
  vehicle: Vehicle;
  onVehicleUpdated?: (updatedVehicle: Vehicle) => void;
}

export function EditVehicleForm({ vehicle, onVehicleUpdated }: EditVehicleFormProps) {
  const { toast } = useToast();
  const t = useTranslations('EditVehicleForm');
  const t_dialog = useTranslations('ManagerVehicleDetailPage.EditVehicleFormDialogs');

  const [currentImagePreview, setCurrentImagePreview] = useState<string | null>(vehicle.imageUrl || null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [intentToDeleteImage, setIntentToDeleteImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  const form = useForm<EditVehicleFormValues>({
    resolver: zodResolver(editVehicleFormSchema),
    defaultValues: {
      make: vehicle.make || "",
      model: vehicle.model || "",
      year: vehicle.year || new Date().getFullYear(),
      licensePlate: vehicle.licensePlate || "",
      vin: vehicle.vin || "",
      ownerId: vehicle.ownerId || "",
      engineCode: vehicle.engineCode || "",
      currentMileage: vehicle.currentMileage || undefined,
      lastServiceDate: typeof vehicle.lastServiceDate === 'string' ? vehicle.lastServiceDate : 
                       vehicle.lastServiceDate instanceof Timestamp ? vehicle.lastServiceDate.toDate().toISOString().split('T')[0] : "",
      imageFile: null,
    },
  });
  
  useEffect(() => {
    const fetchClients = async () => {
      setIsLoadingClients(true);
      try {
        const q = query(collection(db, "clients"), orderBy("lastName", "asc"), orderBy("firstName", "asc"));
        const querySnapshot = await getDocs(q);
        const clientsData = querySnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        } as Client));
        setClientsList(clientsData);
      } catch (error) {
        console.error("Error fetching clients:", error);
        toast({
          title: "Error",
          description: "Could not load client list for owner selection.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingClients(false);
      }
    };
    fetchClients();
  }, [toast]);

  useEffect(() => {
    setCurrentImagePreview(vehicle.imageUrl || null);
    setSelectedImageFile(null);
    setIntentToDeleteImage(false);
    form.reset({
        make: vehicle.make || "",
        model: vehicle.model || "",
        year: vehicle.year || new Date().getFullYear(),
        licensePlate: vehicle.licensePlate || "",
        vin: vehicle.vin || "",
        ownerId: vehicle.ownerId || "",
        engineCode: vehicle.engineCode || "",
        currentMileage: vehicle.currentMileage || undefined,
        lastServiceDate: typeof vehicle.lastServiceDate === 'string' ? vehicle.lastServiceDate : 
                         vehicle.lastServiceDate instanceof Timestamp ? vehicle.lastServiceDate.toDate().toISOString().split('T')[0] : "",
        imageFile: null,
    });
  }, [vehicle, form]);


  useEffect(() => {
    if (selectedImageFile) {
      const objectUrl = URL.createObjectURL(selectedImageFile);
      setCurrentImagePreview(objectUrl);
      setIntentToDeleteImage(false);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (!intentToDeleteImage) {
        setCurrentImagePreview(vehicle.imageUrl || null);
    } else {
        setCurrentImagePreview(null);
    }
  }, [selectedImageFile, vehicle.imageUrl, intentToDeleteImage]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      form.setValue("imageFile", file, { shouldValidate: true });
      setIntentToDeleteImage(false);
    }
  };
  
  const handleConfirmDeleteImage = () => {
    setSelectedImageFile(null);
    form.setValue("imageFile", null);
    setIntentToDeleteImage(true); 
  };

  async function onSubmit(values: EditVehicleFormValues) {
    if (!vehicle.id) {
      toast({ title: "Error", description: "Vehicle ID is missing.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    try {
      const updateData: Partial<Vehicle> & {updatedAt: any} = {
        ...values,
        licensePlate: values.licensePlate.toUpperCase(),
        vin: values.vin.toUpperCase(),
        year: Number(values.year),
        currentMileage: values.currentMileage !== undefined ? Number(values.currentMileage) : deleteField() as unknown as undefined,
        engineCode: values.engineCode || deleteField() as unknown as undefined,
        lastServiceDate: values.lastServiceDate || null,
        updatedAt: serverTimestamp(),
      };
      
      delete (updateData as any).imageFile;

      if (intentToDeleteImage && !selectedImageFile) {
        if (vehicle.imagePath) {
          try {
            const oldImageRef = storageRefFirebase(storage, vehicle.imagePath);
            await deleteObject(oldImageRef);
            toast({ title: t_dialog('deleteSuccessTitle'), description: t_dialog('deleteSuccessDescription') });
          } catch (e) {
            console.warn("Could not delete old image from storage, it might not exist:", e);
          }
        }
        updateData.imageUrl = null;
        updateData.imagePath = null;
      } else if (selectedImageFile) {
        if (vehicle.imagePath) {
          try {
            const oldImageRef = storageRefFirebase(storage, vehicle.imagePath);
            await deleteObject(oldImageRef);
          } catch (e) {
             console.warn("Could not delete old image from storage before replace, it might not exist:", e);
          }
        }
        const imageFileName = `${vehicle.vin || vehicle.id}-${selectedImageFile.name}`;
        const newImageStoragePath = `vehicle_images/${imageFileName}`;
        const newImageRef = storageRefFirebase(storage, newImageStoragePath);
        await uploadBytes(newImageRef, selectedImageFile);
        updateData.imageUrl = await getDownloadURL(newImageRef);
        updateData.imagePath = newImageStoragePath;
        toast({ title: t_dialog('uploadSuccessTitle'), description: t_dialog('uploadSuccessDescription') });
      }

      const vehicleRef = doc(db, "vehicles", vehicle.id);
      await updateDoc(vehicleRef, updateData as any); 
      
      toast({
        title: t('toastTitle'),
        description: t('toastDescription', { make: values.make, model: values.model }),
      });

      if (onVehicleUpdated) {
        const updatedVehicleForCallback: Vehicle = {
            ...vehicle, 
            ...values,  
            year: Number(values.year), 
            currentMileage: values.currentMileage !== undefined ? Number(values.currentMileage) : undefined,
            engineCode: values.engineCode || undefined,
            lastServiceDate: values.lastServiceDate || undefined,
            imageUrl: updateData.imageUrl !== undefined ? updateData.imageUrl : vehicle.imageUrl,
            imagePath: updateData.imagePath !== undefined ? updateData.imagePath : vehicle.imagePath, 
            ownerId: values.ownerId,
            updatedAt: Timestamp.now()
        };
        onVehicleUpdated(updatedVehicleForCallback);
      }
      setSelectedImageFile(null);
      form.setValue("imageFile", null);
      setIntentToDeleteImage(false);

    } catch (error) {
      console.error("Error updating vehicle:", error);
      toast({
        title: "Update Error",
        description: `Could not update vehicle: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="space-y-2">
          <FormLabel>{t_dialog('currentImageLabel')}</FormLabel>
          <div className="relative group w-full h-64 md:h-80 border rounded-md overflow-hidden bg-muted flex items-center justify-center">
            {currentImagePreview ? (
              <Image src={currentImagePreview} alt={t_dialog('currentImageAlt', {make: vehicle.make, model: vehicle.model})} fill objectFit="contain" 
              unoptimized />
            ) : (
              <div className="text-center text-muted-foreground">
                <Camera className="mx-auto h-12 w-12" />
                <p>{t_dialog('noImageLabel')}</p>
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                aria-label={t_dialog('replaceImageButton')}
                disabled={isSubmitting}
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
              {currentImagePreview && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" size="icon" aria-label={t_dialog('deleteImageButton')} disabled={isSubmitting}>
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t_dialog('confirmDeleteTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>{t_dialog('confirmDeleteDescription')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t_dialog('cancelButton')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleConfirmDeleteImage} className="bg-destructive hover:bg-destructive/90">
                        {t_dialog('deleteConfirmButton')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          <Input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            accept="image/*" 
            onChange={handleFileChange} 
            disabled={isSubmitting}
          />
          <FormField
            control={form.control}
            name="imageFile"
            render={({ field }) => (
              <FormItem>
                {field.value && <FormDescription>{t_dialog('selectedFileDescription', {fileName: field.value.name})}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
                  <Input type="number" placeholder={t('yearPlaceholder')} {...field} disabled={isSubmitting}/>
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
                  <Input placeholder={t('licensePlatePlaceholder')} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} disabled={isSubmitting}/>
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
                  <Input placeholder={t('vinPlaceholder')} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} disabled={isSubmitting}/>
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
                  disabled={isSubmitting || isLoadingClients}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingClients ? "Loading clients..." : t('ownerPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {!isLoadingClients && clientsList.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.firstName} {client.lastName} ({client.email})
                      </SelectItem>
                    ))}
                    {isLoadingClients && <SelectItem value="loading" disabled>Loading clients...</SelectItem>}
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
                  <Input placeholder={t('engineCodePlaceholder')} {...field} disabled={isSubmitting}/>
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
                   <Input type="number" placeholder={t('currentMileagePlaceholder')} {...field} 
                    value={field.value ?? ""}
                    onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                    disabled={isSubmitting}
                  />
                </FormControl>
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
                  <Input type="date" {...field} value={field.value ?? ""} disabled={isSubmitting} />
                </FormControl>
                <FormDescription>{t('lastServiceDateDescription')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting || isLoadingClients}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? t_dialog('savingButton') : t('saveButton')}
            </Button>
        </div>
      </form>
    </Form>
  );
}

