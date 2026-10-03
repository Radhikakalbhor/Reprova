'use client';

import React from 'react';
import { SparklesCore } from '@/components/ui/sparkles';

export function GlobalBackground() {
  return (
    <>
      {/* Fixed background image layer */}
      <div
        className="fixed inset-0 w-screen h-screen -z-10 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -2,
          backgroundImage: "url('/bg-reprova.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
        aria-hidden="true"
      />

      {/* Sparkles overlay sitting directly over the background image */}
      <div
        className="fixed inset-0 w-screen h-screen -z-10 pointer-events-none overflow-hidden"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        <SparklesCore
          id="tsparticlesfullpage"
          background="transparent"
          minSize={0.6}
          maxSize={1.6}
          particleDensity={85}
          className="w-full h-full"
          particleColor="#FFFFFF"
          speed={0.8}
        />
      </div>
    </>
  );
}

export default GlobalBackground;
