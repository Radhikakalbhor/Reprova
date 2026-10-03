'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { Eye, EyeOff } from 'lucide-react';
import { AuthCard } from '@/components/AuthCard';
import { GoogleButton } from '@/components/GoogleButton';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: 'Invalid email/username or password.',
  OAuthAccountNotLinked:
    'An account already exists with this email address. Please sign in with your original method.',
  OAuthSignin: 'Could not sign in with Google. Please try again.',
  OAuthCallback: 'Google authorization callback failed. Please try again.',
  AccessDenied: 'Access denied. You do not have permission to sign in.',
  Default: 'Unable to sign in. Please verify your credentials and try again.',
};

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const callbackUrl = searchParams.get('callbackUrl') || '/analyze';
  const urlError = searchParams.get('error');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    urlError ? ERROR_MESSAGES[urlError] || ERROR_MESSAGES.Default : null
  );

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/analyze');
    }
  }, [status, router]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter both your email/username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await signIn('credentials', {
        identifier: identifier.trim(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (!res) {
        setErrorMessage('Authentication request failed. Please try again.');
        return;
      }

      if (res.error) {
        // NextAuth passes error string back
        setErrorMessage(
          res.error === 'CredentialsSignin'
            ? ERROR_MESSAGES.CredentialsSignin
            : res.error || ERROR_MESSAGES.Default
        );
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setErrorMessage('An unexpected connection error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);
    try {
      await signIn('google', { callbackUrl });
    } catch {
      setErrorMessage('Could not initialize Google sign-in. Please try again.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Google OAuth Provider */}
      <div>
        <GoogleButton
          onClick={handleGoogleSignIn}
          loading={googleLoading}
          disabled={loading}
          label="Continue with Google"
        />
      </div>

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="border-t border-white/10 w-full" />
        <span className="bg-neutral-900/90 px-3 text-xs uppercase font-mono tracking-wider text-neutral-400 absolute">
          or with email
        </span>
      </div>

      {/* Error alert banner */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm font-semibold rounded-xl p-3.5 flex items-start space-x-2.5 animate-fadeIn"
        >
          <span className="text-base select-none leading-none">⚠️</span>
          <div className="flex-1 leading-snug">{errorMessage}</div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="signin-identifier"
            className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5"
          >
            Email or Username
          </label>
          <input
            id="signin-identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={loading || googleLoading}
            placeholder="name@institution.edu or username"
            required
            className="w-full bg-white/5 border border-white/15 focus:border-white/60 rounded-xl px-4 py-3 text-white placeholder-neutral-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="signin-password"
            className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="signin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || googleLoading}
              placeholder="••••••••••••"
              required
              className="w-full bg-white/5 border border-white/15 focus:border-white/60 rounded-xl pl-4 pr-11 py-3 text-white placeholder-neutral-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors p-1"
            >
              {showPassword ? (
                <EyeOff width={18} height={18} style={{ width: 18, height: 18 }} />
              ) : (
                <Eye width={18} height={18} style={{ width: 18, height: 18 }} />
              )}
            </button>
          </div>
        </div>

        <InteractiveHoverButton
          type="submit"
          disabled={loading || googleLoading}
          text={loading ? 'Signing in...' : 'Sign in to Reprova'}
          className="w-full justify-center mt-2 py-3.5 shadow-lg shadow-white/10"
        />
      </form>

      {/* Switch to sign up */}
      <div className="text-center pt-2 border-t border-white/10 text-xs text-neutral-400">
        <span>Don&apos;t have an account? </span>
        <Link
          href={`/signup${callbackUrl !== '/analyze' ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}
          className="text-white hover:text-neutral-300 font-semibold underline underline-offset-4 transition-colors"
        >
          Create one now
        </Link>
      </div>
    </div>
  );
}

export default function SignInClient() {
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to access research audits and reproducibility workflows"
    >
      <Suspense
        fallback={
          <div className="py-12 text-center text-neutral-400 text-sm">
            <div
              className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3"
              style={{ width: 24, height: 24 }}
            />
            <p>Loading sign-in form...</p>
          </div>
        }
      >
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
