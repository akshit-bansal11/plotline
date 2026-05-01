// File: src/providers/RecaptchaProvider.tsx
// Purpose: Provider for Google ReCAPTCHA v3 with environment-aware validation

"use client";

// ─── React
import type { ReactNode } from "react";

// ─── Third-party
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

// ─── Internal — config
import { ENV } from "@/config/env";

/**
 * Provides Google ReCAPTCHA context to the application.
 * In development, missing site keys result in a warning instead of a crash.
 */
export function RecaptchaProvider({ children }: { children: ReactNode }) {
  const siteKey = ENV.RECAPTCHA_SITE_KEY;

  if (!siteKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "ReCAPTCHA: Missing NEXT_PUBLIC_RECAPTCHA_SITE_KEY. ReCAPTCHA features will be disabled.",
      );
      return <>{children}</>;
    }
    throw new Error("Missing NEXT_PUBLIC_RECAPTCHA_SITE_KEY in production environment.");
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={siteKey}
      scriptProps={{
        async: false,
        defer: false,
        appendTo: "head",
        nonce: undefined,
      }}
    >
      {children}
    </GoogleReCaptchaProvider>
  );
}
