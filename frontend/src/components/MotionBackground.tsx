'use client';

import React, { useEffect, useRef, useState } from 'react';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260729_102822_0e6c87e8-c141-4744-bf32-ad30db296371.mp4';

export function MotionBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Animation frame state
  const framesCacheRef = useRef<(ImageBitmap | HTMLCanvasElement)[]>([]);
  const targetProgressRef = useRef(0);
  const smoothedProgressRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Check reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const isReducedMotion = mediaQuery.matches;

    const video = document.createElement('video');
    video.src = VIDEO_URL;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    videoRef.current = video;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to window viewport
    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Scroll listener to calculate scroll progress
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const currentScroll = Math.max(0, window.scrollY);
      targetProgressRef.current = Math.min(1, Math.max(0, currentScroll / scrollHeight));
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Helper to draw a frame onto canvas with object-cover scaling
    const drawFrame = (source: ImageBitmap | HTMLCanvasElement | HTMLVideoElement) => {
      if (!canvas || !ctx) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const sw = 'videoWidth' in source ? source.videoWidth || 1280 : source.width;
      const sh = 'videoHeight' in source ? source.videoHeight || 720 : source.height;

      const canvasAspect = cw / ch;
      const srcAspect = sw / sh;

      let renderW = cw;
      let renderH = ch;
      let offsetX = 0;
      let offsetY = 0;

      if (srcAspect > canvasAspect) {
        renderW = ch * srcAspect;
        offsetX = (cw - renderW) / 2;
      } else {
        renderH = cw / srcAspect;
        offsetY = (ch - renderH) / 2;
      }

      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(source, offsetX, offsetY, renderW, renderH);
    };

    // RAF Loop with lerp interpolation
    const renderLoop = () => {
      if (!isReducedMotion) {
        // Lerp progress smoothing
        const diff = targetProgressRef.current - smoothedProgressRef.current;
        smoothedProgressRef.current += diff * 0.12;
      } else {
        smoothedProgressRef.current = targetProgressRef.current;
      }

      const progress = smoothedProgressRef.current;
      const frames = framesCacheRef.current;

      if (frames.length > 0) {
        const frameIdx = Math.min(
          frames.length - 1,
          Math.max(0, Math.floor(progress * (frames.length - 1)))
        );
        drawFrame(frames[frameIdx]);
      } else if (video && video.readyState >= 2) {
        // Direct video seeking fallback while caching frames
        if (video.duration) {
          const seekTime = progress * video.duration;
          if (Math.abs(video.currentTime - seekTime) > 0.1) {
            video.currentTime = seekTime;
          }
        }
        drawFrame(video);
      }

      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    // Extract & cache frames offscreen
    const extractFrames = async () => {
      if (!video.duration || isNaN(video.duration)) return;
      setLoaded(true);

      const frameCount = Math.min(60, Math.max(24, Math.floor(video.duration * 12)));
      const offscreenCanvas = document.createElement('canvas');
      const offCtx = offscreenCanvas.getContext('2d');
      const maxW = 960;
      const aspect = (video.videoWidth || 1280) / (video.videoHeight || 720);
      offscreenCanvas.width = maxW;
      offscreenCanvas.height = Math.round(maxW / aspect);

      const cache: (ImageBitmap | HTMLCanvasElement)[] = [];

      for (let i = 0; i < frameCount; i++) {
        const time = (i / (frameCount - 1)) * (video.duration - 0.05);
        video.currentTime = time;
        await new Promise<void>((resolve) => {
          const onSeek = () => {
            video.removeEventListener('seeked', onSeek);
            resolve();
          };
          video.addEventListener('seeked', onSeek);
        });

        if (offCtx) {
          offCtx.drawImage(video, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
          if (typeof createImageBitmap === 'function') {
            try {
              const bmp = await createImageBitmap(offscreenCanvas);
              cache.push(bmp);
            } catch {
              const copyCanvas = document.createElement('canvas');
              copyCanvas.width = offscreenCanvas.width;
              copyCanvas.height = offscreenCanvas.height;
              copyCanvas.getContext('2d')?.drawImage(offscreenCanvas, 0, 0);
              cache.push(copyCanvas);
            }
          } else {
            const copyCanvas = document.createElement('canvas');
            copyCanvas.width = offscreenCanvas.width;
            copyCanvas.height = offscreenCanvas.height;
            copyCanvas.getContext('2d')?.drawImage(offscreenCanvas, 0, 0);
            cache.push(copyCanvas);
          }
        }
      }

      framesCacheRef.current = cache;
    };

    video.addEventListener('loadedmetadata', extractFrames);
    video.load();

    // Start RAF
    animationFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      video.removeEventListener('loadedmetadata', extractFrames);
      video.pause();
      video.src = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Fallback dark ambient background layer */}
      <div className="absolute inset-0 bg-[#07090e]" />

      {/* Main Canvas rendering frame cache */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
          loaded ? 'opacity-40' : 'opacity-0'
        }`}
      />

      {/* Dark Overlay for Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#07090e]/80 via-[#07090e]/65 to-[#07090e]/90 backdrop-blur-[1px]" />
    </div>
  );
}
