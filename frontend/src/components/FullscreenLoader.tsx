'use client';

import React, { useEffect, useState, useRef } from 'react';

interface FullscreenLoaderProps {
  isComplete?: boolean;
  onFinished?: () => void;
  initialMessage?: string;
}

const STAGES = [
  { at: 0, text: 'Initializing reproducibility pipeline...' },
  { at: 20, text: 'Extracting empirical claims from research paper...' },
  { at: 45, text: 'Tracing repository codebase AST & code evidence...' },
  { at: 70, text: 'Comparing claimed metrics against reproduced execution...' },
  { at: 90, text: 'Synthesizing evidence & finalizing report...' },
  { at: 100, text: 'Complete! Displaying report...' },
];

export function FullscreenLoader({
  isComplete = false,
  onFinished,
  initialMessage = 'Analyzing research paper & repository evidence...',
}: FullscreenLoaderProps) {
  const [progress, setProgress] = useState(0);
  const finishedTriggered = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (isComplete) {
          // If backend data is ready, jump swiftly to 100%
          const next = prev + 12;
          if (next >= 100) {
            clearInterval(interval);
            if (!finishedTriggered.current) {
              finishedTriggered.current = true;
              setTimeout(() => {
                if (onFinished) onFinished();
              }, 250);
            }
            return 100;
          }
          return next;
        }

        // Natural smooth progression while waiting for backend
        if (prev < 30) return prev + 2.5;
        if (prev < 60) return prev + 1.8;
        if (prev < 80) return prev + 1.2;
        if (prev < 92) return prev + 0.6;
        if (prev < 96) return prev + 0.2;
        return prev; // Hold at 96% until isComplete is true
      });
    }, 80);

    return () => clearInterval(interval);
  }, [isComplete, onFinished]);

  const currentStage = [...STAGES].reverse().find((s) => progress >= s.at);
  const statusMessage = currentStage ? currentStage.text : initialMessage;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center select-none bg-black/65 backdrop-blur-2xl transition-all duration-300"
      style={{ position: 'fixed', inset: 0 }}
      role="status"
      aria-live="polite"
      aria-label="Loading analysis"
    >
      {/* Percentage counter (no spinner) */}
      <div className="text-5xl sm:text-6xl md:text-7xl font-mono font-black text-white tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] mb-2">
        {Math.round(progress)}%
      </div>

      {/* Glowing progress bar */}
      <div className="w-64 sm:w-80 md:w-96 h-2 bg-white/10 rounded-full mt-4 overflow-hidden border border-white/15 shadow-inner">
        <div
          className="h-full bg-white rounded-full transition-all duration-100 ease-out shadow-[0_0_15px_rgba(255,255,255,0.9)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Dynamic stage status message */}
      <p className="text-xs sm:text-sm font-medium text-neutral-300 mt-5 max-w-sm sm:max-w-md font-mono leading-relaxed drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
        {statusMessage}
      </p>
    </div>
  );
}
