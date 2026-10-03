"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SparklesCoreProps {
  id?: string;
  className?: string;
  background?: string;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  particleColor?: string;
  particleDensity?: number;
  direction?: "float" | "down" | "up";
}

export const SparklesCore: React.FC<SparklesCoreProps> = ({
  id,
  className,
  background = "transparent",
  minSize = 0.6,
  maxSize = 1.4,
  speed = 1,
  particleColor = "#FFFFFF",
  particleDensity = 100,
  direction = "float",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    const setCanvasSize = () => {
      const parent = canvas.parentElement;
      width = canvas.width = parent ? parent.clientWidth : window.innerWidth;
      height = canvas.height = parent ? parent.clientHeight : window.innerHeight;
    };

    setCanvasSize();
    window.addEventListener("resize", setCanvasSize);

    // Calculate number of particles based on screen area & density
    const count = Math.max(35, Math.floor(((width * height) / 10000) * (particleDensity / 80)));

    interface Particle {
      x: number;
      y: number;
      size: number;
      baseAlpha: number;
      alpha: number;
      twinkleSpeed: number;
      twinklePhase: number;
      vx: number;
      vy: number;
    }

    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      let vx = (Math.random() - 0.5) * 0.15 * speed;
      let vy = (Math.random() - 0.5) * 0.15 * speed;
      let initialY = Math.random() * height;
      let initialX = Math.random() * width;

      if (direction === "down") {
        vx = (Math.random() - 0.5) * 0.35 * speed;
        vy = (0.25 + Math.random() * 0.65) * speed;
        initialY = Math.random() * height;
        initialX = width * 0.2 + Math.random() * (width * 0.6);
      } else if (direction === "up") {
        vx = (Math.random() - 0.5) * 0.35 * speed;
        vy = (-0.25 - Math.random() * 0.65) * speed;
      }

      particles.push({
        x: initialX,
        y: initialY,
        size: minSize + Math.random() * (maxSize - minSize),
        baseAlpha: 0.25 + Math.random() * 0.75,
        alpha: 0.5,
        twinkleSpeed: (0.015 + Math.random() * 0.035) * speed,
        twinklePhase: Math.random() * Math.PI * 2,
        vx,
        vy,
      });
    }

    // Parse hex or rgb color
    const hexToRgb = (hex: string) => {
      let c = hex.replace("#", "");
      if (c.length === 3) {
        c = c.split("").map((x) => x + x).join("");
      }
      const num = parseInt(c, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    };

    const rgb = particleColor.startsWith("#")
      ? hexToRgb(particleColor)
      : [255, 255, 255];

    let time = 0;
    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      if (background && background !== "transparent") {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Drift
        p.x += p.vx;
        p.y += p.vy;

        // Boundary wrap logic
        if (direction === "down") {
          if (p.y > height) {
            p.y = 0;
            p.x = width * 0.25 + Math.random() * (width * 0.5);
          }
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
        } else if (direction === "up") {
          if (p.y < 0) {
            p.y = height;
            p.x = width * 0.25 + Math.random() * (width * 0.5);
          }
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
        } else {
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        }

        // Twinkle effect
        p.alpha = Math.max(0.08, Math.min(1, p.baseAlpha + Math.sin(p.twinklePhase + time * p.twinkleSpeed) * 0.35));

        // Draw particle with gentle glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${p.alpha})`;
        ctx.fill();

        // Extra soft halo for larger particles
        if (p.size > 0.9) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${p.alpha * 0.25})`;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", setCanvasSize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [mounted, background, minSize, maxSize, speed, particleColor, particleDensity, direction]);

  return (
    <div id={id} className={cn("relative w-full h-full", className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full pointer-events-none block"
      />
    </div>
  );
};

export function SparklesPreview() {
  return (
    <div className="h-[40rem] w-full bg-black flex flex-col items-center justify-center overflow-hidden rounded-md">
      <h1 className="md:text-7xl text-3xl lg:text-9xl font-bold text-center text-white relative z-20">
        Aceternity
      </h1>
      <div className="w-[40rem] h-40 relative">
        {/* Gradients */}
        <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-[2px] w-3/4 blur-sm" />
        <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px w-3/4" />
        <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-[5px] w-1/4 blur-sm" />
        <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px w-1/4" />

        {/* Core component */}
        <SparklesCore
          background="transparent"
          minSize={0.4}
          maxSize={1}
          particleDensity={1200}
          className="w-full h-full"
          particleColor="#FFFFFF"
        />

        {/* Radial Gradient to prevent sharp edges */}
        <div className="absolute inset-0 w-full h-full bg-black [mask-image:radial-gradient(350px_200px_at_top,transparent_20%,white)]"></div>
      </div>
    </div>
  );
}

export default SparklesCore;
