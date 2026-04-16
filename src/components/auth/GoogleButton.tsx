import { FcGoogle } from "react-icons/fc";
import { cn } from "@/utils";

interface GoogleButtonProps {
  onClick: () => void;
  isLoading: boolean;
  className?: string;
}

export function GoogleButton({ onClick, isLoading, className }: GoogleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-white/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      <FcGoogle className="h-5 w-5" />
      {isLoading ? "Connecting..." : "Continue with Google"}
    </button>
  );
}
