
"use client";

import type { ServiceCatalogItem } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit3, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ServiceCatalogListTableProps {
  services: ServiceCatalogItem[];
  onEdit: (service: ServiceCatalogItem) => void;
  onToggleActive: (service: ServiceCatalogItem) => void;
}

export function ServiceCatalogListTable({ services, onEdit, onToggleActive }: ServiceCatalogListTableProps) {
  const t = useTranslations('ManagerServiceCatalogPage');

  return (
    <div className="rounded-lg border shadow-sm bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('tableHeaderName')}</TableHead>
            <TableHead className="hidden sm:table-cell">{t('tableHeaderDescription')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('tableHeaderPrice')}</TableHead>
            <TableHead className="hidden lg:table-cell">{t('tableHeaderCategory')}</TableHead>
            <TableHead>{t('tableHeaderStatus')}</TableHead>
            <TableHead className="text-right">{t('tableHeaderActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service) => (
            <TableRow key={service.id} className={!service.isActive ? "opacity-60" : ""}>
              <TableCell className="font-medium">{service.name}</TableCell>
              <TableCell className="hidden sm:table-cell text-sm text-muted-foreground truncate max-w-xs">
                {service.description || 'N/A'}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {service.defaultUnitPrice !== undefined ? `${service.defaultUnitPrice.toFixed(2)}€` : 'N/A'}
              </TableCell>
              <TableCell className="hidden lg:table-cell">{service.category || 'N/A'}</TableCell>
              <TableCell>
                <Badge variant={service.isActive ? "default" : "secondary"} className={service.isActive ? "bg-green-500 hover:bg-green-600" : ""}>
                  {service.isActive ? t('statusActive') : t('statusInactive')}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button variant="outline" size="icon" onClick={() => onEdit(service)} aria-label={t('actionEdit')}>
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button 
                  variant={service.isActive ? "destructive" : "outline"} 
                  size="icon" 
                  onClick={() => onToggleActive(service)}
                  aria-label={service.isActive ? t('actionDeactivate') : t('actionActivate')}
                >
                  {service.isActive ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
