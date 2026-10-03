import React from 'react';
import Link from 'next/link';

interface FooterProps {
  theme?: 'dark' | 'light';
}

export function Footer({ theme = 'dark' }: FooterProps) {
  return (
    <footer className="py-8 text-sm border-t border-white/10 bg-transparent text-neutral-400">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-neutral-400">
        <div className="flex items-center space-x-2.5">
          <span className="font-black tracking-wider uppercase text-white text-sm">
            REPROVA
          </span>
          <span className="text-neutral-500">—</span>
          <span className="text-neutral-300 tracking-wide font-mono">
            &quot;See beyond the paper.&quot;
          </span>
        </div>
        <p>© {new Date().getFullYear()} Reprova. All rights reserved.</p>
      </div>
    </footer>
  );
}
