export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-neutral-950/70 px-4 py-5 text-neutral-400 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <p className="text-lg font-light tracking-wide text-neutral-200 font-sans">Plotline</p>
        <p className="text-xs text-neutral-500">
          © {new Date().getFullYear()} Plotline. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
