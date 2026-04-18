"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
// import Image from "next/image";
import { useState } from "react";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { ForgotPassword } from "@/components/auth/ForgotPassword";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { GlassCard } from "@/components/ui/GlassCard";
import { useAuth } from "@/context/AuthContext";
import type { AuthView } from "@/types/auth";

const AuthMethodBadge = dynamic(
  () => import("@/components/auth/AuthMethodBadge").then((module) => module.AuthMethodBadge),
  { ssr: false },
);

export default function AuthPage() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  if (!siteKey) {
    throw new Error("Missing NEXT_PUBLIC_RECAPTCHA_SITE_KEY");
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
      <AuthContent />
    </GoogleReCaptchaProvider>
  );
}

function AuthContent() {
  const [view, setView] = useState<AuthView>("login");
  const { signInWithGoogle, loading } = useAuth();
  const heading =
    view === "login"
      ? "Welcome back"
      : view === "signup"
        ? "Create an account"
        : "Reset your password";

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-neutral-950 overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />

      <div className="relative w-full max-w-105 z-10">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          {/* <Image
            src="draft-2-vector.svg"
            alt="Plotline"
            width={48}
            height={48}
            className="mx-auto"
          /> */}
          <h1 className="text-4xl font-light font-sans text-white tracking-tight">{heading}</h1>
          <p className="text-white/50 text-sm mt-1">
            {view === "login"
              ? "Sign in to continue to Plotline"
              : view === "signup"
                ? "Create an account to get started"
                : "Reset your account password"}
          </p>
        </div>

        <GlassCard className="p-8 border-white/5 shadow-2xl backdrop-blur-3xl">
          <AnimatePresence mode="wait">
            {view === "login" && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <AuthMethodBadge />
                <LoginForm
                  onToggleSignup={() => setView("signup")}
                  onToggleForgotPassword={() => setView("forgot-password")}
                />

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/5"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-neutral-950 px-2 text-white/30">Or continue with</span>
                  </div>
                </div>

                <GoogleButton onClick={signInWithGoogle} isLoading={loading} />
              </motion.div>
            )}

            {view === "signup" && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <SignupForm onToggleLogin={() => setView("login")} />

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/5"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-neutral-950 px-2 text-white/30">Or sign up with</span>
                  </div>
                </div>

                <GoogleButton onClick={signInWithGoogle} isLoading={loading} />
                <p className="text-center text-[10px] text-white/20 mt-6 leading-relaxed">
                  By clicking continue, you agree to our{" "}
                  <span className="underline">Terms of Service</span> and{" "}
                  <span className="underline">Privacy Policy</span>.
                </p>
              </motion.div>
            )}

            {view === "forgot-password" && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <ForgotPassword onBack={() => setView("login")} />
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </div>
    </div>
  );
}
