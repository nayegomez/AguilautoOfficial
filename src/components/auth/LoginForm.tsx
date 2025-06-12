
"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Wrench, UserPlus, Loader2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { auth, db } from "@/lib/firebase";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  type UserCredential,
  type User
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp, type Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/types";
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

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px" fillRule="evenodd" clipRule="evenodd">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

const createOrUpdateClientDocument = async (user: User, formFirstName?: string, formLastName?: string): Promise<void> => {
  if (!user) {
    console.error("[LoginForm - createOrUpdateClientDocument] No user provided.");
    throw new Error("No user data for client document creation.");
  }

  const clientRef = doc(db, "clients", user.uid);
  const now = serverTimestamp(); 

  try {
    const clientSnap = await getDoc(clientRef);
    let firstNameToUse: string;
    let lastNameToUse: string;

    if (formFirstName && formLastName) {
      firstNameToUse = formFirstName;
      lastNameToUse = formLastName;
    } else {
      const displayNameParts = user.displayName?.split(' ') || [];
      firstNameToUse = displayNameParts[0] || user.email?.split('@')[0] || 'New';
      lastNameToUse = displayNameParts.length > 1 ? displayNameParts.slice(1).join(' ') : 'User';
    }
    
    const emailToStore = user.email || '';
    if (!emailToStore) {
        throw new Error("User email is missing during client document creation.");
    }

    if (!clientSnap.exists()) {
      const newClientData = {
        firstName: firstNameToUse,
        lastName: lastNameToUse,
        email: emailToStore,
        profileImageUrl: user.photoURL || null,
        role: 'client' as 'client' | 'manager',
        isActive: false, 
        createdAt: now,
        updatedAt: now,
        phone1: null,
        phone2: null,
        identityDocument: null,
        fiscalAddress: null,
        postalAddress: null,
      };
      await setDoc(clientRef, newClientData);
    } else {
      const existingData = clientSnap.data() as Client;
      const updateData: Partial<Omit<Client, 'id' | 'createdAt'>> & { updatedAt: unknown } = {
        updatedAt: now,
        email: user.email || existingData.email || null, 
        profileImageUrl: user.photoURL || existingData.profileImageUrl || null, 
      };
      
      if (formFirstName && formLastName) {
        if (formFirstName !== existingData.firstName) updateData.firstName = formFirstName;
        if (formLastName !== existingData.lastName) updateData.lastName = formLastName;
      } else { 
        const currentAuthFirstName = user.displayName?.split(' ')[0] || '';
        const currentAuthLastName = user.displayName?.split(' ').slice(1).join(' ') || '';

        if (currentAuthFirstName && currentAuthFirstName !== existingData.firstName) {
          updateData.firstName = currentAuthFirstName;
        }
        if (currentAuthLastName && currentAuthLastName !== existingData.lastName) {
          updateData.lastName = currentAuthLastName;
        }
      }
      
      if (Object.keys(updateData).length > 1 || (updateData.email && !existingData.email) || (updateData.profileImageUrl && !existingData.profileImageUrl)) {
        await setDoc(clientRef, updateData, { merge: true });
      } else {
        await setDoc(clientRef, { updatedAt: now }, { merge: true });
      }
    }
  } catch (error) {
    console.error("[LoginForm - createOrUpdateClientDocument] CRITICAL ERROR creating/updating client document in Firestore:", error);
    throw error; 
  }
};

