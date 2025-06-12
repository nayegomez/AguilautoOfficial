
"use client";

import React from 'react';
import type { Invoice, InvoiceStatus } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, FileText, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import type { Timestamp } from 'firebase/firestore';
import { useTranslations } from 'next-intl';

interface InvoiceListProps {
  invoices: Invoice[];
}

const formatInvoiceDate = (dateValue: Timestamp | undefined): string => {
  if (dateValue && typeof dateValue.toDate === 'function') {
    return dateValue.toDate().toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  return 'N/A';
};

const getClientInvoiceStatusDisplay = (status: InvoiceStatus, t: (key: string) => string) => {
    switch (status) {
      case 'paid':
        return <span className="flex items-center text-green-600"><CheckCircle2 className="mr-1 h-4 w-4" />{t('statusPaid')}</span>;
      case 'pending':
        return <span className="flex items-center text-red-600"><XCircle className="mr-1 h-4 w-4" />{t('statusPending')}</span>;
      case 'overdue':
        return <span className="flex items-center text-yellow-600"><AlertCircle className="mr-1 h-4 w-4" />{t('statusOverdue')}</span>;
      default:
        const translatedStatus = t(`status${status.charAt(0).toUpperCase() + status.slice(1)}` as any);
        return <span className="text-muted-foreground">{translatedStatus || status}</span>;
    }
};


export function InvoiceList({ invoices }: InvoiceListProps) {
  const t = useTranslations('InvoiceList');
  const commonT = useTranslations();

  const numberOfColumns = 5;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">{t('title')}</CardTitle>
        </div>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('invoiceNumberHeader')}</TableHead>
                <TableHead>{t('dateHeader')}</TableHead>
                <TableHead>{t('statusHeader')}</TableHead>
                <TableHead>{t('totalAmountHeader')}</TableHead>
                <TableHead className="text-right">{t('downloadHeader')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <React.Fragment key={invoice.id}>
                  <TableRow>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{formatInvoiceDate(invoice.date)}</TableCell>
                    <TableCell>{getClientInvoiceStatusDisplay(invoice.status, commonT)}</TableCell>
                    <TableCell>{invoice.totalAmount.toFixed(2)}€</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild disabled={!invoice.pdfUrl || invoice.pdfUrl === '#'}>
                        <Link href={invoice.pdfUrl || '#'} target="_blank" rel="noopener noreferrer" aria-label={`Download invoice ${invoice.invoiceNumber}`}>
                          <Download className="h-4 w-4 mr-2" />
                          {t('pdf')}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                  {invoice.notes && (
                    <TableRow className="bg-secondary/30 hover:bg-secondary/40">
                      <TableCell colSpan={numberOfColumns} className="py-2 px-4 text-xs text-muted-foreground italic">
                        <strong>{t('notesLabel')}</strong> {invoice.notes}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-center py-4">{t('noInvoices')}</p>
        )}
      </CardContent>
    </Card>
  );
}

    