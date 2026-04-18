import { cn } from "@/utils";
import { useEffect, useRef, useState } from "react";

export function InlineEditable({
  value,
  onCommit,
  type = "text",
  className = "",
  fieldId,
  activeField,
  setActiveField,
  multiline = false,
  children,
}: {
  value: string;
  onCommit: (v: string) => void;
  type?: string;
  className?: string;
  fieldId: string;
  activeField: string | null;
  setActiveField: (f: string | null) => void;
  multiline?: boolean;
  children?: React.ReactNode;
}) {
  const isActive = activeField === fieldId;
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const commit = () => {
    onCommit(local);
    setActiveField(null);
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isActive) return;

    if (multiline) textareaRef.current?.focus();
    else inputRef.current?.focus();
  }, [isActive, multiline]);

  const inputCls =
    "w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/20 transition-all";

  if (isActive) {
    return multiline ? (
      <textarea
        ref={textareaRef}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") setActiveField(null);
        }}
        className={cn(inputCls, className, "min-h-[80px] resize-none")}
      />
    ) : (
      <input
        ref={inputRef}
        type={type}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setActiveField(null);
        }}
        className={cn(inputCls, className)}
      />
    );
  }

  return (
    <button
      type="button"
      className="group relative cursor-pointer text-left w-full"
      onClick={() => setActiveField(fieldId)}
    >
      {children ?? (
        <div className={className}>{value || <span className="text-[#333]">—</span>}</div>
      )}
      <span className="absolute -top-1 -right-5 opacity-0 group-hover:opacity-100 transition-opacity p-1 pointer-events-none">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#666"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </span>
    </button>
  );
}
