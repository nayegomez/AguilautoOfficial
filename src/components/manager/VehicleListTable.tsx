
"use client";
import Link from 'next/link';
import type { Vehicle } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

interface EnrichedVehicle extends Vehicle {
  ownerName?: string;
  ownerDni?: string;
}

interface VehicleListTableProps {
  vehicles: EnrichedVehicle[];
}

export function VehicleListTable({ vehicles }: VehicleListTableProps) {
  const t = useTranslations('ManagerDashboardPage.VehicleListTable');

  return (
    <div className="rounded-lg border shadow-sm bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('tableHeaderMake')}</TableHead>
            <TableHead>{t('tableHeaderModel')}</TableHead>
            <TableHead>{t('tableHeaderYear')}</TableHead>
            <TableHead>{t('tableHeaderLicensePlate')}</TableHead>
            <TableHead>{t('tableHeaderOwnerName')}</TableHead>
            <TableHead>{t('tableHeaderOwnerDNI')}</TableHead>
            <TableHead className="text-right">{t('tableHeaderActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.map((vehicle) => (
            <TableRow key={vehicle.id}>
              <TableCell className="font-medium">{vehicle.make}</TableCell>
              <TableCell>{vehicle.model}</TableCell>
              <TableCell>{vehicle.year}</TableCell>
              <TableCell>
                <Badge variant="secondary">{vehicle.licensePlate}</Badge>
              </TableCell>
              <TableCell>{vehicle.ownerName || 'N/A'}</TableCell>
              <TableCell>{vehicle.ownerDni || 'N/A'}</TableCell>
              <TableCell className="text-right">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/manager/vehicle/${vehicle.id}`}>
                    <Edit3 className="mr-2 h-4 w-4" /> {t('actionManage')}
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
