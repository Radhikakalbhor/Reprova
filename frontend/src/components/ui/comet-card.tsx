"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from "framer-motion";
import { cn } from "@/lib/utils";

export interface CometCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glareColor?: string;
}

export const CometCard: React.FC<CometCardProps> = ({
  children,
  className,
  maxTilt = 5,
  glareColor = "rgba(255, 255, 255, 0.14)",
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const springConfig = { damping: 20, stiffness: 180 };
  const mouseX = useSpring(x, springConfig);
  const mouseY = useSpring(y, springConfig);

  const rotateX = useTransform(mouseY, [0, 1], [maxTilt, -maxTilt]);
  const rotateY = useTransform(mouseX, [0, 1], [-maxTilt, maxTilt]);

  const glarePercentX = useTransform(mouseX, [0, 1], [0, 100]);
  const glarePercentY = useTransform(mouseY, [0, 1], [0, 100]);

  const glareBackground = useMotionTemplate`radial-gradient(550px circle at ${glarePercentX}% ${glarePercentY}%, ${glareColor}, transparent 80%)`;
  const borderMask = useMotionTemplate`radial-gradient(350px circle at ${glarePercentX}% ${glarePercentY}%, black, transparent 70%)`;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const normalizedX = Math.min(Math.max(clientX / rect.width, 0), 1);
    const normalizedY = Math.min(Math.max(clientY / rect.height, 0), 1);

    x.set(normalizedX);
    y.set(normalizedY);
  }

  function handleMouseEnter() {
    setIsHovered(true);
  }

  function handleMouseLeave() {
    setIsHovered(false);
    x.set(0.5);
    y.set(0.5);
  }

  return (
    <div
      ref={cardRef}
      className={cn("relative group/comet select-none", className)}
      style={{ perspective: 1200 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <motion.div
        className="w-full h-full relative rounded-2xl"
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
      >
        {children}

        {/* Comet Glare effect */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/comet:opacity-100 z-30"
          style={{
            background: glareBackground,
          }}
        />

        {/* Comet sweeping light border reflection */}
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/comet:opacity-100 z-30 border border-white/35"
          style={{
            maskImage: borderMask,
            WebkitMaskImage: borderMask,
          }}
        />
      </motion.div>
    </div>
  );
};

export function CometCardDemo() {
  return (
    <CometCard>
      <button
        type="button"
        className="my-10 flex w-80 cursor-pointer flex-col items-stretch rounded-[16px] border-0 bg-[#1F2121] p-2 saturate-0 md:my-20 md:p-4"
        aria-label="View invite F7RA"
        style={{
          transformStyle: "preserve-3d",
          transform: "none",
          opacity: 1,
        }}
      >
        <div className="mx-2 flex-1">
          <div className="relative mt-2 aspect-[3/4] w-full">
            <img
              loading="lazy"
              className="absolute inset-0 h-full w-full rounded-[16px] bg-[#000000] object-cover contrast-75"
              alt="Invite background"
              src="https://images.unsplash.com/photo-1505506874110-6a7a69069a08?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              style={{
                boxShadow: "rgba(0, 0, 0, 0.05) 0px 5px 6px 0px",
                opacity: 1,
              }}
            />
          </div>
        </div>
        <div className="mt-2 flex flex-shrink-0 items-center justify-between p-4 font-mono text-white">
          <div className="text-xs">Comet Invitation</div>
          <div className="text-xs text-gray-300 opacity-50">#F7RA</div>
        </div>
      </button>
    </CometCard>
  );
}

export default CometCard;
