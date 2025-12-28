import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface IconBadgeProps {
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8", 
  lg: "w-10 h-10",
} as const;

/**
 * A themed icon container with gradient background
 * Used for consistent icon presentation across the app
 */
export function IconBadge({ 
  children, 
  size = "lg",
  className 
}: IconBadgeProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0",
        sizeClasses[size],
        className
      )}
    >
      {children}
    </div>
  );
}

