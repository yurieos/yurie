"use client";

import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

type PromptSuggestionProps = ComponentPropsWithoutRef<"button"> & {
  highlight?: string;
  asChild?: boolean;
};

const PromptSuggestion = forwardRef<HTMLButtonElement, PromptSuggestionProps>(
  ({ className, highlight, asChild, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    // If there's a highlight and children is a string, highlight that portion
    let content = children;
    if (highlight && typeof children === "string") {
      const index = children.toLowerCase().indexOf(highlight.toLowerCase());
      if (index !== -1) {
        const before = children.slice(0, index);
        const match = children.slice(index, index + highlight.length);
        const after = children.slice(index + highlight.length);
        content = (
          <span>
            {before}
            <span className="text-primary font-medium">{match}</span>
            {after}
          </span>
        );
      }
    }

    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2",
          "text-sm font-medium",
          "bg-secondary/80 hover:bg-secondary",
          "border border-border/50 hover:border-border",
          "text-secondary-foreground/80 hover:text-secondary-foreground",
          "transition-all duration-200 ease-out",
          "cursor-pointer select-none",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          className
        )}
        {...props}
      >
        {content}
      </Comp>
    );
  }
);

PromptSuggestion.displayName = "PromptSuggestion";

export { PromptSuggestion };
export type { PromptSuggestionProps };

