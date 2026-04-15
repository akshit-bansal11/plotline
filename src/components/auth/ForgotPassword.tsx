import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface ForgotPasswordProps {
  onBack: () => void;
}

export function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const [email, setEmail] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const { sendPasswordReset, loading, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendPasswordReset(email);
      setIsSuccess(true);
    } catch {
      // Error is handled by context state
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-500/10 p-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">Check your email</h3>
          <p className="text-sm text-white/60 px-4">
            We&apos;ve sent a password reset link to{" "}
            <span className="text-white">{email}</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
        >
          Return to login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full p-1 text-white/40 hover:bg-white/5 hover:text-white transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-lg font-semibold text-white">Reset Password</h3>
      </div>

      <p className="text-sm text-white/50 px-1">
        Enter your email address and we&apos;ll send you a link to reset your
        password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-white/70 ml-1"
            htmlFor="reset-email"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              id="reset-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 transition-all hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Send Reset Link"
          )}
        </button>
      </form>
    </div>
  );
}
