"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { MediaCard } from "./media-card";

interface MediaGridProps {
    items: Array<{
        id: string | number;
        title: string;
        image: string;
        year?: string;
        type?: string;
    }>;
    className?: string;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function MediaGrid({ items, className }: MediaGridProps) {
    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6", className)}
        >
            {items.map((item) => (
                <motion.div key={item.id} variants={itemVariants}>
                    <MediaCard {...item} />
                </motion.div>
            ))}
        </motion.div>
    );
}
