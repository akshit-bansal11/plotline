"use client";

import type { UserCircle } from "lucide-react";
import { cn } from "@/utils";

export const MenuItem = ({
  label,
  onClick,
  icon: Icon,
  buttonRef,
  className: extraClassName,
}: {
  label: string;
  onClick: () => void;
  icon: typeof UserCircle;
  buttonRef?: (node: HTMLButtonElement | null) => void;
  className?: string;
}) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    ref={buttonRef}
    className={cn(
      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-neutral-200 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
      extraClassName,
    )}
  >
    <Icon size={16} className="text-neutral-400" suppressHydrationWarning />
    <span>{label}</span>
  </button>
);
