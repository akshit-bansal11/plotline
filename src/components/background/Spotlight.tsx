"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils";

interface SpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}

export function Spotlight({
  children,
  className = "",
  spotlightColor = "rgb(255, 255, 255)",
  ...props
}: SpotlightProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  const [spotlightSize, setSpotlightSize] = useState(0);

  useEffect(() => {
    const node = divRef.current;
    if (!node) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const rect = node.getBoundingClientRect();
      setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      const nextSize = Math.max(rect.width / 1.5, rect.height / 1.5) + 6;
      setSpotlightSize(nextSize);
    };

    const handleMouseEnter = () => {
      setOpacity(1);
    };

    const handleMouseLeave = () => {
      setOpacity(0);
    };

    node.addEventListener("mousemove", handleMouseMove);
    node.addEventListener("mouseenter", handleMouseEnter);
    node.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      node.removeEventListener("mousemove", handleMouseMove);
      node.removeEventListener("mouseenter", handleMouseEnter);
      node.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={divRef}
      className={cn("relative overflow-hidden flex flex-col", className)}
      {...props}
    >
      <div
        className="pointer-events-none absolute inset-0.5 rounded-[inherit] transition duration-300 z-10"
        style={{
          opacity,
          background: `radial-gradient(${spotlightSize || 160}px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      {children}
    </div>
  );
}
