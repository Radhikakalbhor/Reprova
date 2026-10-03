'use client';

import React, { useEffect, useRef } from 'react';

// Single config variables for local video and poster assets
export const VIDEO_SOURCE = '/hero-placeholder.mp4';
export const POSTER_SOURCE = '/hero-poster.jpg';

interface ScrollVideoProps {
  src?: string;
  poster?: string;
}

export function ScrollVideo({
  src = VIDEO_SOURCE,
  poster = POSTER_SOURCE,
}: ScrollVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Respect prefers-reduced-motion setting
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      video.pause();
      return;
    }

    // Explicitly trigger play to ensure autoplay begins immediately on page load
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback for strict browser policies
      });
    }
  }, [src]);

  return (
    <div className="fixed inset-0 z-0 bg-black overflow-hidden pointer-events-none">
      {/* Background Autoplay Video: Non-looping, plays once from 0s -> 10s and stays on final frame */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover opacity-100"
      />
    </div>
  );
}
