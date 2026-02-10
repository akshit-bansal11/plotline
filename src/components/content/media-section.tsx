"use client";

import { useMemo, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface MediaSectionProps<TItem> {
    title: string;
    href?: string;
    items: TItem[];
    getGenresThemes: (item: TItem) => string[] | null | undefined;
    children: (filteredItems: TItem[]) => React.ReactNode;
    className?: string;
    filterRaw?: string;
    onFilterRawChange?: (next: string) => void;
}

export function MediaSection<TItem>({
    title,
    href,
    items,
    getGenresThemes,
    children,
    className,
    filterRaw,
    onFilterRawChange,
}: MediaSectionProps<TItem>) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });
    const [uncontrolledFilterRaw, setUncontrolledFilterRaw] = useState("");
    const resolvedFilterRaw = typeof filterRaw === "string" ? filterRaw : uncontrolledFilterRaw;
    const setResolvedFilterRaw = onFilterRawChange || setUncontrolledFilterRaw;

    const filterAccepted = useMemo(() => resolvedFilterRaw.replace(/[^A-Za-z_,]/g, ""), [resolvedFilterRaw]);
    const filterRejected = useMemo(() => {
        const rejected = new Set<string>();
        for (const ch of resolvedFilterRaw) {
            if (!/[A-Za-z_,]/.test(ch)) rejected.add(ch);
        }
        return Array.from(rejected);
    }, [resolvedFilterRaw]);

    const filterTokens = useMemo(() => {
        if (filterRejected.length > 0) return [];
        return filterAccepted
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => part.toLowerCase())
            .filter((part, index, arr) => arr.indexOf(part) === index);
    }, [filterAccepted, filterRejected.length]);

    const filteredItems = useMemo(() => {
        if (filterTokens.length === 0) return items;
        return items.filter((item) => {
            const tags = (getGenresThemes(item) || []).map((t) => t.toLowerCase());
            return filterTokens.some((token) => tags.includes(token));
        });
    }, [filterTokens, getGenresThemes, items]);

    return (
        <section
            ref={ref}
            className={cn("py-8 md:py-12 space-y-6", className)}
        >
            <div className="container px-4 md:px-6 flex flex-col gap-4">
                <div className="space-y-2">
                    <input
                        value={resolvedFilterRaw}
                        onChange={(e) => setResolvedFilterRaw(e.target.value)}
                        placeholder="e.g. dark_fantasy, coming_of_age"
                        className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 px-4 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
            >
                <div className="container px-4 md:px-6">{children(filteredItems)}</div>
            </motion.div>
        </section>
    );
}
