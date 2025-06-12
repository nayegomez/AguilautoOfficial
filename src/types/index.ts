
import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface ServiceConfig {
  id: string;
  icon?: LucideIcon;
}

export interface Vehicle {
  id: string; 
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin: string;
  ownerId: string; 
  engineCode?: string;
  currentMileage?: number;
  imageUrl?: string | null; 
  imagePath?: string | null; 
  lastServiceDate?: string | Timestamp; 
  createdAt: Timestamp;
  updatedAt: Timestamp; 
}

export interface InvoiceServiceItem {
  serviceCatalogId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type InvoiceStatus = 'pending' | 'paid' | 'overdue';

export interface Invoice {
  id: string; 
  vehicleId: string;
  clientId: string; 
  invoiceNumber: string;
  date: Timestamp;
  services: InvoiceServiceItem[];
  subtotalAmount?: number; 
  vatAmount?: number;      
  totalAmount: number;
  pdfUrl?: string;
  pdfPath?: string; 
  status: InvoiceStatus; 
  notes?: string | null; 
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type IdentityDocumentType = 'DNI' | 'NIF' | 'NIE' | 'Passport' | 'Other';

export interface Client {
  id: string; 
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl?: string | null; 
  profileImagePath?: string | null; 
  identityDocument?: {
    number: string;
    type: IdentityDocumentType;
  } | null;
  phone1?: string | null;
  phone2?: string | null;
  fiscalAddress?: Address | null;
  postalAddress?: Address | null;
  role: 'client' | 'manager';
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp; 
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  description?: string;
  defaultUnitPrice?: number;
  category?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MaintenanceItem {
  id: string; 
  vehicleId: string;
  clientId: string; 
  description: string; 
  serviceTasks?: string[]; 
  dueDate?: string | null; 
  dueMileage?: number | null; 
  status: 'upcoming' | 'due' | 'completed'; 
  notes?: string | null; 
  createdAt: Timestamp; 
  updatedAt: Timestamp; 
}
