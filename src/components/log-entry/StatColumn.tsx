export function StatColumn({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-[#555]">{label}</div>
      <div className="text-[22px] font-extrabold text-white leading-none tracking-tight">
        {value}
      </div>
    </div>
  );
}