export function LoginForm() {
  const router = useRouter();
  const t = useTranslations('LoginForm');
  const { toast } = useToast();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);

  const currentFormSchema = z.object({
    email: z.string().email({ message: t('invalidEmailError') }),
    password: z.string().min(6, { message: t('passwordLengthError', { minLength: 6 }) }),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  });

  const resetPasswordSchema = z.object({
    resetEmail: z.string().email({ message: t('invalidEmailError') }),
  });

  const form = useForm<z.infer<typeof currentFormSchema>>({
    resolver: zodResolver(currentFormSchema),
    defaultValues: { email: "", password: "", firstName: "", lastName: "" },
  });

  const resetPasswordForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { resetEmail: "" },
  });

  const onSubmit = async (values: z.infer<typeof currentFormSchema>) => {
    if (authMode === 'register') {
      if (!values.firstName || values.firstName.length < 2 || !values.lastName || values.lastName.length < 2) {
        form.setError("firstName", { type: "manual", message: t('firstNameRequiredError') });
        form.setError("lastName", { type: "manual", message: t('lastNameRequiredError') });
        toast({ title: t('registerMessages.errorTitle'), description: t('registerMessages.errorMissingName'), variant: "destructive" });
        return;
      }
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        await createOrUpdateClientDocument(userCredential.user, values.firstName, values.lastName);
        toast({ title: t('registerMessages.successTitle'), description: t('registerMessages.successDescription') });
        form.reset(); 
      } catch (error: any) {
        let description = t('registerMessages.errorGeneric', { error: error.message });
        if (error.code === 'auth/email-already-in-use') description = t('registerMessages.errorEmailExists');
        else if (error.code === 'auth/weak-password') description = t('registerMessages.errorWeakPassword');
        toast({ title: t('registerMessages.errorTitle'), description, variant: "destructive" });
      }
    } else {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
        const clientDocRef = doc(db, "clients", userCredential.user.uid);
        const clientDocSnap = await getDoc(clientDocRef);
        if (clientDocSnap.exists()) {
          const clientData = clientDocSnap.data() as Client;
          if (clientData.isActive) {
            await createOrUpdateClientDocument(userCredential.user); 
            toast({ title: t('signInMessages.emailSuccessTitle'), description: t('signInMessages.emailSuccessDescription') });
            router.push("/client/dashboard");
          } else {
            await auth.signOut(); 
            toast({ title: t('signInMessages.errorTitle'), description: t('signInMessages.errorAccountInactive'), variant: "destructive" });
          }
        } else {
          await createOrUpdateClientDocument(userCredential.user); 
          await auth.signOut();
          toast({ title: t('signInMessages.errorTitle'), description: t('signInMessages.errorAccountInactive'), variant: "destructive" });
        }
      } catch (error: any) {
        toast({ title: t('signInMessages.errorTitle'), description: t('signInMessages.errorInvalidCredentials'), variant: "destructive" });
      }
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result: UserCredential = await signInWithPopup(auth, provider);
      const user = result.user;
      await createOrUpdateClientDocument(user); 
      const clientDocRef = doc(db, "clients", user.uid);
      const clientDocSnap = await getDoc(clientDocRef);
      if (clientDocSnap.exists()) {
        const clientData = clientDocSnap.data() as Client;
        if (clientData.isActive) {
          toast({ title: t('signInMessages.googleSuccessTitle'), description: t('signInMessages.googleSuccessDescription', { name: user.displayName || user.email }) });
          router.push("/client/dashboard");
        } else {
          await auth.signOut(); 
          toast({ title: t('registerMessages.successTitle'), description: t('registerMessages.successDescription') });
        }
      } else {
        await auth.signOut();
        toast({ title: t('registerMessages.errorTitle'), description: t('registerMessages.errorGeneric', { error: "Failed to set up client account details."}), variant: "destructive" });
      }
    } catch (error: any) {
      let description = t('signInMessages.googleErrorDescription', { error: error.message });
      if (error.code === 'auth/account-exists-with-different-credential') description = "An account already exists with the same email address but different sign-in credentials. Try signing in using a different method linked to this email.";
      else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-blocked') {
        description = "Google Sign-In popup was closed or blocked. Please ensure popups are enabled and try again.";
        toast({ title: t('signInMessages.googleErrorTitle'), description, variant: "default" });
        return;
      }
      toast({ title: t('signInMessages.googleErrorTitle'), description, variant: "destructive" });
    }
  };

  const handlePasswordResetRequest = async (data: z.infer<typeof resetPasswordSchema>) => {
    setIsSendingResetLink(true);
    try {
      await sendPasswordResetEmail(auth, data.resetEmail);
      toast({
        title: t('ResetPasswordDialog.successTitle'),
        description: t('ResetPasswordDialog.successDescription', { email: data.resetEmail }),
      });
      setIsResetPasswordDialogOpen(false);
      resetPasswordForm.reset();
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      toast({
        title: t('ResetPasswordDialog.errorTitle'),
        description: t('ResetPasswordDialog.errorDescription', { error: error.message }),
        variant: "destructive",
      });
    } finally {
      setIsSendingResetLink(false);
    }
  };

  const toggleAuthMode = () => {
    setAuthMode(prevMode => prevMode === 'login' ? 'register' : 'login');
    form.reset(); 
  };

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <div className="inline-flex justify-center items-center mb-4">
          {authMode === 'login' ? <Wrench className="h-10 w-10 text-primary" /> : <UserPlus className="h-10 w-10 text-primary" />}
        </div>
        <CardTitle className="text-3xl font-bold text-primary">{authMode === 'login' ? t('title') : t('registerTitle')}</CardTitle>
        <CardDescription>{authMode === 'login' ? t('description') : t('registerDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {authMode === 'register' && (
              <>
                <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>{t('firstNameLabel')}</FormLabel><FormControl><Input placeholder={t('firstNamePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>{t('lastNameLabel')}</FormLabel><FormControl><Input placeholder={t('lastNamePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
              </>
            )}
            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>{t('emailLabel')}</FormLabel><FormControl><Input placeholder={t('emailPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>{t('passwordLabel')}</FormLabel><FormControl><Input type="password" placeholder={t('passwordPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90">{authMode === 'login' ? t('signInButton') : t('registerButton')}</Button>
          </form>
        </Form>
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t('orContinueWith')}</span></div>
        </div>
        <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}><GoogleIcon /><span className="ml-2">{t('signInWithGoogleButton')}</span></Button>
      </CardContent>
      <CardFooter className="flex flex-col items-center text-sm space-y-2 pt-2">
        {authMode === 'login' && (
          <AlertDialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="link" className="p-0 h-auto text-sm text-primary hover:underline">
                {t('forgotPasswordLink')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('ResetPasswordDialog.title')}</AlertDialogTitle>
                <AlertDialogDescription>{t('ResetPasswordDialog.description')}</AlertDialogDescription>
              </AlertDialogHeader>
              <Form {...resetPasswordForm}>
                <form onSubmit={resetPasswordForm.handleSubmit(handlePasswordResetRequest)} className="space-y-4">
                  <FormField
                    control={resetPasswordForm.control}
                    name="resetEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('ResetPasswordDialog.emailLabel')}</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder={t('ResetPasswordDialog.emailPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSendingResetLink}>{t('ResetPasswordDialog.cancelButton')}</AlertDialogCancel>
                    <Button type="submit" disabled={isSendingResetLink}>
                      {isSendingResetLink && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('ResetPasswordDialog.sendButton')}
                    </Button>
                  </AlertDialogFooter>
                </form>
              </Form>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button variant="link" onClick={toggleAuthMode} className="p-0 h-auto text-primary hover:underline">
          {authMode === 'login' ? t('switchToRegister') : t('switchToLogin')}
        </Button>
        <Button variant="link" asChild className="p-0 h-auto text-primary hover:underline">
          <Link href="/">{t('backToHome')}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
