"use client";

import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { ENV } from "@/config/env";

export function RecaptchaProvider({ children }: { children: React.ReactNode }) {
  if (!ENV.RECAPTCHA_SITE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_RECAPTCHA_SITE_KEY");
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={ENV.RECAPTCHA_SITE_KEY}
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
