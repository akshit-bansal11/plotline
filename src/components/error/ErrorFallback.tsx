// File: src/components/error/ErrorFallback.tsx
// Purpose: Fallback UI displayed when ErrorBoundary catches an error

"use client";

// ─── React
import type { ReactNode } from "react";

// ─── Third-party
import { RefreshCw, AlertTriangle } from "lucide-react";

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

/**
 * A user-friendly error fallback component with Plotline branding.
 */
export const ErrorFallback = ({ error, resetError }: ErrorFallbackProps) => {
  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center rounded-3xl border border-white/10 bg-neutral-900/40 p-8 text-center backdrop-blur-xl">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-500">
        <AlertTriangle size={32} />
      </div>

      <h2 className="mb-2 text-2xl font-semibold text-white">Something went wrong</h2>
      
      <p className="mb-8 max-w-md text-neutral-400">
        Plotline encountered an unexpected error. Don't worry, your data is safe.
        {error?.message && (
          <code className="mt-4 block rounded-lg bg-neutral-950/50 p-2 text-xs text-neutral-500">
            {error.message}
          </code>
        )}
      </p>

      {resetError && (
        <button
          type="button"
          onClick={resetError}
          className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-neutral-200 active:scale-95"
        >
          <RefreshCw size={16} />
          <span>Try again</span>
        </button>
      )}
    </div>
  );
};
