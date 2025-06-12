
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { auth, db, storage } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, updateDoc, serverTimestamp, Timestamp, deleteField } from "firebase/firestore";
import { ref as storageRefFirebase, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Loader2, ArrowLeft, Camera, Trash2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation"; 
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

const DNI_REGEX = /^\d{8}[A-HJ-NP-TV-Z]$/i;
const NIE_REGEX = /^[XYZ]\d{7}[A-HJ-NP-TV-Z]$/i;
const NIF_COMPANY_REGEX = /^[A-HJ-NP-SUVW]\d{7}[0-9A-J]$/i;
const PASSPORT_REGEX = /^[A-Z0-9]{5,}$/i;

const createIdentityDocumentSchema = (t: ReturnType<typeof useTranslations<"ManagerClientsPage.AddEditClientForm">>) => z.object({
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


const createAddressSchema = (t: ReturnType<typeof useTranslations<"ManagerClientsPage.AddEditClientForm">>) => z.object({
  street: z.string().min(1, { message: "Street is required." }), 
  city: z.string().min(1, { message: "City is required." }), 
  postalCode: z.string().min(1, { message: "Postal code is required." }), 
  country: z.string().min(1, { message: "Country is required." }), 
}).optional().nullable();

const createClientFormSchemaBase = (t: ReturnType<typeof useTranslations<"ManagerClientsPage.AddEditClientForm">>) => z.object({
  email: z.string().email({ message: "Invalid email address." }), 
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }), 
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }), 
  phone1: z.string().optional().or(z.literal('')),
  phone2: z.string().optional().or(z.literal('')),
  identityDocument: createIdentityDocumentSchema(t),
  fiscalAddress: createAddressSchema(t),
  postalAddress: createAddressSchema(t),
  imageFile: z.instanceof(File).optional().nullable(),
  role: z.enum(['client', 'manager']).default('client'),
  isActive: z.boolean().default(true),
});

const createAddClientFormSchema = (t: ReturnType<typeof useTranslations<"ManagerClientsPage.AddEditClientForm">>) => 
  createClientFormSchemaBase(t).extend({
    password: z.string().min(6, { message: "Password must be at least 6 characters." }), 
});

const createEditClientFormSchema = (t: ReturnType<typeof useTranslations<"ManagerClientsPage.AddEditClientForm">>) => 
  createClientFormSchemaBase(t); 

export type AddClientFormValues = z.infer<ReturnType<typeof createAddClientFormSchema>>;
export type EditClientFormValues = z.infer<ReturnType<typeof createEditClientFormSchema>>;

interface AddEditClientFormProps {
  clientToEdit?: Client | null;
  onClientSaved: (client: Client) => void;
  closeDialog?: () => void; 
  isOnPage?: boolean; 
}

const identityDocumentTypes: IdentityDocumentType[] = ['DNI', 'NIF', 'NIE', 'Passport', 'Other'];

