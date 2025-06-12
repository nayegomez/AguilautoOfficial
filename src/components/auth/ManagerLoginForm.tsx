
"use client";

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
import { UserCog } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import type { Client } from "@/types";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export function ManagerLoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('ManagerLoginForm');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      if (user) {
        console.log("Firebase Auth successful for:", user.email, "UID:", user.uid);
        const clientDocRef = doc(db, "clients", user.uid);
        const clientDocSnap = await getDoc(clientDocRef);

        if (clientDocSnap.exists()) {
          const clientData = clientDocSnap.data() as Client;
          console.log("Client document found:", clientData);
          if (clientData.role === 'manager') {
            toast({
              title: t('signInMessages.successTitle'),
              description: t('signInMessages.successDescription'),
            });
            router.push("/manager/dashboard");
          } else {
            console.log("User is not a manager. Role:", clientData.role);
            toast({
              title: t('signInMessages.errorTitle'),
              description: t('signInMessages.errorNotAuthorized'),
              variant: "destructive",
            });
          }
        } else {
          console.log("No client document found in Firestore for UID:", user.uid);
          toast({
            title: t('signInMessages.errorTitle'),
            description: t('signInMessages.errorNotAuthorized') + " (User record not found in DB)",
            variant: "destructive",
          });
        }
      } else {
        console.error("Firebase Auth successful but user object is null.");
        toast({
          title: t('signInMessages.errorTitle'),
          description: t('signInMessages.errorGeneric', { error: "Authentication succeeded but no user data was returned." }),
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Manager login error:", error);
      let description = t('signInMessages.errorInvalidCredentials');
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = t('signInMessages.errorInvalidCredentials');
      } else if (error.code) {
        description = t('signInMessages.errorGeneric', { error: `Firebase error: ${error.code}` });
      } else {
        description = t('signInMessages.errorGeneric', { error: error.message });
      }
      toast({
        title: t('signInMessages.errorTitle'),
        description: description,
        variant: "destructive",
      });
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <div className="inline-flex justify-center items-center mb-4">
            <UserCog className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-3xl font-bold text-primary">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('emailLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('emailPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('passwordLabel')}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={t('passwordPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
              {t('signInButton')}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col items-center text-sm">
        <Button variant="link" asChild className="p-0 h-auto mt-2 text-primary">
          <Link href="/">{t('backToHome')}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
