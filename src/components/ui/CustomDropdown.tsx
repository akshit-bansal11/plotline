"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils";

export function CustomDropdown({
  value,
  onChange,
  options,
  readOnly = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (readOnly) {
    return (
      <div className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg py-2.5 px-4 text-[13px] text-white flex items-center justify-between opacity-60 cursor-default">
        <span>{value}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg py-2.5 px-4 text-[13px] text-white flex items-center justify-between hover:border-white/20 focus:outline-none transition-all"
      >
        <span>{value}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-[#555] transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <ul className="absolute bottom-full left-0 right-0 mb-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-[100] max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-[13px] cursor-pointer transition-colors outline-none",
                  opt === value
                    ? "text-white bg-white/[0.06]"
                    : "text-[#aaa] hover:bg-white/[0.03] hover:text-white focus:bg-white/[0.03] focus:text-white",
                )}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