export function AddEditClientForm({ clientToEdit, onClientSaved, closeDialog, isOnPage = false }: AddEditClientFormProps) {
  const { toast } = useToast();
  const t_form = useTranslations('ManagerClientsPage.AddEditClientForm');
  const t_image_upload = useTranslations('ManagerClientsPage.AddEditClientForm.ImageUpload');
  const router = useRouter();
  const isEditMode = !!clientToEdit;

  const [currentImagePreview, setCurrentImagePreview] = useState<string | null>(clientToEdit?.profileImageUrl || null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [intentToDeleteImage, setIntentToDeleteImage] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFormSchema = isEditMode ? createEditClientFormSchema(t_form) : createAddClientFormSchema(t_form);

  const form = useForm<z.infer<typeof currentFormSchema>>({
    resolver: zodResolver(currentFormSchema),
    defaultValues: clientToEdit ? {
        ...clientToEdit,
        phone1: clientToEdit.phone1 || "",
        phone2: clientToEdit.phone2 || "",
        identityDocument: clientToEdit.identityDocument || null,
        fiscalAddress: clientToEdit.fiscalAddress || null,
        postalAddress: clientToEdit.postalAddress || null,
        imageFile: null,
      } : {
        email: "",
        password: "", 
        firstName: "",
        lastName: "",
        phone1: "",
        phone2: "",
        identityDocument: null,
        fiscalAddress: null,
        postalAddress: null,
        imageFile: null,
        role: "client",
        isActive: true,
      },
  });

  useEffect(() => {
    if (clientToEdit) {
        setCurrentImagePreview(clientToEdit.profileImageUrl || null);
    } else {
        setCurrentImagePreview(null);
    }
    setSelectedImageFile(null);
    setIntentToDeleteImage(false);
    form.reset(clientToEdit ? {
        ...clientToEdit,
        phone1: clientToEdit.phone1 || "",
        phone2: clientToEdit.phone2 || "",
        identityDocument: clientToEdit.identityDocument || null,
        fiscalAddress: clientToEdit.fiscalAddress || null,
        postalAddress: clientToEdit.postalAddress || null,
        imageFile: null,
      } : {
        email: "", password: "", firstName: "", lastName: "", phone1: "", phone2: "",
        identityDocument: null, fiscalAddress: null, postalAddress: null,
        imageFile: null, role: "client", isActive: true,
      });
  }, [clientToEdit, form]);


  useEffect(() => {
    if (selectedImageFile) {
      const objectUrl = URL.createObjectURL(selectedImageFile);
      setCurrentImagePreview(objectUrl);
      setIntentToDeleteImage(false);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (intentToDeleteImage) {
        setCurrentImagePreview(null);
    } else {
        setCurrentImagePreview(clientToEdit?.profileImageUrl || null);
    }
  }, [selectedImageFile, clientToEdit?.profileImageUrl, intentToDeleteImage]);

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

  async function onSubmit(values: z.infer<typeof currentFormSchema>) {
    setIsSubmittingForm(true);
    setIsProcessingImage(true);
    const now = serverTimestamp();

    let newImageUrl: string | null = clientToEdit?.profileImageUrl || null;
    let newImagePath: string | null = clientToEdit?.profileImagePath || null;
    const clientNameForToast = `${values.firstName} ${values.lastName}`;

    try {
      if (intentToDeleteImage && !selectedImageFile) {
        if (clientToEdit?.profileImagePath) {
          try {
            await deleteObject(storageRefFirebase(storage, clientToEdit.profileImagePath));
            toast({ title: t_image_upload('deleteSuccessTitle', {clientName: clientNameForToast}), description: t_image_upload('deleteSuccessDescription', {clientName: clientNameForToast})});
          } catch (e: any) {
            toast({ title: t_form('toastErrorTitle'), description: t_image_upload('errorDeletingOld', {error: e.message}), variant: "warning"});
          }
        }
        newImageUrl = null;
        newImagePath = null;
      } else if (selectedImageFile) {
        if (clientToEdit?.profileImagePath) {
          try {
            await deleteObject(storageRefFirebase(storage, clientToEdit.profileImagePath));
          } catch (e: any) {
            console.warn("Could not delete old profile image before replace:", e);
          }
        }
        const imageIdPart = clientToEdit?.id || `new-${Date.now()}`;
        const imageFileName = `${imageIdPart}-${Date.now()}-${selectedImageFile.name}`;
        const imageStoragePath = `profile_images/${imageFileName}`;
        const fileRef = storageRefFirebase(storage, imageStoragePath);
        await uploadBytes(fileRef, selectedImageFile);
        newImageUrl = await getDownloadURL(fileRef);
        newImagePath = imageStoragePath;
        toast({ title: t_image_upload('uploadSuccessTitle', {clientName: clientNameForToast}), description: t_image_upload('uploadSuccessDescription', {clientName: clientNameForToast}) });
      }
    } catch (imageError: any) {
      toast({ title: t_form('toastErrorTitle'), description: t_image_upload('errorUploading', {error: imageError.message }), variant: "destructive"});
      setIsProcessingImage(false);
      setIsSubmittingForm(false);
      return;
    }
    setIsProcessingImage(false);

    const clientDataPayload = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone1: values.phone1 || null,
      phone2: values.phone2 || null,
      identityDocument: values.identityDocument?.number ? values.identityDocument : null,
      fiscalAddress: values.fiscalAddress?.street ? values.fiscalAddress : null,
      postalAddress: values.postalAddress?.street ? values.postalAddress : null,
      profileImageUrl: newImageUrl,
      profileImagePath: newImagePath,
      role: values.role,
      isActive: values.isActive,
      updatedAt: now,
    };

    try {
      if (isEditMode && clientToEdit) {
        const clientRef = doc(db, "clients", clientToEdit.id);
        const { email, ...payloadForUpdate } = clientDataPayload;
        
        await updateDoc(clientRef, {
            ...payloadForUpdate,
            email: clientToEdit.email,
        });
        
        const updatedClient: Client = {
            ...clientToEdit, 
            ...payloadForUpdate,
            email: clientToEdit.email,
            profileImageUrl: newImageUrl,
            profileImagePath: newImagePath,
            updatedAt: Timestamp.now(), 
        };
        onClientSaved(updatedClient);
        toast({
          title: t_form('toastUpdateSuccessTitle'),
          description: t_form('toastUpdateSuccessDescription', { name: clientNameForToast, email: clientToEdit.email }),
        });
      } else { 
        const addValues = values as AddClientFormValues;
        const userCredential = await createUserWithEmailAndPassword(auth, addValues.email, addValues.password);
        const user = userCredential.user;

        const newClientDocData = {
          ...clientDataPayload,
          email: user.email!,
          createdAt: now,
        };
        await setDoc(doc(db, "clients", user.uid), newClientDocData);
        
        const newClient: Client = {
            id: user.uid,
            ...newClientDocData,
            profileImageUrl: newImageUrl,
            profileImagePath: newImagePath,
            createdAt: Timestamp.now(), 
            updatedAt: Timestamp.now(), 
        };
        onClientSaved(newClient);
        toast({
          title: t_form('toastCreateSuccessTitle'),
          description: t_form('toastCreateSuccessDescription', { name: clientNameForToast, email: addValues.email }),
        });
      }
      
      if (closeDialog) { 
        form.reset();
        setSelectedImageFile(null);
        setIntentToDeleteImage(false);
        closeDialog();
      }
      
    } catch (error: any) {
      console.error("Error saving client:", error);
      let description = t_form('toastErrorGeneric', { error: error.message });
      if (!isEditMode && error.code === 'auth/email-already-in-use') {
        description = t_form('toastCreateAuthError', { error: "Email already in use."});
      } else if (!isEditMode && error.code === 'auth/weak-password') {
        description = t_form('toastCreateAuthError', { error: "Password is too weak."});
      } else if (isEditMode) {
        description = t_form('toastErrorGeneric', { error: `Update failed: ${error.message}` });
      } else { 
        description = t_form('toastCreateFirestoreError', { error: error.message });
      }
      toast({ title: t_form('toastErrorTitle'), description, variant: "destructive" });
    } finally {
      setIsSubmittingForm(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>{t_form('personalInfoTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Profile Image Upload Section */}
            <div className="space-y-2">
              <FormLabel>{t_image_upload('currentImageLabel')}</FormLabel>
              <div className="relative group w-full max-w-xs h-48 border rounded-md overflow-hidden bg-muted flex items-center justify-center">
                {currentImagePreview ? (
                  <Image src={currentImagePreview} alt={t_image_upload('currentImageAlt', {clientName: clientToEdit?.firstName || 'Cliente'})} fill style={{ objectFit: "cover" }} 
                  unoptimized />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Camera className="mx-auto h-12 w-12" />
                    <p>{t_image_upload('noImageLabel')}</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button type="button" variant="secondary" size="icon" onClick={() => fileInputRef.current?.click()} aria-label={t_image_upload('replaceImageButton')} disabled={isSubmittingForm || isProcessingImage}>
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
                          <AlertDialogDescription>{t_image_upload('confirmDeleteDescription', {clientName: clientToEdit?.firstName || 'este cliente'})}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t_image_upload('cancelButton')}</AlertDialogCancel>
                          <AlertDialogAction onClick={handleConfirmDeleteImage} className="bg-destructive hover:bg-destructive/90">{t_image_upload('deleteConfirmButton')}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
              <Input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={handleFileChange} disabled={isSubmittingForm || isProcessingImage} />
              <FormField control={form.control} name="imageFile" render={({ field }) => (<FormItem>{field.value && <FormDescription>{t_image_upload('selectedFileDescription', {fileName: field.value.name})}</FormDescription>}<FormMessage /></FormItem>)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>{t_form('firstNameLabel')}</FormLabel><FormControl><Input placeholder={t_form('firstNamePlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>{t_form('lastNameLabel')}</FormLabel><FormControl><Input placeholder={t_form('lastNamePlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>{t_form('emailLabel')}</FormLabel><FormControl><Input type="email" placeholder={t_form('emailPlaceholder')} {...field} disabled={isEditMode || isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
              {!isEditMode && (
                <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>{t_form('passwordLabel')}</FormLabel><FormControl><Input type="password" placeholder={t_form('passwordPlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormDescription>{t_form('passwordDescription')}</FormDescription><FormMessage /></FormItem>)} />
              )}
              <FormField control={form.control} name="phone1" render={({ field }) => (<FormItem><FormLabel>{t_form('phone1Label')}</FormLabel><FormControl><Input placeholder={t_form('phone1Placeholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="phone2" render={({ field }) => (<FormItem><FormLabel>{t_form('phone2Label')}</FormLabel><FormControl><Input placeholder={t_form('phone2Placeholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>{t_form('identityDocumentTitle')}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="identityDocument.number" render={({ field }) => (<FormItem><FormLabel>{t_form('identityDocumentNumberLabel')}</FormLabel><FormControl><Input placeholder={t_form('identityDocumentNumberPlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="identityDocument.type" render={({ field }) => (<FormItem><FormLabel>{t_form('identityDocumentTypeLabel')}</FormLabel><Select onValueChange={field.onChange} value={field.value || undefined} disabled={isSubmittingForm}><FormControl><SelectTrigger><SelectValue placeholder={t_form('identityDocumentTypePlaceholder')} /></SelectTrigger></FormControl><SelectContent>{identityDocumentTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t_form('fiscalAddressTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField name="fiscalAddress.street" render={({ field }) => (<FormItem><FormLabel>{t_form('streetLabel')}</FormLabel><FormControl><Input placeholder={t_form('streetPlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField name="postalAddress.city" render={({ field }) => (<FormItem><FormLabel>{t_form('cityLabel')}</FormLabel><FormControl><Input placeholder={t_form('cityPlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="postalAddress.postalCode" render={({ field }) => (<FormItem><FormLabel>{t_form('postalCodeLabel')}</FormLabel><FormControl><Input placeholder={t_form('postalCodePlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="postalAddress.country" render={({ field }) => (<FormItem><FormLabel>{t_form('countryLabel')}</FormLabel><FormControl><Input placeholder={t_form('countryPlaceholder')} {...field} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t_form('accountSettingsTitle')}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <FormField control={form.control} name="role" render={({ field }) => (<FormItem><FormLabel>{t_form('roleLabel')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={(isEditMode && clientToEdit?.email === auth.currentUser?.email) || isSubmittingForm}><FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl><SelectContent><SelectItem value="client">{t_form('roleClient')}</SelectItem><SelectItem value="manager">{t_form('roleManager')}</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="isActive" render={({ field }) => (<FormItem className="flex flex-row items-center justify-start space-x-3 space-y-0 rounded-md border p-4 h-16 mt-3 md:mt-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={(isEditMode && clientToEdit?.email === auth.currentUser?.email) || isSubmittingForm} /></FormControl><div className="space-y-1 leading-none"><FormLabel>{t_form('isActiveLabel')}</FormLabel></div></FormItem>)} />
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4 space-x-2">
          {isOnPage && (
             <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmittingForm || isProcessingImage}>
                <ArrowLeft className="mr-2 h-4 w-4" /> {t_form('backButton')}
             </Button>
          )}
          {!isOnPage && closeDialog && ( 
            <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmittingForm || isProcessingImage}>{t_form('cancelButton')}</Button>
          )}
          <Button type="submit" disabled={isSubmittingForm || isProcessingImage}>
            {(isSubmittingForm || isProcessingImage) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isProcessingImage ? t_image_upload('processingImage') : 
             isSubmittingForm ? (isEditMode ? t_form('savingButton') : t_form('addingButton')) : 
             (isEditMode ? t_form('saveButton') : t_form('addButton'))
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}
