import { cn } from "@/lib/utils";
import { Spotlight } from "./spotlight";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
}

export function GlassCard({
    children,
    className,
    hoverEffect = false,
    ...props
}: GlassCardProps) {
    const CardContent = (
        <div
            className={cn(
                "glass rounded-2xl p-0 relative z-20", // added relative z-20 to ensure content is above spotlight if needed
                hoverEffect && "glass-hover",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );

    if (hoverEffect) {
        return (
            <Spotlight className={cn("rounded-2xl", className)}>
                {CardContent}
            </Spotlight>
        );
    }

    return CardContent;
}
