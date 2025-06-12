
"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ClipboardList, LogOut, Users, BookMarked, FileText, UserCircle, HelpCircle } from 'lucide-react'; 
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
import { auth, db } from '@/lib/firebase'; 
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'; 
import { doc, getDoc } from 'firebase/firestore'; 
import { useEffect, useState } from 'react'; 
import type { Client } from '@/types'; 

const LanguageSwitcher = dynamic(() => import('./LanguageSwitcher').then(mod => mod.LanguageSwitcher), { ssr: false });

const YOUTUBE_HELP_URL_MANAGER = "https://youtu.be/S2DWiD4NqNc";

export function ManagerHeader() {
  const router = useRouter();
  const t = useTranslations('ManagerHeader');
  const locale = useLocale();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [managerData, setManagerData] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const managerDocRef = doc(db, "clients", user.uid);
          const managerDocSnap = await getDoc(managerDocRef);
          if (managerDocSnap.exists()) {
            const data = managerDocSnap.data() as Client;
            if (data.role === 'manager') {
              setManagerData(data);
            } else {
              setManagerData(null);
              console.warn("User is not a manager:", user.uid);
            }
          } else {
            setManagerData(null); 
            console.warn("Manager document not found in Firestore for UID:", user.uid);
          }
        } catch (error) {
          console.error("Error fetching manager document:", error);
          setManagerData(null);
        }
      } else {
        setManagerData(null);
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
    if (managerData?.firstName && managerData?.lastName) {
      return `${managerData.firstName.charAt(0)}${managerData.lastName.charAt(0)}`.toUpperCase();
    }
    if (managerData?.firstName) {
      return managerData.firstName.substring(0, 2).toUpperCase();
    }
    if (currentUser?.email) {
      return currentUser.email.substring(0, 2).toUpperCase();
    }
    return "MGR"; 
  };

  return (
    <header className="bg-card shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/manager/dashboard" className="flex items-center gap-2 text-2xl font-bold text-primary hover:text-primary/90 transition-colors">
          <Image src="/icon.png" alt={t('appName')} width={28} height={28} 
                unoptimized />
          <span>{t('appName')}</span>
        </Link>
        <nav className="flex items-center gap-1 md:gap-2 flex-wrap justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/manager/dashboard" className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              <span className="hidden sm:inline">{t('vehicleManagement')}</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/manager/clients" className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span className="hidden sm:inline">{t('clientManagement')}</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/manager/service-catalog" className="flex items-center gap-2">
              <BookMarked className="h-5 w-5" />
              <span className="hidden sm:inline">{t('serviceCatalog')}</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/manager/invoices" className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <span className="hidden sm:inline">{t('invoiceManagement')}</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2 ml-2">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label="Help"
            >
              <Link href={YOUTUBE_HELP_URL_MANAGER} target="_blank" rel="noopener noreferrer">
                <HelpCircle className="h-5 w-5" />
              </Link>
            </Button>
            {loading ? (
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            ) : currentUser && managerData ? ( 
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={managerData?.profileImageUrl || "https://placehold.co/40x40.png"} alt="Manager Avatar" />
                      <AvatarFallback>{getAvatarFallback()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {managerData?.firstName || "Manager"} {managerData?.lastName || ""}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {currentUser.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/manager/profile">
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
            ) : currentUser && !managerData && !loading ? (
              <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('logout')}</span>
                </Button>
            ) : (
              <Link href="/manager/login">
                  <Button variant="outline">
                      {t('login')}
                  </Button>
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
