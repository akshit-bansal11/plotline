// File: src/components/log-entry/MediaCardImage.tsx
// Purpose: Poster image component for the media card with loading states and overlays

"use client";

// ─── React
import { useState } from "react";
import Image from "next/image";

// ─── Icons
import { Star } from "lucide-react";

// ─── Internal — utils
import { cn } from "@/utils";

interface MediaCardImageProps {
  image: string | null;
  title: string;
  imageLoaded: boolean;
  onLoad: () => void;
}

export function MediaCardImage({ image, title, imageLoaded, onLoad }: MediaCardImageProps) {
  return (
    <div className="absolute inset-0">
      {image ? (
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          className={cn(
            "object-cover transition-transform duration-700 group-hover:scale-110",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={onLoad}
        />
      ) : (
        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
          <Star className="w-8 h-8 text-zinc-700" />
        </div>
      )}
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 md:opacity-0 md:group-hover:opacity-90 transition-opacity" />
    </div>
  );
}
