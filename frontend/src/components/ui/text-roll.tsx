"use client";

import React from "react";
import { motion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";

const STAGGER = 0.035;

export interface TextRollProps {
  children: string;
  className?: string;
  center?: boolean;
  style?: React.CSSProperties;
  transition?: Transition;
  duration?: number;
}

export const TextRoll: React.FC<TextRollProps> = ({
  children,
  className,
  center = false,
  style,
  transition,
  duration = 0.35,
}) => {
  const letters = children.split("");

  return (
    <motion.span
      initial="initial"
      whileHover="hovered"
      className={cn(
        "relative inline-block overflow-hidden cursor-pointer select-none align-top",
        className
      )}
      style={{
        lineHeight: 1.1,
        ...style,
      }}
    >
      <span className="block pb-[0.08em]">
        {letters.map((l, i) => {
          const delay = center
            ? STAGGER * Math.abs(i - (letters.length - 1) / 2)
            : STAGGER * i;
          return (
            <motion.span
              variants={{
                initial: {
                  y: 0,
                },
                hovered: {
                  y: "-100%",
                },
              }}
              transition={{
                ease: [0.22, 1, 0.36, 1],
                duration,
                delay,
                ...transition,
              }}
              className="inline-block"
              key={i}
            >
              {l === " " ? "\u00A0" : l}
            </motion.span>
          );
        })}
      </span>
      <span
        className="absolute inset-0 block pb-[0.08em] pointer-events-none"
        aria-hidden="true"
      >
        {letters.map((l, i) => {
          const delay = center
            ? STAGGER * Math.abs(i - (letters.length - 1) / 2)
            : STAGGER * i;
          return (
            <motion.span
              variants={{
                initial: {
                  y: "100%",
                },
                hovered: {
                  y: 0,
                },
              }}
              transition={{
                ease: [0.22, 1, 0.36, 1],
                duration,
                delay,
                ...transition,
              }}
              className="inline-block"
              key={i}
            >
              {l === " " ? "\u00A0" : l}
            </motion.span>
          );
        })}
      </span>
    </motion.span>
  );
};

export default TextRoll;
