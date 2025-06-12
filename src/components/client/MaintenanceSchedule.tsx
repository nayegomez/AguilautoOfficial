
"use client";

import type { MaintenanceItem } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarClock, Wrench, AlertTriangle, Phone, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MaintenanceScheduleProps {
  items: MaintenanceItem[];
}

function getStatusVariant(status: MaintenanceItem['status']): "default" | "destructive" | "secondary" {
  switch (status) {
    case 'due': return 'destructive';
    case 'upcoming': return 'default';
    case 'completed': return 'secondary';
    default: return 'default';
  }
}

function getStatusIcon(status: MaintenanceItem['status']) {
  switch (status) {
    case 'due': return <AlertTriangle className="h-5 w-5 text-destructive" />;
    case 'upcoming': return <CalendarClock className="h-5 w-5 text-primary" />;
    case 'completed': return <Wrench className="h-5 w-5 text-muted-foreground" />;
    default: return <CalendarClock className="h-5 w-5 text-primary" />;
  }
}

const formatDateForDisplay = (dateString?: string | null, locale?: string): string => {
  if (!dateString) return 'N/A';

  const parts = dateString.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    const date = new Date(Date.UTC(year, month, day));

    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      });
    }
  }

  const fallbackDate = new Date(dateString);
  if (!isNaN(fallbackDate.getTime())) {
    return fallbackDate.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
  }
  
  return dateString;
};


export function MaintenanceSchedule({ items }: MaintenanceScheduleProps) {
  const t = useTranslations('MaintenanceSchedule');

  const activeItems = items.filter(item => item.status === 'upcoming' || item.status === 'due');

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
        </div>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        {activeItems.length > 0 ? (
          <ScrollArea className="flex-grow h-[300px] pr-4"> {/* Ensure ScrollArea can grow */}
            <ul className="space-y-4">
              {activeItems.map((item) => (
                <li key={item.id} className="p-4 border rounded-lg bg-card flex flex-col gap-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 pt-1">
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="flex-grow">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-semibold text-md">{item.description}</h4>
                        <Badge variant={getStatusVariant(item.status)} className="capitalize text-xs whitespace-nowrap">
                          {t(`status_${item.status}` as any, {}, {
                            fallback: () => item.status
                          })}
                        </Badge>
                      </div>
                      {(item.dueDate || item.dueMileage != null) && (
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {item.dueDate && <p>{t('dueDate')}: {formatDateForDisplay(item.dueDate)}</p>}
                          {item.dueMileage != null && <p>{t('dueMileage')}: {item.dueMileage.toLocaleString()} km</p>}
                        </div>
                      )}
                    </div>
                  </div>
                  {item.serviceTasks && item.serviceTasks.length > 0 && (
                    <div className="ml-8 mt-1 pl-1 border-l-2 border-primary/20">
                      <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                        {item.serviceTasks.map((task, index) => (
                          <li key={index}>{task}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.notes && (
                    <p className="text-xs text-muted-foreground mt-1 ml-8 italic">Notas: {item.notes}</p>
                  )}
                  {(item.status === 'upcoming' || item.status === 'due') && (
                    <div className="ml-auto mt-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" className="bg-accent hover:bg-accent/90 text-accent-foreground text-xs">
                            {t('requestAppointmentButton')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2 shadow-lg rounded-md">
                          <div className="flex flex-col space-y-2">
                            <Button asChild variant="ghost" size="sm" className="justify-start text-xs">
                              <a href="tel:+34957661098" className="flex items-center">
                                <Phone className="mr-2 h-3.5 w-3.5" /> {t('callButton')}
                              </a>
                            </Button>
                            <Button asChild variant="ghost" size="sm" className="justify-start text-xs">
                              <a href={`https://wa.me/34660078842?text=${encodeURIComponent(t('appointmentMessageDefault', {vehicle: item.description}))}`} target="_blank" rel="noopener noreferrer" className="flex items-center">
                                <MessageSquare className="mr-2 h-3.5 w-3.5" /> {t('whatsappButton')}
                              </a>
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <p className="text-muted-foreground text-center py-4 flex-grow flex items-center justify-center">{t('noUpcomingItems')}</p>
        )}
      </CardContent>
    </Card>
  );
}
