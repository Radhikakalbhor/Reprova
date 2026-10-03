'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { Eye, EyeOff } from 'lucide-react';
import { AuthCard } from '@/components/AuthCard';
import { GoogleButton } from '@/components/GoogleButton';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { signupFormSchema } from '@/lib/validations';

function calculatePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) return { score: 0, label: 'None', color: 'bg-gray-700' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) {
    return { score: 1, label: 'Weak', color: 'bg-rose-500' };
  } else if (score <= 3) {
    return { score: 2, label: 'Moderate', color: 'bg-amber-500' };
  } else {
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  }
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const callbackUrl = searchParams.get('callbackUrl') || '/analyze';

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/analyze');
    }
  }, [status, router]);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    // Validate on client using zod schema
    const validation = signupFormSchema.safeParse({
      username: username.trim(),
      email: email.trim(),
      password,
      confirmPassword,
    });

    if (!validation.success) {
      const errMap: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        const fieldName = err.path[0]?.toString();
        if (fieldName && !errMap[fieldName]) {
          errMap[fieldName] = err.message;
        }
      });
      setFieldErrors(errMap);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.field) {
          setFieldErrors({ [data.field]: data.error });
        } else {
          setGeneralError(data.error || 'Registration failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Automatically sign in upon successful registration
      const signInRes = await signIn('credentials', {
        identifier: username.trim(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (signInRes?.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        // Fallback: redirect to sign in if auto-login encountered an edge case
        router.push(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      }
    } catch {
      setGeneralError('A network error occurred while creating your account.');
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setGeneralError(null);
    try {
      await signIn('google', { callbackUrl });
    } catch {
      setGeneralError('Could not initialize Google authentication. Please try again.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Google OAuth Provider */}
      <div>
        <GoogleButton
          onClick={handleGoogleSignUp}
          loading={googleLoading}
          disabled={loading}
          label="Sign up with Google"
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
      {generalError && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm font-semibold rounded-xl p-3.5 flex items-start space-x-2.5"
        >
          <span className="text-base select-none leading-none">⚠️</span>
          <div className="flex-1 leading-snug">{generalError}</div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username */}
        <div>
          <label
            htmlFor="signup-username"
            className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5"
          >
            Username
          </label>
          <input
            id="signup-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (fieldErrors.username) {
                setFieldErrors((prev) => ({ ...prev, username: '' }));
              }
            }}
            disabled={loading || googleLoading}
            placeholder="researcher_42"
            required
            aria-invalid={Boolean(fieldErrors.username)}
            className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-neutral-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50 ${
              fieldErrors.username
                ? 'border-rose-500/80 focus:border-rose-500'
                : 'border-white/15 focus:border-white/60'
            }`}
          />
          {fieldErrors.username && (
            <p className="text-rose-400 text-xs font-medium mt-1.5 pl-1">
              {fieldErrors.username}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="signup-email"
            className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5"
          >
            Email Address
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) {
                setFieldErrors((prev) => ({ ...prev, email: '' }));
              }
            }}
            disabled={loading || googleLoading}
            placeholder="auditor@institution.edu"
            required
            aria-invalid={Boolean(fieldErrors.email)}
            className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-neutral-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50 ${
              fieldErrors.email
                ? 'border-rose-500/80 focus:border-rose-500'
                : 'border-white/15 focus:border-white/60'
            }`}
          />
          {fieldErrors.email && (
            <p className="text-rose-400 text-xs font-medium mt-1.5 pl-1">
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="signup-password"
            className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: '' }));
                }
              }}
              disabled={loading || googleLoading}
              placeholder="At least 8 chars with letter & number"
              required
              aria-invalid={Boolean(fieldErrors.password)}
              className={`w-full bg-white/5 border rounded-xl pl-4 pr-11 py-3 text-white placeholder-neutral-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50 ${
                fieldErrors.password
                  ? 'border-rose-500/80 focus:border-rose-500'
                  : 'border-white/15 focus:border-white/60'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-1"
            >
              {showPassword ? (
                <EyeOff width={18} height={18} style={{ width: 18, height: 18 }} />
              ) : (
                <Eye width={18} height={18} style={{ width: 18, height: 18 }} />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="text-rose-400 text-xs font-medium mt-1.5 pl-1">
              {fieldErrors.password}
            </p>
          )}

          {/* Password strength indicator */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-gray-400">Strength:</span>
                <span
                  className={
                    strength.score === 1
                      ? 'text-rose-400 font-bold'
                      : strength.score === 2
                      ? 'text-amber-400 font-bold'
                      : 'text-emerald-400 font-bold'
                  }
                >
                  {strength.label}
                </span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden flex space-x-1">
                <div
                  className={`h-full flex-1 rounded-full transition-all duration-300 ${
                    strength.score >= 1 ? strength.color : 'bg-transparent'
                  }`}
                />
                <div
                  className={`h-full flex-1 rounded-full transition-all duration-300 ${
                    strength.score >= 2 ? strength.color : 'bg-transparent'
                  }`}
                />
                <div
                  className={`h-full flex-1 rounded-full transition-all duration-300 ${
                    strength.score >= 3 ? strength.color : 'bg-transparent'
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="signup-confirm-password"
            className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5"
          >
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="signup-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }
              }}
              disabled={loading || googleLoading}
              placeholder="Confirm your password"
              required
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              className={`w-full bg-white/5 border rounded-xl pl-4 pr-11 py-3 text-white placeholder-neutral-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50 ${
                fieldErrors.confirmPassword
                  ? 'border-rose-500/80 focus:border-rose-500'
                  : 'border-white/15 focus:border-white/60'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              tabIndex={-1}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-1"
            >
              {showConfirmPassword ? (
                <EyeOff width={18} height={18} style={{ width: 18, height: 18 }} />
              ) : (
                <Eye width={18} height={18} style={{ width: 18, height: 18 }} />
              )}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="text-rose-400 text-xs font-medium mt-1.5 pl-1">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        <InteractiveHoverButton
          type="submit"
          disabled={loading || googleLoading}
          text={loading ? 'Creating account...' : 'Create Account'}
          className="w-full justify-center mt-2 py-3.5 shadow-lg shadow-white/10"
        />
      </form>

      {/* Switch to sign in */}
      <div className="text-center pt-2 border-t border-white/10 text-xs text-neutral-400">
        <span>Already have an account? </span>
        <Link
          href={`/signin${callbackUrl !== '/analyze' ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}
          className="text-white hover:text-neutral-300 font-semibold underline underline-offset-4 transition-colors"
        >
          Sign in here
        </Link>
      </div>
    </div>
  );
}

export default function SignUpClient() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="Join Reprova to audit ML research and verify code reproducibility"
    >
      <Suspense
        fallback={
          <div className="py-12 text-center text-neutral-400 text-sm">
            <div
              className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3"
              style={{ width: 24, height: 24 }}
            />
            <p>Loading sign-up form...</p>
          </div>
        }
      >
        <SignUpForm />
      </Suspense>
    </AuthCard>
  );
}
