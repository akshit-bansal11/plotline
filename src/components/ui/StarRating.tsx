"use client";

import { useState } from "react";
import { cn } from "@/utils";

export function StarRating({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const numericValue = parseFloat(value) || 0;

  // Calculate what to display
  const displayValue = hoverValue !== null ? hoverValue : numericValue;

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (readOnly) return;

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const starWidth = rect.width / 10;

    // Calculate index (0 to 9)
    const starIndex = Math.floor(x / starWidth);
    const starRelativeX = x % starWidth;

    // Determine if it's left half or right half
    const isHalf = starRelativeX < starWidth / 2;
    const newValue = starIndex + (isHalf ? 0.5 : 1.0);

    setHoverValue(newValue);
  };

  const handleClick = () => {
    if (readOnly || hoverValue === null) return;
    onChange(hoverValue.toFixed(1));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (readOnly) return;
    if (e.key === "Enter" || e.key === " ") {
      handleClick();
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        tabIndex={readOnly ? -1 : 0}
        className={cn("flex gap-1 outline-none", !readOnly && "cursor-pointer")}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverValue(null)}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label="Star rating"
      >
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          // filled if displayValue is at least n
          const isFull = displayValue >= n;
          // half-filled if displayValue is n-0.5
          const isHalf = displayValue === n - 0.5;

          return (
            <div
              key={n}
              className={cn(
                "transition-transform focus:outline-none",
                !readOnly && "hover:scale-110",
              )}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" className="overflow-visible">
                <title>Rating Star</title>
                <defs>
                  <linearGradient id={`star-grad-${n}`}>
                    <stop offset="50%" stopColor={isFull || isHalf ? "#fff" : "transparent"} />
                    <stop offset="50%" stopColor="transparent" />
                  </linearGradient>
                </defs>
                <polygon
                  points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                  fill={isFull ? "#fff" : isHalf ? `url(#star-grad-${n})` : "none"}
                  stroke={isFull || isHalf ? "#fff" : "#333"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          );
        })}
      </button>
      <span className="text-[18px] font-extrabold text-white min-w-[3ch]">
        {displayValue > 0 ? displayValue.toFixed(1) : "0.0"}
      </span>
    </div>
  );
}
