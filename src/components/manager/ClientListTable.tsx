
"use client";

import type { Client } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit3, UserX, UserCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface ClientListTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onToggleActive: (client: Client) => void;
}

export function ClientListTable({ clients, onEdit, onToggleActive }: ClientListTableProps) {
  const t = useTranslations('ManagerClientsPage');

  return (
    <div className="rounded-lg border shadow-sm bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[150px]">{t('tableHeaderName')}</TableHead>
            <TableHead className="min-w-[200px]">{t('tableHeaderEmail')}</TableHead>
            <TableHead className="hidden md:table-cell min-w-[120px]">{t('tableHeaderPhone')}</TableHead>
            <TableHead className="hidden lg:table-cell min-w-[100px]">{t('tableHeaderDNI')}</TableHead>
            <TableHead className="min-w-[80px]">{t('tableHeaderStatus')}</TableHead>
            <TableHead className="text-right min-w-[120px]">{t('tableHeaderActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id} className={!client.isActive ? "opacity-60" : ""}>
              <TableCell className="font-medium max-w-[150px] sm:max-w-none truncate">{client.firstName} {client.lastName}</TableCell>
              <TableCell className="max-w-[200px] sm:max-w-none truncate">{client.email}</TableCell>
              <TableCell className="hidden md:table-cell">{client.phone1 || 'N/A'}</TableCell>
              <TableCell className="hidden lg:table-cell">{client.identityDocument?.number || 'N/A'}</TableCell>
              <TableCell>
                <Badge variant={client.isActive ? "default" : "secondary"} className={client.isActive ? "bg-green-500 hover:bg-green-600" : "bg-muted-foreground/30 hover:bg-muted-foreground/40"}>
                  {client.isActive ? t('statusActive') : t('statusInactive')}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-1 whitespace-nowrap">
                <Button variant="outline" size="icon" onClick={() => onEdit(client)} aria-label={t('actionEdit')}>
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button 
                  variant={client.isActive ? "destructive" : "outline"} 
                  size="icon" 
                  onClick={() => onToggleActive(client)}
                  aria-label={client.isActive ? t('actionDeactivate') : t('actionActivate')}
                >
                  {client.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
