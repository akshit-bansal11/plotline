import { Plus } from "lucide-react";

export function Stepper({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: number;
  onValueChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#555]">{label}</div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onValueChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-[#1a1a1a] border border-white/10 text-white hover:border-white/20 transition-all"
        >
          <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
            <rect width="10" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>
        <span className="text-[14px] font-medium text-white min-w-[24px] text-center">{value}</span>
        <button
          type="button"
          onClick={() => onValueChange(value + 1)}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-[#1a1a1a] border border-white/10 text-white hover:border-white/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
