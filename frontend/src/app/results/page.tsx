import { requireAuth } from '@/lib/auth-guard';
import ResultsClient from './ResultsClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function ResultsPage({ searchParams }: PageProps) {
  await requireAuth('/results', searchParams);
  return <ResultsClient />;
}
