import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { useAuth } from "@/context/AuthContext";

interface SignupFormProps {
  onToggleLogin: () => void;
}

export function SignupForm({ onToggleLogin }: SignupFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { signUpWithEmail, loading, error: authError } = useAuth();
  const { executeRecaptcha } = useGoogleReCaptcha();

  const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^[a-zA-Z]*$/.test(val)) setFirstName(val);
  };

  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^[a-zA-Z]*$/.test(val)) setLastName(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Name validation
    if (!firstName.trim() || !lastName.trim()) {
      setValidationError("First name and last name are required.");
      return;
    }
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setValidationError(
        "First and last name must each be at least 2 characters.",
      );
      return;
    }

    // Password validation (matches AuthModal rules)
    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setValidationError(
        "Password must contain at least one uppercase letter.",
      );
      return;
    }
    if (!/[a-z]/.test(password)) {
      setValidationError(
        "Password must contain at least one lowercase letter.",
      );
      return;
    }
    if (!/[0-9]/.test(password)) {
      setValidationError("Password must contain at least one number.");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setValidationError(
        "Password must contain at least one special character.",
      );
      return;
    }
    if (firstName && password.toLowerCase().includes(firstName.toLowerCase())) {
      setValidationError("Password cannot contain your first name.");
      return;
    }
    if (lastName && password.toLowerCase().includes(lastName.toLowerCase())) {
      setValidationError("Password cannot contain your last name.");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("Passwords do not match.");
      return;
    }

    if (!executeRecaptcha) {
      console.error("Execute recaptcha not yet available");
      return;
    }

    const token = await executeRecaptcha("signup");
    await signUpWithEmail(
      email,
      password,
      `${firstName.trim()} ${lastName.trim()}`,
      token,
    );
  };

  const error = validationError || authError;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name fields */}
      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <label
            className="text-sm font-medium text-white/70 ml-1"
            htmlFor="signup-first-name"
          >
            First Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              id="signup-first-name"
              type="text"
              placeholder="Jane"
              value={firstName}
              onChange={handleFirstNameChange}
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <label
            className="text-sm font-medium text-white/70 ml-1"
            htmlFor="signup-last-name"
          >
            Last Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              id="signup-last-name"
              type="text"
              placeholder="Doe"
              value={lastName}
              onChange={handleLastNameChange}
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        </div>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <label
          className="text-sm font-medium text-white/70 ml-1"
          htmlFor="signup-email"
        >
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            id="signup-email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
      </div>

      {/* Password + PasswordStrength */}
      <div className="space-y-2">
        <label
          className="text-sm font-medium text-white/70 ml-1"
          htmlFor="signup-password"
        >
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            id="signup-password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <AnimatePresence>
          {password.length > 0 && (
            <PasswordStrength
              password={password}
              firstName={firstName}
              lastName={lastName}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <label
          className="text-sm font-medium text-white/70 ml-1"
          htmlFor="confirm-password"
        >
          Confirm Password
        </label>
        <div className="relative">
          <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
        className="w-full flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Create Account"
        )}
      </button>

      <p className="text-center text-xs text-white/40 mt-4">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onToggleLogin}
          className="font-medium text-white hover:underline"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}
