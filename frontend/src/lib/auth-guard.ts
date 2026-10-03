import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

/**
 * Reconstructs the original relative URL including all query parameters
 * to preserve full state when redirecting to /signin.
 */
export function buildCallbackUrl(
  pathname: string,
  searchParams?: { [key: string]: string | string[] | undefined }
): string {
  if (!searchParams) return pathname;
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => sp.append(key, v));
    } else {
      sp.set(key, value);
    }
  }
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Node.js-compatible server-side route guard for protected pages (/analyze, /results).
 * Redirects unauthenticated users to /signin with the full callbackUrl preserved.
 */
export async function requireAuth(
  pathname: string,
  searchParams?: { [key: string]: string | string[] | undefined }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    const callbackUrl = buildCallbackUrl(pathname, searchParams);
    redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return session;
}

/**
 * Node.js-compatible server-side route guard for auth pages (/signin, /signup).
 * Redirects authenticated users to /analyze.
 */
export async function redirectIfAuthenticated(redirectTo: string = '/analyze') {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(redirectTo);
  }
}
