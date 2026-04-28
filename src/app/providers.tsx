"use client";

import { AuthProvider } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { SectionProvider } from "@/context/SectionContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SectionProvider>
        <DataProvider>{children}</DataProvider>
      </SectionProvider>
    </AuthProvider>
  );
}
