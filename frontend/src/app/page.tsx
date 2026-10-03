'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Reveal } from '@/components/Reveal';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { TextRoll } from '@/components/ui/text-roll';
import { HoverEffect } from '@/components/ui/card-hover-effect';
import { SparklesCore } from '@/components/ui/sparkles';

const PIPELINE_STEPS = [
  {
    number: '01',
    title: 'Upload',
    description: 'Add a research paper and its GitHub repository.',
  },
  {
    number: '02',
    title: 'Understand',
    description: 'Extract experimental claims, datasets, metrics, architectures, and configurations.',
  },
  {
    number: '03',
    title: 'Trace',
    description: 'Connect research claims to implementation evidence in the repository.',
  },
  {
    number: '04',
    title: 'Reproduce',
    description: 'Execute supported experiments in a controlled environment.',
  },
  {
    number: '05',
    title: 'Compare',
    description: 'Compare reproduced results against the results reported in the paper.',
  },
  {
    number: '06',
    title: 'Assess',
    description: 'Highlight discrepancies, missing information, and reproducibility evidence.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-transparent text-neutral-100 selection:bg-white/20 selection:text-white relative overflow-x-hidden">
      <Header />

      <main className="flex-1 flex flex-col relative z-10">
        {/* HERO SECTION */}
        <section className="relative min-h-[calc(100vh-4rem)] flex items-center px-6 sm:px-12 py-16 overflow-hidden bg-transparent">
          {/* Foreground sculpture depth layer: sits in front of the headline text so letters like 'nd' pass behind the sculpture face */}
          <div
            className="fixed inset-0 w-screen h-screen z-[2] pointer-events-none bg-cover bg-center bg-no-repeat"
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              backgroundImage: "url('/sculpture-fg.webp')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          />

          <div className="w-full max-w-[1440px] mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-12 relative">
            {/* Left Column: Headline & Subtitle */}
            <div className="max-w-xl lg:max-w-2xl text-left space-y-6 relative lg:ml-2 xl:ml-4">
              <Reveal delayMs={0} className="relative z-[1]">
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.6rem] xl:text-[6rem] font-black tracking-tight text-white leading-[1.05] select-none text-left flex flex-col items-start">
                  <TextRoll>See beyond</TextRoll>
                  <TextRoll className="text-neutral-100">the paper</TextRoll>
                </h1>
              </Reveal>

              <Reveal delayMs={100} className="relative z-[10]">
                <p className="text-base sm:text-lg text-neutral-300 font-normal leading-relaxed text-left max-w-md sm:max-w-lg">
                  Turn research papers into verifiable claims,
                  <br className="hidden sm:inline" /> traceable code repositories, and reproduced benchmark evidence.
                </p>
              </Reveal>
            </div>

            {/* Right Column: Start Analysis Button with Sparkles Emitter underneath */}
            <div className="lg:pr-8 flex justify-start lg:justify-end items-center relative z-[10]">
              <Reveal delayMs={200} className="flex flex-col items-center">
                <InteractiveHoverButton
                  href="/analyze"
                  text="Start Analysis"
                  className="px-10 py-5 text-base sm:text-lg min-w-56 border-white/30 bg-black/80 shadow-[0_0_35px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] hover:border-white/70 relative z-20 backdrop-blur-md"
                />

                {/* Emitter effect directly below the button */}
                <div
                  className="w-[18rem] sm:w-[22rem] md:w-[26rem] h-36 relative -mt-1 pointer-events-none select-none"
                  style={{
                    maskImage: 'radial-gradient(ellipse 70% 80% at 50% 0%, black 25%, transparent 100%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 70% 80% at 50% 0%, black 25%, transparent 100%)',
                  }}
                >
                  {/* Glowing gradient lines emitting from the bottom of the button */}
                  <div className="absolute inset-x-6 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-[2px] w-3/4 mx-auto blur-sm" />
                  <div className="absolute inset-x-6 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px w-3/4 mx-auto" />
                  <div className="absolute inset-x-12 top-0 bg-gradient-to-r from-transparent via-sky-400 to-transparent h-[4px] w-1/3 mx-auto blur-sm" />
                  <div className="absolute inset-x-12 top-0 bg-gradient-to-r from-transparent via-sky-400 to-transparent h-px w-1/3 mx-auto" />

                  {/* Core Sparkles Component */}
                  <SparklesCore
                    id="buttonSparklesEmitter"
                    background="transparent"
                    minSize={0.4}
                    maxSize={1.2}
                    particleDensity={800}
                    className="w-full h-full"
                    particleColor="#FFFFFF"
                    direction="down"
                    speed={1.3}
                  />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section id="how-it-works" className="py-20 border-b border-white/10 bg-transparent">
          <div className="max-w-7xl mx-auto px-6">
            <Reveal delayMs={0}>
              <div className="relative rounded-2xl sm:rounded-3xl border border-white/15 bg-black/60 backdrop-blur-xl p-8 sm:p-12 md:p-14 shadow-2xl space-y-10 sm:space-y-12 overflow-hidden">
                {/* Header inside the big card */}
                <div className="text-center max-w-3xl mx-auto space-y-3">
                  <span className="text-xs uppercase font-mono font-bold tracking-widest text-neutral-400">
                    Workflow Pipeline
                  </span>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                    From paper to evidence.
                  </h2>
                  <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-2xl mx-auto">
                    Reprova systematically transforms unstructured research papers into verifiable implementation claims and benchmark reproductions.
                  </p>
                </div>

                {/* 6 Steps Grid with Aceternity Card Hover Effect */}
                <HoverEffect items={PIPELINE_STEPS} className="py-2" />
              </div>
            </Reveal>
          </div>
        </section>

        {/* VISUAL TRACEABILITY SECTION */}
        <section id="about" className="pt-10 pb-24 sm:pt-14 sm:pb-32 border-b border-white/10 bg-transparent">
          <div className="max-w-7xl mx-auto px-6">
            <Reveal delayMs={0}>
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-12 lg:gap-8">
                {/* Left Side: Title (positioned higher up) */}
                <div className="lg:max-w-md xl:max-w-lg text-left -mt-2 lg:-mt-10">
                  <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.1] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] flex flex-col items-start">
                    <TextRoll>From claim</TextRoll>
                    <TextRoll>to code</TextRoll>
                  </h2>
                </div>

                {/* Right Side: Description shifted to the right, with demo button centered underneath */}
                <div className="lg:ml-auto max-w-sm sm:max-w-md lg:max-w-sm xl:max-w-md space-y-6 flex flex-col items-center text-center">
                  <p className="text-base sm:text-lg text-neutral-200 leading-relaxed font-normal drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] text-center">
                    Reprova doesn&apos;t stop at summarizing a paper. It connects individual research claims to evidence in the implementation.
                  </p>
                  <div className="flex justify-center w-full pt-1">
                    <InteractiveHoverButton
                      href="/analyze?mode=curated"
                      text="Run a demo"
                      className="py-3.5 px-8 text-sm sm:text-base font-semibold border-white/30 bg-black/60 shadow-[0_0_25px_rgba(255,255,255,0.15)] hover:shadow-[0_0_35px_rgba(255,255,255,0.3)] backdrop-blur-md"
                    />
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
