import type { Metadata } from "next";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plotline",
  description: "A modern, cinematic media organizer.",
  icons: {
    icon: "/ab11-logo-dot-dark.svg",
  },
};

import { Navbar } from "@/components/layout/Navbar";
import { AuthProvider } from "@/context/AuthContext";
import { SectionProvider } from "@/context/SectionContext";
import { DataProvider } from "@/context/DataContext";

import { AvailabilityInfographic } from "@/components/layout/AvailabilityInfographic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased relative overflow-x-hidden`}
      >
        {/* Background Gradients/Noise can be added here later */}
        <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-50 mix-blend-overlay"></div>

        <AuthProvider>
          <SectionProvider>
            <DataProvider>
              <Navbar />
              <AvailabilityInfographic />
              <main className="relative z-0 min-h-screen flex flex-col pt-24 pb-12">
                {children}
              </main>
              <footer className="border-t border-white/5 bg-neutral-950/70 px-4 py-5 text-neutral-400 md:px-8">
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Image src="/ab11-logo-dot-dark.svg" alt="Plotline" width={18} height={18} />
                    <span className="text-sm font-semibold tracking-wide text-neutral-200">Plotline</span>
                  </div>
                  <p className="text-xs text-neutral-500">© {new Date().getFullYear()} Plotline. All rights reserved.</p>
                </div>
              </footer>
            </DataProvider>
          </SectionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
