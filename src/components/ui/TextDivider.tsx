export function TextDivider({ label }: { label?: string }) {
  if (!label) {
    return <div className="w-full border-t border-white/5 my-8"></div>;
  }

  return (
    <div className="relative my-8">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-white/5"></div>
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-neutral-950 px-2 text-white/30">{label}</span>
      </div>
    </div>
  );
}
