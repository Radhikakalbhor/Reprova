import { redirectIfAuthenticated } from '@/lib/auth-guard';
import SignUpClient from './SignUpClient';

export const dynamic = 'force-dynamic';

export default async function SignUpPage() {
  await redirectIfAuthenticated('/analyze');
  return <SignUpClient />;
}
