
"use client";

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, type Timestamp } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type { Client } from '@/types';
import { EditProfileForm } from '@/components/client/EditProfileForm';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const ensureClientDate = (value: any): Date => {
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  console.warn("Invalid or missing date data for manager profile, using fallback:", value);
  return new Date(0);
};

export default function ManagerProfilePage() {
  const t = useTranslations('ManagerProfilePage');
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [managerData, setManagerData] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
        setLoading(true);
        setError(null);

        try {
          const managerDocRef = doc(db, "clients", user.uid);
          const managerDocSnap = await getDoc(managerDocRef);
          if (managerDocSnap.exists()) {
            const data = managerDocSnap.data();
            if (data.role === 'manager') {
              setManagerData({
                id: managerDocSnap.id,
                ...data,
                createdAt: ensureClientDate(data.createdAt),
                updatedAt: ensureClientDate(data.updatedAt),
              } as Client);
            } else {
              setError(t('notLoggedInTitle'));
            }
          } else {
            setError(t('errorNotFound'));
          }
        } catch (err) {
          console.error("Error fetching manager data:", err);
          setError(t('errorFetching'));
        } finally {
          setLoading(false);
        }
      } else {
        setCurrentUser(null);
        setManagerData(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [t]);

  const handleProfileUpdated = (updatedManager: Client) => {
    setManagerData(updatedManager);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">{t('loadingProfile')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">{t('errorTitle')}</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild><Link href="/manager/dashboard">{t('backToDashboard')}</Link></Button>
      </div>
    );
  }

  if (!currentUser || !managerData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">{t('notLoggedInTitle')}</h2>
        <p className="text-muted-foreground mb-6">{t('notLoggedInMessage')}</p>
        <Button asChild><Link href="/manager/login">{t('goToLogin')}</Link></Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="outline" className="mb-6">
            <Link href="/manager/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t('backToDashboard')}
            </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('pageDescription')}
        </p>
      </div>
      <EditProfileForm client={managerData} onProfileUpdated={handleProfileUpdated} />
    </div>
  );
}
