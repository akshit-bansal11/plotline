"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/utils";
import { FieldEditButton } from "./FieldEditButton";

interface InlineEditableProps {
  value: string | number;
  onCommit: (value: string) => void;
  fieldId: string;
  activeField: string | null;
  setActiveField: (fieldId: string | null) => void;
  children?: ReactNode;
  className?: string;
  multiline?: boolean;
  type?: "text" | "number";
  readOnly?: boolean;
}

export function InlineEditable({
  value,
  onCommit,
  fieldId,
  activeField,
  setActiveField,
  children,
  className,
  multiline = false,
  type = "text",
  readOnly = false,
}: InlineEditableProps) {
  const isActive = activeField === fieldId;
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  if (isActive && !readOnly) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          className={cn(
            "w-full bg-[#1a1a1a] border border-white/20 rounded-lg p-3 text-[13px] text-white focus:outline-none min-h-[100px] resize-none",
            className,
          )}
          defaultValue={String(value)}
          onBlur={(e) => {
            onCommit(e.target.value);
            setActiveField(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              onCommit(e.currentTarget.value);
              setActiveField(null);
            }
            if (e.key === "Escape") setActiveField(null);
          }}
        />
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type}
        className={cn(
          "w-full bg-[#1a1a1a] border border-white/20 rounded-lg px-2 py-1 text-[13px] text-white focus:outline-none",
          className,
        )}
        defaultValue={String(value)}
        onBlur={(e) => {
          onCommit(e.target.value);
          setActiveField(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onCommit(e.currentTarget.value);
            setActiveField(null);
          }
          if (e.key === "Escape") setActiveField(null);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "group relative flex items-center justify-between w-full min-h-[1.5em] text-left",
        !readOnly && "cursor-pointer",
      )}
      onClick={() => !readOnly && setActiveField(fieldId)}
    >
      <div className={cn("flex-1 min-w-0 pr-6", className)}>
        {children ?? (
          <div className="truncate">{value || <span className="text-[#333]">\u2014</span>}</div>
        )}
      </div>
      {!readOnly && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <FieldEditButton active={isActive} />
        </div>
      )}
    </button>
  );
}
