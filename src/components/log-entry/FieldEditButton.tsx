"use client";

import { Pencil } from "lucide-react";
import { cn } from "@/utils";

export function FieldEditButton({ active = false }: { active?: boolean }) {
  return (
    <div
      className={cn(
        "transition-colors shrink-0",
        active ? "text-white" : "text-white/20 hover:text-white/60",
      )}
    >
      <Pencil className="w-3 h-3" />
    </div>
  );
}
