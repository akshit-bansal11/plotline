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
  icons: {
    icon: "/ab11-logo-dot-dark.svg",
  },
};

import { Providers } from "./providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark scroll-smooth"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-(--background) text-(--foreground) antialiased relative overflow-x-hidden`}
      >
        <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-50 mix-blend-overlay"></div>

        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
