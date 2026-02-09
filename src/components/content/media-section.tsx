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
}

export function MediaSection<TItem>({ title, href, items, getGenresThemes, children, className }: MediaSectionProps<TItem>) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });
    const [filterRaw, setFilterRaw] = useState("");

    const filterAccepted = useMemo(() => filterRaw.replace(/[^A-Za-z_,]/g, ""), [filterRaw]);
    const filterRejected = useMemo(() => {
        const rejected = new Set<string>();
        for (const ch of filterRaw) {
            if (!/[A-Za-z_,]/.test(ch)) rejected.add(ch);
        }
        return Array.from(rejected);
    }, [filterRaw]);

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
                <div className="flex items-center justify-between gap-4">
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

                <div className="space-y-2">
                    <div className="text-xs font-medium text-neutral-400">Filter by genres/themes</div>
                    <input
                        value={filterRaw}
                        onChange={(e) => setFilterRaw(e.target.value)}
                        placeholder="e.g. dark_fantasy, coming_of_age"
                        className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 px-4 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                    />
                    <div className="space-y-1 text-xs text-neutral-500">
                        <div>Comma-separated. Allowed: letters (A–Z), underscores, commas. No spaces or numbers.</div>
                        <div>Accepted: {filterAccepted || "—"}</div>
                        <div className={cn(filterRejected.length > 0 ? "text-red-400" : "")}>
                            Rejected: {filterRejected.length > 0 ? filterRejected.join(" ") : "—"}
                        </div>
                    </div>
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
