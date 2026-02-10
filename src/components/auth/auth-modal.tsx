"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, User, Chrome, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/auth-context";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type AuthMode = "signin" | "signup";

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const [mode, setMode] = useState<AuthMode>("signin");
    const [displayName, setDisplayName] = useState("");
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
        setIsSubmitting(true);
        try {
            if (mode === "signin") {
                await signInWithEmail(email.trim(), password);
            } else {
                await signUpWithEmail(email.trim(), password, displayName.trim());
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
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Full Name"
                                        value={displayName}
                                        onChange={(event) => setDisplayName(event.target.value)}
                                        className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 pl-10 pr-4 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                                    />
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

                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 pl-10 pr-4 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                        />
                    </div>
                </div>

                {error && <div className="text-sm text-red-400">{error}</div>}
                {info && <div className="text-sm text-emerald-300">{info}</div>}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/90 backdrop-blur-sm text-neutral-950 py-3 font-semibold transition-all hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
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
                        <span className="bg-transparent px-2 text-neutral-500">Or continue with</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-800/50 border border-white/5 py-3 text-neutral-300 font-medium transition-colors hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                    <Chrome size={20} />
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
