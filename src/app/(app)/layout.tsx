// import Image from "next/image";
import { Navbar } from "@/components/layout/Navbar";
import { AvailabilityInfographic } from "@/components/overlay/AvailabilityInfographic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <AvailabilityInfographic />
      <main className="relative z-0 min-h-screen flex flex-col pt-24 pb-12">{children}</main>
      <footer className="border-t border-white/5 bg-neutral-950/70 px-4 py-5 text-neutral-400 md:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* <Image src="/draft-2-vector.svg" alt="Plotline" width={18} height={18} /> */}
            <p className="text-lg font-light tracking-wide text-neutral-200 font-sans">Plotline</p>
          </div>
          <p className="text-xs text-neutral-500">
            © {new Date().getFullYear()} Plotline. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}
