import { Mail } from "lucide-react";
import { motion } from "motion/react";
import { FcGoogle } from "react-icons/fc";
import { getLastUsedProvider } from "@/utils/auth";

export function AuthMethodBadge() {
  const lastProvider = getLastUsedProvider();

  if (!lastProvider) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex items-center justify-center gap-2 rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60"
    >
      <span className="opacity-70">Recommended:</span>
      <div className="flex items-center gap-1.5 text-white">
        {lastProvider === "google" ? (
          <>
            <FcGoogle className="h-3.5 w-3.5" />
            Google
          </>
        ) : (
          <>
            <Mail className="h-3.5 w-3.5 text-blue-400" />
            Email/Password
          </>
        )}
      </div>
      <span className="ml-1 opacity-50">(Last used)</span>
    </motion.div>
  );
}
