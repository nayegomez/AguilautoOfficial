import { redirect } from 'next/navigation';
import { defaultLocale } from '@/i18n';

export default function RootMarketingPage() {
  redirect(`/${defaultLocale}`);
}
