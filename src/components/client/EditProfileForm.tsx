
"use client";

import React, { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Client, Address, IdentityDocumentType } from "@/types";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp, deleteField, Timestamp } from "firebase/firestore";
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


const DNI_REGEX = /^\d{8}[A-HJ-NP-TV-Z]$/i;
const NIE_REGEX = /^[XYZ]\d{7}[A-HJ-NP-TV-Z]$/i;
const NIF_COMPANY_REGEX = /^[A-HJ-NP-SUVW]\d{7}[0-9A-J]$/i;
const PASSPORT_REGEX = /^[A-Z0-9]{5,}$/i;

const createIdentityDocumentSchema = (t: ReturnType<typeof useTranslations<"ClientProfilePage.EditForm">>) => z.object({
  number: z.string().min(1, { message: t('error_identityDocumentNumberRequired') }),
  type: z.enum(['DNI', 'NIF', 'NIE', 'Passport', 'Other'], { required_error: t('error_identityDocumentTypeRequired') }),
}).superRefine((doc, ctx) => {
  if (!doc.number) return; 

  switch (doc.type) {
    case 'DNI':
      if (!DNI_REGEX.test(doc.number)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['number'], message: t('error_invalidDniFormat') });
      }
      break;
    case 'NIE':
      if (!NIE_REGEX.test(doc.number)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['number'], message: t('error_invalidNieFormat') });
      }
      break;
    case 'NIF':
      if (!DNI_REGEX.test(doc.number) && !NIF_COMPANY_REGEX.test(doc.number)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['number'], message: t('error_invalidNifFormat') });
      }
      break;
    case 'Passport':
      if (!PASSPORT_REGEX.test(doc.number)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['number'], message: t('error_invalidPassportFormat') });
      }
      break;
    case 'Other':
      break;
  }
}).optional().nullable();

const createAddressSchema = (t: ReturnType<typeof useTranslations<"ClientProfilePage.EditForm">>) => z.object({
  street: z.string().min(1, { message: "Street is required." }), 
  city: z.string().min(1, { message: "City is required." }), 
  postalCode: z.string().min(1, { message: "Postal code is required." }), 
  country: z.string().min(1, { message: "Country is required." }), 
}).optional().nullable();

const createProfileFormSchema = (t: ReturnType<typeof useTranslations<"ClientProfilePage.EditForm">>) => z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }), 
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }), 
  phone1: z.string().optional().or(z.literal('')),
  phone2: z.string().optional().or(z.literal('')),
  identityDocument: createIdentityDocumentSchema(t),
  fiscalAddress: createAddressSchema(t),
  postalAddress: createAddressSchema(t),
  imageFile: z.instanceof(File).optional().nullable(),
});

export type ProfileFormValues = z.infer<ReturnType<typeof createProfileFormSchema>>;

interface EditProfileFormProps {
  client: Client;
  onProfileUpdated?: (updatedClient: Client) => void;
}

const identityDocumentTypes: IdentityDocumentType[] = ['DNI', 'NIF', 'NIE', 'Passport', 'Other'];

