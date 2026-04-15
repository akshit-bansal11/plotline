"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/utils";

export function ImageWithSkeleton({ className, alt, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  const sizes = props.fill && !props.sizes ? "160px" : props.sizes;

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-neutral-800/60" />
      )}
      <Image
        {...props}
        sizes={sizes}
        alt={alt ?? ""}
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
