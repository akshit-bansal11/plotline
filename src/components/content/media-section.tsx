"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface MediaSectionProps {
    title: string;
    href?: string;
    children: React.ReactNode;
    className?: string;
}

export function MediaSection({ title, href, children, className }: MediaSectionProps) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });

    return (
        <section
            ref={ref}
            className={cn("py-8 md:py-12 space-y-6", className)}
        >
            <div className="container px-4 md:px-6 flex items-center justify-between">
                <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                    transition={{ duration: 0.6 }}
                    className="text-2xl font-semibold tracking-tight text-white"
                >
                    {title}
                </motion.h2>

                {href && (
                    <Link
                        href={href}
                        className="group flex items-center gap-1 text-sm font-medium text-neutral-400 transition-colors hover:text-white"
                    >
                        See all
                        <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                )}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
            >
                {/* Scroll Container with scroll snapping/padding */}
                <div className="flex overflow-x-auto pb-8 pt-2 px-4 md:px-6 gap-4 snap-x snap-mandatory scrollbar-hide no-scrollbar mask-gradient-x">
                    {children}
                </div>
            </motion.div>
        </section>
    );
}