export function EditProfileForm({ client, onProfileUpdated }: EditProfileFormProps) {
  const { toast } = useToast();
  const t_form = useTranslations('ClientProfilePage.EditForm');
  const t_image_upload = useTranslations('ClientProfilePage.EditForm.ImageUpload');
  const profileFormSchema = createProfileFormSchema(t_form);

  const [currentImagePreview, setCurrentImagePreview] = useState<string | null>(client.profileImageUrl || null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [intentToDeleteImage, setIntentToDeleteImage] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: client.firstName || "",
      lastName: client.lastName || "",
      phone1: client.phone1 || "",
      phone2: client.phone2 || "",
      identityDocument: client.identityDocument || null,
      fiscalAddress: client.fiscalAddress || null,
      postalAddress: client.postalAddress || null,
      imageFile: null,
    },
  });

  useEffect(() => {
    setCurrentImagePreview(client.profileImageUrl || null);
    setSelectedImageFile(null);
    setIntentToDeleteImage(false);
    form.reset({
      firstName: client.firstName || "",
      lastName: client.lastName || "",
      phone1: client.phone1 || "",
      phone2: client.phone2 || "",
      identityDocument: client.identityDocument || null,
      fiscalAddress: client.fiscalAddress || null,
      postalAddress: client.postalAddress || null,
      imageFile: null,
    });
  }, [client, form]);

  useEffect(() => {
    if (selectedImageFile) {
      const objectUrl = URL.createObjectURL(selectedImageFile);
      setCurrentImagePreview(objectUrl);
      setIntentToDeleteImage(false);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (intentToDeleteImage) {
        setCurrentImagePreview(null);
    } else {
        setCurrentImagePreview(client.profileImageUrl || null);
    }
  }, [selectedImageFile, client.profileImageUrl, intentToDeleteImage]);


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

  async function onSubmit(values: ProfileFormValues) {
    if (!client.id) {
      toast({ title: t_form('toastErrorTitle'), description: t_form('toastErrorMissingId'), variant: "destructive" });
      return;
    }
    setIsSubmittingForm(true);
    setIsProcessingImage(true);

    let newImageUrl: string | null = client.profileImageUrl || null;
    let newImagePath: string | null = client.profileImagePath || null;

    try {
      if (intentToDeleteImage && !selectedImageFile) {
        if (client.profileImagePath) {
          try {
            await deleteObject(storageRefFirebase(storage, client.profileImagePath));
            toast({ title: t_image_upload('deleteSuccessTitle'), description: t_image_upload('deleteSuccessDescription')});
          } catch (e: any) {
            console.warn("Could not delete old profile image from storage:", e);
            toast({ title: t_form('toastErrorTitle'), description: t_image_upload('errorDeletingOld', {error: e.message}), variant: "warning"});
          }
        }
        newImageUrl = null;
        newImagePath = null;
      } else if (selectedImageFile) {
        if (client.profileImagePath) {
          try {
            await deleteObject(storageRefFirebase(storage, client.profileImagePath));
          } catch (e: any) {
            console.warn("Could not delete old profile image before replace:", e);
          }
        }
        const imageFileName = `${client.id}-${Date.now()}-${selectedImageFile.name}`;
        const imageStoragePath = `profile_images/${imageFileName}`;
        const fileRef = storageRefFirebase(storage, imageStoragePath);
        await uploadBytes(fileRef, selectedImageFile);
        newImageUrl = await getDownloadURL(fileRef);
        newImagePath = imageStoragePath;
        toast({ title: t_image_upload('uploadSuccessTitle'), description: t_image_upload('uploadSuccessDescription') });
      }
    } catch (imageError: any) {
      toast({ title: t_form('toastErrorTitle'), description: t_image_upload('errorUploading', {error: imageError.message }), variant: "destructive"});
      setIsProcessingImage(false);
      setIsSubmittingForm(false);
      return;
    }
    setIsProcessingImage(false);

    try {
      const clientRef = doc(db, "clients", client.id);
      
      const updateData: Partial<Omit<Client, 'id' | 'email' | 'role' | 'createdAt'>> & { updatedAt: any } = {
        firstName: values.firstName,
        lastName: values.lastName,
        phone1: values.phone1 || null,
        phone2: values.phone2 || null,
        identityDocument: values.identityDocument?.number ? values.identityDocument : null,
        fiscalAddress: values.fiscalAddress?.street ? values.fiscalAddress : null,
        postalAddress: values.postalAddress?.street ? values.postalAddress : null,
        profileImageUrl: newImageUrl,
        profileImagePath: newImagePath,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(clientRef, updateData);
      
      toast({
        title: t_form('toastSuccessTitle'),
        description: t_form('toastSuccessDescription'),
      });

      if (onProfileUpdated) {
        const updatedClientData: Client = { 
            ...client, 
            ...values,
            profileImageUrl: newImageUrl,
            profileImagePath: newImagePath,
            identityDocument: updateData.identityDocument,
            fiscalAddress: updateData.fiscalAddress,
            postalAddress: updateData.postalAddress,
            phone1: updateData.phone1,
            phone2: updateData.phone2,
            updatedAt: Timestamp.now() 
        };
        onProfileUpdated(updatedClientData);
      }
      setSelectedImageFile(null);
      form.setValue("imageFile", null);
      setIntentToDeleteImage(false);

    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: t_form('toastErrorTitle'),
        description: t_form('toastErrorGeneric', { error: (error as Error).message }),
        variant: "destructive",
      });
    } finally {
      setIsSubmittingForm(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{t_form('personalInfoTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Profile Image Upload Section */}
            <div className="space-y-2">
              <FormLabel>{t_image_upload('currentImageLabel')}</FormLabel>
              <div className="relative group w-full max-w-xs h-48 border rounded-md overflow-hidden bg-muted flex items-center justify-center">
                {currentImagePreview ? (
                  <Image src={currentImagePreview} alt={t_image_upload('currentImageAlt')} fill style={{ objectFit: "cover" }}/>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Camera className="mx-auto h-12 w-12" />
                    <p>{t_image_upload('noImageLabel')}</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={t_image_upload('replaceImageButton')}
                    disabled={isSubmittingForm || isProcessingImage}
                  >
                    <RotateCcw className="h-5 w-5" />
                  </Button>
                  {currentImagePreview && !selectedImageFile && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" size="icon" aria-label={t_image_upload('deleteImageButton')} disabled={isSubmittingForm || isProcessingImage}>
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t_image_upload('confirmDeleteTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>{t_image_upload('confirmDeleteDescription')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t_image_upload('cancelButton')}</AlertDialogCancel>
                          <AlertDialogAction onClick={handleConfirmDeleteImage} className="bg-destructive hover:bg-destructive/90">
                            {t_image_upload('deleteConfirmButton')}
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
                disabled={isSubmittingForm || isProcessingImage}
              />
              <FormField
                control={form.control}
                name="imageFile"
                render={({ field }) => (
                  <FormItem>
                    {field.value && <FormDescription>{t_image_upload('selectedFileDescription', {fileName: field.value.name})}</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>{t_form('firstNameLabel')}</FormLabel><FormControl><Input placeholder={t_form('firstNamePlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>{t_form('lastNameLabel')}</FormLabel><FormControl><Input placeholder={t_form('lastNamePlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="phone1" render={({ field }) => (<FormItem><FormLabel>{t_form('phone1Label')}</FormLabel><FormControl><Input placeholder={t_form('phone1Placeholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="phone2" render={({ field }) => (<FormItem><FormLabel>{t_form('phone2Label')}</FormLabel><FormControl><Input placeholder={t_form('phone2Placeholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t_form('identityDocumentTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="identityDocument.number" render={({ field }) => (<FormItem><FormLabel>{t_form('identityDocumentNumberLabel')}</FormLabel><FormControl><Input placeholder={t_form('identityDocumentNumberPlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="identityDocument.type" render={({ field }) => (<FormItem><FormLabel>{t_form('identityDocumentTypeLabel')}</FormLabel><Select onValueChange={field.onChange} value={field.value || undefined} disabled={isSubmittingForm}><FormControl><SelectTrigger><SelectValue placeholder={t_form('identityDocumentTypePlaceholder')} /></SelectTrigger></FormControl><SelectContent>{identityDocumentTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>{t_form('fiscalAddressTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField name="fiscalAddress.street" render={({ field }) => (<FormItem><FormLabel>{t_form('streetLabel')}</FormLabel><FormControl><Input placeholder={t_form('streetPlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField name="fiscalAddress.city" render={({ field }) => (<FormItem><FormLabel>{t_form('cityLabel')}</FormLabel><FormControl><Input placeholder={t_form('cityPlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
                <FormField name="fiscalAddress.postalCode" render={({ field }) => (<FormItem><FormLabel>{t_form('postalCodeLabel')}</FormLabel><FormControl><Input placeholder={t_form('postalCodePlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
                <FormField name="fiscalAddress.country" render={({ field }) => (<FormItem><FormLabel>{t_form('countryLabel')}</FormLabel><FormControl><Input placeholder={t_form('countryPlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t_form('postalAddressTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField name="postalAddress.street" render={({ field }) => (<FormItem><FormLabel>{t_form('streetLabel')}</FormLabel><FormControl><Input placeholder={t_form('streetPlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField name="postalAddress.city" render={({ field }) => (<FormItem><FormLabel>{t_form('cityLabel')}</FormLabel><FormControl><Input placeholder={t_form('cityPlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
                <FormField name="postalAddress.postalCode" render={({ field }) => (<FormItem><FormLabel>{t_form('postalCodeLabel')}</FormLabel><FormControl><Input placeholder={t_form('postalCodePlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
                <FormField name="postalAddress.country" render={({ field }) => (<FormItem><FormLabel>{t_form('countryLabel')}</FormLabel><FormControl><Input placeholder={t_form('countryPlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
            <Button type="submit" disabled={isSubmittingForm || isProcessingImage}>
                {(isSubmittingForm || isProcessingImage) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessingImage ? t_image_upload('processingImage') : isSubmittingForm ? t_image_upload('savingButton') : t_form('saveButton')}
            </Button>
        </div>
      </form>
    </Form>
  );
}

    