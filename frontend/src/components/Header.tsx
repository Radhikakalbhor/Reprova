'use client';

import React from 'react';
import Link from 'next/link';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';

interface HeaderProps {
  theme?: 'dark' | 'light';
}

export function Header({ theme = 'dark' }: HeaderProps) {
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
          <InteractiveHoverButton
            href="/analyze"
            text="Start Analysis"
            className="min-w-32 py-1.5 px-4 text-xs font-semibold shadow-[0_0_15px_rgba(255,255,255,0.08)] hover:shadow-[0_0_20px_rgba(255,255,255,0.18)]"
          />
        </div>

        {/* Mobile Action */}
        <div className="flex md:hidden items-center space-x-2.5">
          <InteractiveHoverButton
            href="/analyze"
            text="Analyze"
            className="min-w-24 py-1 px-3 text-xs font-semibold"
          />
        </div>
      </div>
    </header>
  );
}

