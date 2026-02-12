"use client";

import React, { useRef, useState, MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface SpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    spotlightColor?: string;
}

export function Spotlight({
    children,
    className = "",
    spotlightColor = "rgba(255, 255, 255, 0.1)",
    ...props
}: SpotlightProps) {
    const divRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);
    const [spotlightSize, setSpotlightSize] = useState(0);

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        if (!divRef.current) return;

        const div = divRef.current;
        const rect = div.getBoundingClientRect();

        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        const nextSize = Math.max(rect.width, rect.height) + 6;
        setSpotlightSize(nextSize);
    };

    const handleMouseEnter = () => {
        setOpacity(1);
    };

    const handleMouseLeave = () => {
        setOpacity(0);
    };

    return (
        <div
            ref={divRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn("relative overflow-hidden", className)}
            {...props}
        >
            <div
                className="pointer-events-none absolute inset-[2px] rounded-[inherit] transition duration-300 z-10"
                style={{
                    opacity,
                    background: `radial-gradient(${spotlightSize || 160}px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 60%)`,
                }}
            />
            {children}
        </div>
    );
}
