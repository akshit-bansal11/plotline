"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ImageWithSkeleton({ className, ...props }: ImageProps) {
    const [loaded, setLoaded] = useState(false);

    return (
        <>
            {!loaded && (
                <div className="absolute inset-0 animate-pulse bg-neutral-800/60" />
            )}
            <Image
                {...props}
                className={cn(
                    "transition-opacity duration-300",
                    loaded ? "opacity-100" : "opacity-0",
                    className,
                )}
                onLoad={() => setLoaded(true)}
            />
        </>
    );
}
