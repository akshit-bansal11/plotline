"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { ForgotPassword } from "@/components/auth/ForgotPassword";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { TextDivider } from "@/components/ui/TextDivider";
import { GlassCard } from "@/components/ui/GlassCard";
import type { AuthView as AuthViewType } from "@/types/auth";
import { AuthBackground } from "@/components/background/AuthBackground";
import { getHeading, getSubtext } from "../state/auth-view.machine";
import { scaleFade, slideLeft, slideRight } from "@/lib/animations/auth";

const AuthMethodBadge = dynamic(
  () => import("@/components/auth/AuthMethodBadge").then((module) => module.AuthMethodBadge),
  { ssr: false },
);

interface AuthViewProps {
  view: AuthViewType;
  setView: (view: AuthViewType) => void;
  signInWithGoogle: () => void;
  loading: boolean;
}

export function AuthView({ view, setView, signInWithGoogle, loading }: AuthViewProps) {
  const heading = getHeading(view);
  const subtext = getSubtext(view);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-neutral-950 overflow-hidden">
      <AuthBackground />

      <div className="relative w-full max-w-105 z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-light font-sans text-white tracking-tight">{heading}</h1>
          <p className="text-white/50 text-sm mt-1">{subtext}</p>
        </div>

        <GlassCard className="p-8 border-white/5 shadow-2xl backdrop-blur-3xl">
          <AnimatePresence mode="wait">
            {view === "login" && (
              <motion.div key="login" {...slideLeft}>
                <AuthMethodBadge />
                <LoginForm
                  onToggleSignup={() => setView("signup")}
                  onToggleForgotPassword={() => setView("forgot-password")}
                />

                <TextDivider label="Or continue with" />

                <GoogleButton onClick={signInWithGoogle} isLoading={loading} />
              </motion.div>
            )}

            {view === "signup" && (
              <motion.div key="signup" {...slideRight}>
                <SignupForm onToggleLogin={() => setView("login")} />

                <TextDivider label="Or sign up with" />

                <GoogleButton onClick={signInWithGoogle} isLoading={loading} />
                <p className="text-center text-[10px] text-white/20 mt-6 leading-relaxed">
                  By clicking continue, you agree to our{" "}
                  <span className="underline">Terms of Service</span> and{" "}
                  <span className="underline">Privacy Policy</span>.
                </p>
              </motion.div>
            )}

            {view === "forgot-password" && (
              <motion.div key="forgot" {...scaleFade}>
                <ForgotPassword onBack={() => setView("login")} />
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </div>
    </div>
  );
}
