// import Image from "next/image";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
// import { AvailabilityInfographic } from "@/components/overlay/AvailabilityInfographic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {/* <AvailabilityInfographic /> */}
      <main className="relative z-0 min-h-screen flex flex-col pt-24 pb-12">{children}</main>
      <Footer />
    </>
  );
}
