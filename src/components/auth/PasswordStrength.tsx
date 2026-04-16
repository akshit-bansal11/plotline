"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/utils";

export function PasswordStrength({
  password,
  firstName,
  lastName,
}: {
  password: string;
  firstName: string;
  lastName: string;
}) {
  const reqs = [
    { label: "At least 8 characters", met: password.length >= 8 },
    {
      label: "One uppercase & one lowercase",
      met: /[A-Z]/.test(password) && /[a-z]/.test(password),
    },
    { label: "One number", met: /[0-9]/.test(password) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(password) },
    {
      label: "Doesn't contain your name",
      met:
        password.length > 0 &&
        (!firstName || !password.toLowerCase().includes(firstName.toLowerCase())) &&
        (!lastName || !password.toLowerCase().includes(lastName.toLowerCase())),
    },
  ];

  const strengthScore = password.length === 0 ? 0 : reqs.filter((r) => r.met).length;

  const getStrengthColor = (score: number) => {
    if (score === 0) return "bg-neutral-800";
    if (score <= 2) return "bg-red-500";
    if (score <= 3) return "bg-amber-400";
    if (score === 4) return "bg-blue-400";
    return "bg-emerald-500";
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="pt-4 overflow-hidden"
    >
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="h-1.5 flex-1 rounded-full overflow-hidden bg-neutral-800/80">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: index <= strengthScore ? "100%" : "0%" }}
              transition={{ duration: 0.3 }}
              className={cn("h-full", getStrengthColor(strengthScore))}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 text-[10px]">
        {reqs.map((req) => (
          <div
            key={req.label}
            className={cn(
              "flex items-center gap-2 transition-colors duration-300",
              req.met ? "text-emerald-400" : "text-neutral-500",
            )}
          >
            {req.met ? (
              <Check size={12} className="shrink-0" />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-700 ml-0.5 shrink-0" />
            )}
            <span className="font-medium text-[11px]">{req.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
