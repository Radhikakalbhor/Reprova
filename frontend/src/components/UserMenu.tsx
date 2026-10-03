'use client';

import React, { useState, useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';

interface UserMenuProps {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string | null;
  };
  theme?: 'dark' | 'light';
}

export function UserMenu({ user, theme = 'dark' }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = user.username || user.name || 'User';
  const displayEmail = user.email || '';

  // Calculate initials (e.g. "S" or "SG")
  const initials = (displayName.slice(0, 1) || 'U').toUpperCase();

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isLight = theme === 'light';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Interactive Avatar & Profile Button with expanding circular hover animation */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User account menu"
        className="group relative inline-flex items-center overflow-hidden rounded-full border border-white/20 bg-black/60 backdrop-blur-md p-1 pr-2.5 transition-all duration-300 hover:border-white/70 active:scale-[0.98] select-none cursor-pointer shadow-lg shadow-black/40 focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        {/* Expanding circle background animation */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-white transition-all duration-500 ease-out group-hover:scale-[100] group-hover:bg-white pointer-events-none z-0" />

        {/* Content layer */}
        <div className="relative z-10 flex items-center space-x-2.5">
          {user.image ? (
            <img
              src={user.image}
              alt={displayName}
              width={28}
              height={28}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20 transition-all duration-300 group-hover:ring-black/20"
              style={{ width: 28, height: 28, minWidth: 28, minHeight: 28 }}
            />
          ) : (
            <div
              className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-600 to-amber-700 border border-white/20 flex items-center justify-center font-bold text-white text-xs shadow-sm ring-1 ring-white/20 select-none transition-all duration-300 group-hover:border-black/20"
              style={{ width: 28, height: 28, minWidth: 28, minHeight: 28 }}
            >
              {initials}
            </div>
          )}

          <span className="inline-block text-xs font-bold max-w-[130px] truncate pr-0.5 text-neutral-200 transition-colors duration-300 group-hover:text-black">
            {displayName}
          </span>

          {/* Dropdown chevron */}
          <svg
            width="14"
            height="14"
            style={{ width: 14, height: 14, minWidth: 14, minHeight: 14 }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-all duration-300 ${
              isOpen ? 'rotate-180 text-white' : 'text-neutral-400'
            } group-hover:text-black group-hover:stroke-black`}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-64 rounded-2xl p-2.5 shadow-2xl border z-50 animate-fadeIn bg-neutral-950/95 backdrop-blur-xl border-white/15 text-neutral-100 shadow-black/80"
        >
          {/* User info header */}
          <div className="px-3 py-2.5 border-b border-white/10 mb-2">
            <p className="text-xs text-neutral-400 uppercase font-mono tracking-wider font-semibold">
              Signed in as
            </p>
            <p className="text-sm font-bold truncate mt-0.5 text-white">{displayName}</p>
            {displayEmail && (
              <p className="text-xs text-neutral-400 truncate font-mono mt-0.5">
                {displayEmail}
              </p>
            )}
          </div>

          <div>
            <InteractiveHoverButton
              type="button"
              onClick={() => {
                setIsOpen(false);
                signOut({ callbackUrl: '/' });
              }}
              text="Sign out"
              className="w-full justify-center min-w-full py-2 px-3 text-xs font-bold border-rose-500/30 text-rose-300 hover:border-rose-400 shadow-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
