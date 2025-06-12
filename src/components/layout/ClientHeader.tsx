
"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, LogOut, UserCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslations, useLocale } from 'next-intl';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Client } from '@/types';

const LanguageSwitcher = dynamic(() => import('./LanguageSwitcher').then(mod => mod.LanguageSwitcher), { ssr: false });

const YOUTUBE_HELP_URL_CLIENT = "https://youtu.be/klHM-kO3qMA";

export function ClientHeader() {
  const router = useRouter();
  const t = useTranslations('ClientHeader');
  const locale = useLocale();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [clientData, setClientData] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const clientDocRef = doc(db, "clients", user.uid);
          const clientDocSnap = await getDoc(clientDocRef);
          if (clientDocSnap.exists()) {
            setClientData({ id: clientDocSnap.id, ...clientDocSnap.data() } as Client);
          } else {
            setClientData(null); 
            console.warn("Client document not found in Firestore for UID:", user.uid);
          }
        } catch (error) {
          console.error("Error fetching client document:", error);
          setClientData(null);
        }
      } else {
        setClientData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push(`/${locale}`); 
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const getAvatarFallback = () => {
    if (clientData?.firstName && clientData?.lastName) {
      return `${clientData.firstName.charAt(0)}${clientData.lastName.charAt(0)}`.toUpperCase();
    }
    if (clientData?.firstName) {
      return clientData.firstName.substring(0, 2).toUpperCase();
    }
    if (currentUser?.email) {
      return currentUser.email.substring(0, 2).toUpperCase();
    }
    return "U"; 
  };

  return (
    <header className="bg-card shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/client/dashboard" className="flex items-center gap-2 text-2xl font-bold text-primary hover:text-primary/90 transition-colors">
          <Image src="/icon.png" alt={t('appName')} width={28} height={28} />
          <span>{t('appName')}</span>
        </Link>
        <nav className="flex items-center gap-4">
          {currentUser && (
            <Button variant="ghost" asChild>
              <Link href="/client/dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                {t('dashboard')}
              </Link>
            </Button>
          )}
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="Help" 
          >
            <Link href={YOUTUBE_HELP_URL_CLIENT} target="_blank" rel="noopener noreferrer">
              <HelpCircle className="h-5 w-5" />
            </Link>
          </Button>
          {loading ? (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          ) : currentUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage 
                      src={clientData?.profileImageUrl || currentUser.photoURL || "https://placehold.co/40x40.png"} 
                      alt={clientData?.firstName || currentUser.displayName || "User Avatar"} 
                    />
                    <AvatarFallback>{getAvatarFallback()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {clientData?.firstName || currentUser.displayName || "User"} {clientData?.lastName || ""}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {currentUser.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/client/profile">
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>{t('profile')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
                <Link href="/login">{t('login', {ns: 'ClientHeader'})}</Link> 
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
