import type { Metadata } from "next";
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
};

import { Navbar } from "@/components/layout/navbar";
import { AuthProvider } from "@/context/auth-context";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased relative overflow-x-hidden`}
      >
        {/* Background Gradients/Noise can be added here later */}
        <div className="fixed inset-0 bg-[url('/noise.svg')] opacity-[0.03] pointer-events-none z-50 mix-blend-overlay"></div>

        <AuthProvider>
          <Navbar />
          <main className="relative z-0 min-h-screen flex flex-col pt-24 pb-12">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
