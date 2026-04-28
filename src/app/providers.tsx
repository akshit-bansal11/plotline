"use client";

import { AuthProvider } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { SectionProvider } from "@/context/SectionContext";
import { RecaptchaProvider } from "@/providers/RecaptchaProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <RecaptchaProvider>
      <AuthProvider>
        <SectionProvider>
          <DataProvider>{children}</DataProvider>
        </SectionProvider>
      </AuthProvider>
    </RecaptchaProvider>
  );
}
