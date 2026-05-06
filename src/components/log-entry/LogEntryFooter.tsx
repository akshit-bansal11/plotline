// File: src/components/log-entry/LogEntryFooter.tsx
// Purpose: Footer section for the log entry modal with action buttons and feedback indicators

// ─── Icons
import { AlertCircle, CheckCircle, Trash2 } from "lucide-react";
// ─── React
import type React from "react";

// ─── Internal — utils
import { cn } from "@/utils";

interface LogEntryFooterProps {
  currentMode: "create" | "view" | "edit";
  isSaving: boolean;
  isDirty: boolean;
  error: string | null;
  info: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete?: () => void;
  showDeleteConfirm?: boolean;
}

/**
 * Renders the action buttons and status messages at the bottom of the log entry modal.
 */
export function LogEntryFooter({
  currentMode,
  isSaving,
  isDirty,
  error,
  info,
  onClose,
  onSubmit,
  onDelete,
  showDeleteConfirm,
}: LogEntryFooterProps) {
  return (
    <div className="flex items-center justify-between p-4 px-6 border-t border-zinc-800 bg-zinc-950/50">
      {/* Feedback Area */}
      <div className="flex items-center gap-3 min-h-[24px]">
        {error && (
          <div className="flex items-center gap-2 text-red-500 animate-in fade-in slide-in-from-left-2 duration-200">
            <AlertCircle className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-wider">{error}</span>
          </div>
        )}
        {info && (
          <div className="flex items-center gap-2 text-emerald-500 animate-in fade-in slide-in-from-left-2 duration-200">
            <CheckCircle className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-wider">{info}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {currentMode === "edit" && (
          <button
            type="button"
            onClick={onDelete}
            className={cn(
              "px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-all rounded-md flex items-center gap-2",
              showDeleteConfirm
                ? "bg-red-600 hover:bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.2)]"
                : "text-zinc-500 hover:text-red-500 hover:bg-red-500/10",
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {showDeleteConfirm ? "Click to Confirm Delete" : "Delete Entry"}
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-zinc-500 hover:text-zinc-200 text-[11px] font-bold uppercase tracking-widest transition-all"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSaving || (currentMode === "edit" && !isDirty)}
          className={cn(
            "px-6 py-2 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all",
            isSaving || (currentMode === "edit" && !isDirty)
              ? "bg-zinc-900 text-zinc-700 border border-zinc-800 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_4px_20_rgba(37,99,235,0.2)] active:scale-95",
          )}
        >
          {isSaving ? "Saving..." : currentMode === "create" ? "Add to Library" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
