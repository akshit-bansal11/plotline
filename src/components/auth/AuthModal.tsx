"use client";

import { ArrowRight, Lock, Mail, User } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { Modal } from "@/components/overlay/Modal";
import { useAuth } from "@/context/AuthContext";
import { GoogleLogo } from "@/data/logoSources";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = "signin" | "signup";

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset } = useAuth();

  const toggleMode = () => setMode(mode === "signin" ? "signup" : "signin");
  const resetState = () => {
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetState();

    // Email Validation
    const emailRegex = /^[^\s@]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address with a valid top-level domain.");
      return;
    }

    // Password & Name Validation for Sign Up
    if (mode === "signup") {
      if (!firstName.trim() || !lastName.trim()) {
        setError("First name and last name are required.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError("Password must contain at least one uppercase letter.");
        return;
      }
      if (!/[a-z]/.test(password)) {
        setError("Password must contain at least one lowercase letter.");
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError("Password must contain at least one number.");
        return;
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        setError("Password must contain at least one special character.");
        return;
      }
      if (firstName && password.toLowerCase().includes(firstName.toLowerCase())) {
        setError("Password cannot contain your first name.");
        return;
      }
      if (lastName && password.toLowerCase().includes(lastName.toLowerCase())) {
        setError("Password cannot contain your last name.");
        return;
      }
    } else {
      if (!password) {
        setError("Password is required.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email.trim(), password);
      } else {
        const displayName = `${firstName.trim()} ${lastName.trim()}`;
        await signUpWithEmail(email.trim(), password, displayName);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    resetState();
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    resetState();
    if (!email.trim()) {
      setError("Enter your email to reset your password.");
      return;
    }
    setIsSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      setInfo("Password reset email sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "signin" ? "Welcome Back" : "Create Account"}
      className="max-w-md bg-neutral-900/60"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {mode === "signup" && (
              <motion.div
                key="name-field"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-3 pt-1">
                  <div className="relative flex-1">
                    <User
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="First Name"
                      value={firstName}
                      onChange={(event) => {
                        const val = event.target.value;
                        if (/^[a-zA-Z]*$/.test(val)) setFirstName(val);
                      }}
                      className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 pl-10 pr-4 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>
                  <div className="relative flex-1">
                    <User
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={lastName}
                      onChange={(event) => {
                        const val = event.target.value;
                        if (/^[a-zA-Z]*$/.test(val)) setLastName(val);
                      }}
                      className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 pl-10 pr-4 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 pl-10 pr-4 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
            />
          </div>

          <div>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                size={18}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 pl-10 pr-4 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>
            <AnimatePresence>
              {mode === "signup" && (
                <PasswordStrength password={password} firstName={firstName} lastName={lastName} />
              )}
            </AnimatePresence>
          </div>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}
        {info && <div className="text-sm text-emerald-300">{info}</div>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/90 backdrop-blur-sm text-neutral-950 py-3 font-semibold transition-all hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 mt-4"
        >
          <span>{mode === "signin" ? "Sign In" : "Sign Up"}</span>
          <ArrowRight size={18} />
        </button>

        {mode === "signin" && (
          <button
            type="button"
            onClick={handleReset}
            className="w-full text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Forgot password?
          </button>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-neutral-900/60 px-2 text-neutral-500">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-800/50 border border-white/5 py-3 text-neutral-300 font-medium transition-colors hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Image src={GoogleLogo} alt="Google" width={20} height={20} />
          <span>Google</span>
        </button>

        <div className="text-center text-sm text-neutral-400">
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={toggleMode}
            className="text-white hover:underline transition-all"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
