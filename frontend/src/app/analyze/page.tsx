import { requireAuth } from '@/lib/auth-guard';
import AnalyzeClient from './AnalyzeClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function AnalyzePage({ searchParams }: PageProps) {
  await requireAuth('/analyze', searchParams);
  return <AnalyzeClient />;
}
