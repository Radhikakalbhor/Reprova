"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface CanvasRevealEffectProps {
  animationSpeed?: number;
  opacities?: number[];
  colors?: number[][];
  containerClassName?: string;
  dotSize?: number;
  showGradient?: boolean;
}

export const CanvasRevealEffect: React.FC<CanvasRevealEffectProps> = ({
  animationSpeed = 3,
  colors = [
    [59, 130, 246],
    [139, 92, 246],
  ],
  containerClassName,
  dotSize = 3,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 400);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener("resize", handleResize);

    const spacing = Math.max(14, dotSize * 5);
    const cols = Math.ceil(width / spacing);
    const rows = Math.ceil(height / spacing);

    // Initial random phases for twinkling
    const grid: { phase: number; speed: number; colorIndex: number }[] = [];
    for (let i = 0; i < cols * rows; i++) {
      grid.push({
        phase: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.04 * (animationSpeed / 3),
        colorIndex: Math.floor(Math.random() * colors.length),
      });
    }

    let time = 0;
    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      const currentCols = Math.ceil(width / spacing);
      const currentRows = Math.ceil(height / spacing);

      for (let r = 0; r < currentRows; r++) {
        for (let c = 0; c < currentCols; c++) {
          const index = (r * currentCols + c) % grid.length;
          const cell = grid[index];
          const brightness = Math.sin(cell.phase + time * cell.speed);
          
          // Only draw if brightness is positive
          if (brightness > 0) {
            const opacity = Math.min(1, Math.max(0.1, brightness * 0.9));
            const [cr, cg, cb] = colors[cell.colorIndex] || [255, 255, 255];
            
            ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${opacity})`;
            ctx.beginPath();
            ctx.arc(
              c * spacing + spacing / 2,
              r * spacing + spacing / 2,
              dotSize / 2,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [animationSpeed, colors, dotSize]);

  return (
    <div className={cn("h-full relative bg-transparent w-full", containerClassName)}>
      <canvas ref={canvasRef} className="h-full w-full pointer-events-none" />
    </div>
  );
};
