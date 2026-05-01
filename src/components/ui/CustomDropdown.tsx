// File: src/components/ui/CustomDropdown.tsx
// Purpose: Stylized select component with accessibility and keyboard navigation

"use client";

// ─── React
import { useEffect, useId, useRef, useState } from "react";

// ─── Third-party
import { ChevronDown } from "lucide-react";

// ─── Internal — utils
import { cn } from "@/utils";

/**
 * A custom dropdown component for single-select fields.
 * Includes ARIA attributes and full keyboard navigation support.
 */
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // ─── Effect: Click Outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Handlers: Keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (readOnly) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(options.indexOf(value));
      } else {
        setActiveIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(options.indexOf(value));
      } else {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open && activeIndex !== -1) {
        onChange(options[activeIndex]);
        setOpen(false);
      } else {
        setOpen(true);
        setActiveIndex(options.indexOf(value));
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (readOnly) {
    return (
      <div className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg py-2.5 px-4 text-[13px] text-white flex items-center justify-between opacity-60 cursor-default">
        <span>{value}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        role="combobox"
        aria-autocomplete="none"
        aria-label="Select option"
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
        <ul
          id={listboxId}
          role="listbox"
          className="absolute bottom-full left-0 right-0 mb-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-[100] max-h-48 overflow-y-auto"
        >
          {options.map((opt, index) => (
            <li
              key={opt}
              role="option"
              aria-selected={opt === value}
              className={cn(
                "w-full text-left px-4 py-2.5 text-[13px] cursor-pointer transition-colors outline-none",
                opt === value
                  ? "text-white bg-white/[0.06]"
                  : index === activeIndex
                    ? "text-white bg-white/[0.03]"
                    : "text-[#aaa] hover:bg-white/[0.03] hover:text-white",
              )}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
