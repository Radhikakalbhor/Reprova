'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InteractiveHoverButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
  href?: string;
  children?: React.ReactNode;
}

const InteractiveHoverButton = React.forwardRef<
  HTMLButtonElement,
  InteractiveHoverButtonProps
>(({ text, href, children, className, onClick, ...props }, ref) => {
  const content = children || text || 'Button';

  const commonClasses = cn(
    'group relative inline-flex min-w-36 items-center justify-center cursor-pointer overflow-hidden rounded-full border border-white/25 bg-black/60 backdrop-blur-md px-7 py-3.5 text-center font-bold text-white shadow-lg transition-all duration-300 hover:border-white/70 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed select-none text-sm',
    className
  );

  const innerContent = (
    <>
      <div className="flex items-center gap-2.5">
        <div className="h-2 w-2 rounded-full bg-white transition-all duration-500 ease-out group-hover:scale-[100] group-hover:bg-white shrink-0" />
        <span className="inline-block transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0 whitespace-nowrap">
          {content}
        </span>
      </div>
      <div className="absolute inset-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2.5 font-bold text-black opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:opacity-100">
        <span className="whitespace-nowrap">{content}</span>
        <ArrowRight width={18} height={18} className="w-4 h-4 shrink-0 stroke-[2.5]" />
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={commonClasses} onClick={onClick as any}>
        {innerContent}
      </Link>
    );
  }

  return (
    <button ref={ref} className={commonClasses} onClick={onClick} {...props}>
      {innerContent}
    </button>
  );
});

InteractiveHoverButton.displayName = 'InteractiveHoverButton';

export { InteractiveHoverButton };
