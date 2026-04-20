import { cn } from "@/utils";
import { Plus } from "lucide-react";
import { useState } from "react";

export function Stepper({
  label,
  value,
  onValueChange,
  readOnly = false,
  max,
}: {
  label: string;
  value: number;
  onValueChange: (v: number) => void;
  readOnly?: boolean;
  max?: number;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "text-[10px] font-mono uppercase tracking-[0.14em] transition-colors",
          isFocused ? "text-white" : "text-[#555]",
        )}
      >
        {label}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onValueChange(Math.max(0, value - 1))}
          disabled={readOnly}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-[#1a1a1a] border border-white/10 text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-default"
        >
          <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
            <rect width="10" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>
        {readOnly ? (
          <span className="text-[14px] font-medium text-white min-w-6 text-center">{value}</span>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") {
                onValueChange(0);
                return;
              }
              const num = parseInt(val, 10);
              if (!isNaN(num)) {
                if (max !== undefined && num > max) {
                  onValueChange(max);
                } else {
                  onValueChange(num);
                }
              }
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="w-10 bg-transparent text-[14px] font-medium text-white text-center focus:outline-none border-b border-transparent focus:border-white/20"
          />
        )}
        <button
          type="button"
          onClick={() => {
            const next = value + 1;
            if (max !== undefined && next > max) return;
            onValueChange(next);
          }}
          disabled={readOnly || (max !== undefined && value >= max)}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-[#1a1a1a] border border-white/10 text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-default"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
