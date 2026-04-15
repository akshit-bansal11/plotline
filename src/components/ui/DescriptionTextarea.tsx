"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/utils";
import { MAX_DESCRIPTION_LENGTH } from "@/utils/validation";

interface DescriptionTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onValueChange: (val: string) => void;
  maxLengthLimit?: number;
  errorText?: string;
}

export function DescriptionTextarea({
  value,
  onValueChange,
  maxLengthLimit = MAX_DESCRIPTION_LENGTH,
  className,
  errorText,
  ...props
}: DescriptionTextareaProps) {
  const currentLength = value.length;
  const isOverLimit = currentLength > maxLengthLimit;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    // Prevent typing beyond the limit.
    // If the new value is longer than the limit AND longer than the previous value, we reject it.
    // This handles both typing and pastes, preventing the length from increasing over the limit,
    // without auto-trimming the text.
    if (newVal.length > maxLengthLimit && newVal.length > currentLength) {
      return;
    }
    onValueChange(newVal);
  };

  return (
    <div className="space-y-2 w-full">
      <textarea
        value={value}
        onChange={handleChange}
        className={cn(
          "w-full resize-none rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-1",
          isOverLimit
            ? "border-red-500/50 bg-red-950/10 text-red-200 placeholder-red-500/50 focus:ring-red-500/50 focus:border-red-500"
            : "border-white/10 bg-neutral-900/70 text-neutral-100 placeholder-neutral-500 focus:ring-white/20 focus:border-neutral-500",
          className,
        )}
        {...props}
      />
      <div className="flex items-center justify-between text-xs px-1">
        {errorText || isOverLimit ? (
          <div className="flex items-center gap-1.5 text-red-400 font-medium overflow-hidden">
            <AlertTriangle size={12} className="shrink-0" />
            <span className="truncate">
              {errorText ||
                `Description exceeds the ${maxLengthLimit} character limit.`}
            </span>
          </div>
        ) : (
          <div />
        )}
        <div
          className={cn(
            "font-medium select-none shrink-0",
            isOverLimit ? "text-red-400" : "text-neutral-500",
          )}
        >
          {currentLength} / {maxLengthLimit}
        </div>
      </div>
    </div>
  );
}
