"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface HoverEffectItem {
  title: string;
  description: string;
  link?: string;
  number?: string;
}

export const HoverEffect = ({
  items,
  className,
}: {
  items: HoverEffectItem[];
  className?: string;
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 py-6 gap-2 sm:gap-4",
        className
      )}
    >
      {items.map((item, idx) => {
        const Wrapper: any = item.link ? Link : "div";
        const wrapperProps = item.link
          ? { href: item.link, target: item.link.startsWith("http") ? "_blank" : undefined }
          : {};

        return (
          <Wrapper
            {...wrapperProps}
            key={item.link || item.title || idx}
            className="relative group block p-2 h-full w-full cursor-pointer select-none"
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <AnimatePresence>
              {hoveredIndex === idx && (
                <motion.span
                  className="absolute inset-0 h-full w-full bg-white/[0.12] border border-white/25 block rounded-2xl sm:rounded-3xl shadow-[0_0_30px_rgba(255,255,255,0.08)]"
                  layoutId="hoverBackground"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    transition: { duration: 0.15 },
                  }}
                  exit={{
                    opacity: 0,
                    transition: { duration: 0.15, delay: 0.15 },
                  }}
                />
              )}
            </AnimatePresence>
            <Card>
              {item.number && (
                <span className="text-2xl font-black font-mono text-neutral-300 block mb-2">
                  {item.number}
                </span>
              )}
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </Card>
          </Wrapper>
        );
      })}
    </div>
  );
};

export const Card = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "rounded-xl sm:rounded-2xl h-full w-full p-6 sm:p-7 overflow-hidden bg-black/60 border border-white/10 group-hover:border-white/20 transition-all duration-300 relative z-20 backdrop-blur-md",
        className
      )}
    >
      <div className="relative z-50">
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  );
};

export const CardTitle = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <h3
      className={cn(
        "text-white text-lg font-bold tracking-tight",
        className
      )}
    >
      {children}
    </h3>
  );
};

export const CardDescription = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <p
      className={cn(
        "text-neutral-400 text-xs sm:text-sm leading-relaxed tracking-wide mt-2",
        className
      )}
    >
      {children}
    </p>
  );
};

export const projects = [
  {
    title: "Stripe",
    description:
      "A technology company that builds economic infrastructure for the internet.",
    link: "https://stripe.com",
  },
  {
    title: "Netflix",
    description:
      "A streaming service that offers a wide variety of award-winning TV shows, movies, anime, documentaries, and more on thousands of internet-connected devices.",
    link: "https://netflix.com",
  },
  {
    title: "Google",
    description:
      "A multinational technology company that specializes in Internet-related services and products.",
    link: "https://google.com",
  },
  {
    title: "Meta",
    description:
      "A technology company that focuses on building products that advance Facebook's mission of bringing the world closer together.",
    link: "https://meta.com",
  },
  {
    title: "Amazon",
    description:
      "A multinational technology company focusing on e-commerce, cloud computing, digital streaming, and artificial intelligence.",
    link: "https://amazon.com",
  },
  {
    title: "Microsoft",
    description:
      "A multinational technology company that develops, manufactures, licenses, supports, and sells computer software, consumer electronics, personal computers, and related services.",
    link: "https://microsoft.com",
  },
];

export function CardHoverEffectDemo() {
  return (
    <div className="max-w-5xl mx-auto px-8">
      <HoverEffect items={projects} />
    </div>
  );
}

export default HoverEffect;
