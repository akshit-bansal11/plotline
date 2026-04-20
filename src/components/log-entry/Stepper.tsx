import { Plus } from "lucide-react";

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
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#555]">{label}</div>
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
        <span className="text-[14px] font-medium text-white min-w-6 text-center">{value}</span>
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
