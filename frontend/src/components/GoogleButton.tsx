'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';

interface GoogleButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
}

export function GoogleButton({
  onClick,
  loading = false,
  disabled = false,
  label = 'Continue with Google',
}: GoogleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="group relative w-full flex items-center justify-center cursor-pointer overflow-hidden rounded-full border border-white/20 bg-white/5 backdrop-blur-md px-6 py-3.5 text-center font-bold text-white shadow-lg transition-all duration-300 hover:border-white/70 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed select-none text-sm"
    >
      <div className="flex items-center gap-2.5">
        <div className="h-2 w-2 rounded-full bg-white transition-all duration-500 ease-out group-hover:scale-[100] group-hover:bg-white shrink-0" />
        <span className="inline-flex items-center gap-2.5 transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0 whitespace-nowrap font-semibold">
          {loading ? (
            <div
              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0"
              style={{ width: 16, height: 16 }}
            />
          ) : (
            <svg
              width="18"
              height="18"
              style={{ width: 18, height: 18, minWidth: 18, minHeight: 18, flexShrink: 0 }}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{label}</span>
        </span>
      </div>
      <div className="absolute inset-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2.5 font-bold text-black opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:opacity-100">
        <span className="whitespace-nowrap">{label}</span>
        <ArrowRight width={18} height={18} className="w-4 h-4 shrink-0 stroke-[2.5]" />
      </div>
    </button>
  );
}
