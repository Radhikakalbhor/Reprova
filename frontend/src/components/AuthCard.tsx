'use client';

import React from 'react';
import Link from 'next/link';
import { Reveal } from '@/components/Reveal';

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-transparent text-neutral-100">
      <div className="w-full max-w-md relative z-10">
        <Reveal delayMs={0}>
          {/* Brand header */}
          <div className="text-center mb-8">
            <Link
              href="/"
              className="inline-flex items-center space-x-3 group text-inherit no-underline mb-4 focus:outline-none"
            >
              <div
                className="w-10 h-10 rounded-xl bg-neutral-900 border border-white/20 flex items-center justify-center font-bold text-white shadow-lg shadow-white/5 group-hover:scale-105 transition-transform"
                style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, flexShrink: 0 }}
              >
                <svg
                  width="20"
                  height="20"
                  style={{ width: 20, height: 20, minWidth: 20, minHeight: 20, stroke: '#ffffff' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#ffffff"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <span className="text-2xl font-black tracking-widest uppercase text-white group-hover:text-neutral-300 transition-colors">
                REPROVA
              </span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-neutral-400 mt-2 font-medium">
              {subtitle}
            </p>
          </div>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="bg-black/50 backdrop-blur-xl border border-white/15 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/90">
            {children}
          </div>
        </Reveal>

        <Reveal delayMs={200}>
          <div className="text-center mt-6 text-xs text-gray-500 font-mono">
            <p>AI-Powered Research Reproducibility Verification</p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
