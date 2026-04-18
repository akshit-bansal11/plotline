export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mt-8 mb-4 first:mt-0">
      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#555] mb-2">
        {title}
      </div>
      <div className="h-px w-full bg-white/5" />
    </div>
  );
}
