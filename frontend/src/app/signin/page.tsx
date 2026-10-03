import { redirectIfAuthenticated } from '@/lib/auth-guard';
import SignInClient from './SignInClient';

export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  await redirectIfAuthenticated('/analyze');
  return <SignInClient />;
}
