"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/utils";

interface DescriptionErrorWrapperProps {
  isInvalid: boolean;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DescriptionErrorWrapper({
  isInvalid,
  children,
  actions,
  className,
  contentClassName,
}: DescriptionErrorWrapperProps) {
  if (!isInvalid) {
    return (
      <div className={cn("relative h-full w-full", className)}>
        {children}
        {actions && (
          <div className="absolute inset-x-0 bottom-0 pointer-events-none z-20">
            {actions}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[inherit] h-full w-full ring-2 ring-red-500 ring-inset",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 blur-md saturate-50 pointer-events-none select-none",
          contentClassName,
        )}
      >
        {children}
      </div>

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-red-950/20 pointer-events-none">
        <div className="flex flex-col items-center justify-center bg-neutral-950/90 p-4 rounded-xl border border-red-500/50 shadow-2xl backdrop-blur-md w-[85%] text-center pointer-events-auto">
          <AlertTriangle className="text-red-500 mb-2" size={28} />
          <p className="text-xs font-bold text-red-200 leading-relaxed">
            There is a problem with the data entered.
            <br />
            <span className="text-red-400 font-medium">Please fix it.</span>
          </p>
        </div>
      </div>

      {actions && (
        <div className="absolute inset-x-0 bottom-0 pointer-events-none z-20">
          {actions}
        </div>
      )}
    </div>
  );
}
