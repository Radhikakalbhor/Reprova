'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { UserMenu } from '@/components/UserMenu';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';

interface HeaderProps {
  theme?: 'dark' | 'light';
}

export function Header({ theme = 'dark' }: HeaderProps) {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLight = theme === 'light';
  const isAuthenticated = status === 'authenticated' && session?.user;

  return (
    <header className="relative z-50 transition-all bg-transparent">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between relative">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center space-x-3 group text-inherit no-underline">
          <div
            className="w-8 h-8 rounded-lg bg-neutral-900 border border-white/25 flex items-center justify-center font-bold text-white shadow-md shadow-white/5 group-hover:scale-105 transition-transform"
            style={{ width: 32, height: 32, minWidth: 32, minHeight: 32, maxWidth: 32, maxHeight: 32, flexShrink: 0 }}
          >
            <svg
              width="18"
              height="18"
              className="w-4 h-4 text-white"
              style={{ width: 16, height: 16, stroke: '#ffffff' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="#ffffff"
              strokeWidth={2.3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-lg font-black tracking-wider uppercase text-white group-hover:text-neutral-300 transition-colors">
            REPROVA
          </span>
        </Link>

        {/* Right Actions (Desktop) */}
        <div className="hidden md:flex items-center space-x-5">

          {/* Authentication Actions */}
          {status === 'loading' ? (
            <div
              className="w-8 h-8 rounded-full bg-white/10 animate-pulse"
              style={{ width: 32, height: 32 }}
            />
          ) : isAuthenticated ? (
            <div className="flex items-center space-x-3">
              <UserMenu user={session.user} theme={theme} />
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <InteractiveHoverButton
                href="/signin"
                text="Sign in"
                className="min-w-28 py-1.5 px-3.5 text-xs font-semibold border-white/20 bg-white/5 hover:border-white/50"
              />
              <InteractiveHoverButton
                href="/signup"
                text="Get started"
                className="min-w-32 py-1.5 px-4 text-xs font-semibold shadow-[0_0_15px_rgba(255,255,255,0.08)] hover:shadow-[0_0_20px_rgba(255,255,255,0.18)]"
              />
            </div>
          )}
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className="flex md:hidden items-center space-x-2.5">
          {isAuthenticated ? (
            <UserMenu user={session.user} theme={theme} />
          ) : (
            <InteractiveHoverButton
              href="/signin"
              text="Sign in"
              className="min-w-24 py-1 px-3 text-xs font-semibold"
            />
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-neutral-400 hover:text-white p-1"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg width="24" height="24" style={{ width: 24, height: 24, flexShrink: 0 }} className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg width="24" height="24" style={{ width: 24, height: 24, flexShrink: 0 }} className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden px-6 py-4 space-y-3 border-t border-white/10 bg-neutral-950/95 backdrop-blur-xl">

          {/* Mobile Auth actions */}
          {!isAuthenticated && (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <InteractiveHoverButton
                href="/signin"
                onClick={() => setMobileMenuOpen(false)}
                text="Sign in"
                className="w-full justify-center py-2.5 text-xs font-semibold border-white/20 bg-white/5"
              />
              <InteractiveHoverButton
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                text="Get started"
                className="w-full justify-center py-2.5 text-xs font-semibold"
              />
            </div>
          )}

          {isAuthenticated && (
            <div className="space-y-2">
              <InteractiveHoverButton
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut({ callbackUrl: '/' });
                }}
                text="Sign out"
                className="w-full justify-center py-2.5 text-xs font-bold border-rose-500/30 text-rose-300 hover:border-rose-400"
              />
            </div>
          )}
        </div>
      )}
    </header>
  );
}
