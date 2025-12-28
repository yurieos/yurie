import type { Transition, Variants } from "motion/react";

// ============================================
// Base Transition Presets
// ============================================

export const TRANSITION_SUGGESTIONS: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 40,
  mass: 0.8,
};

export const TRANSITION_FADE: Transition = {
  duration: 0.2,
  ease: "easeOut",
};

// ============================================
// Unified Transition Presets
// ============================================

export const TRANSITIONS = {
  spring: TRANSITION_SUGGESTIONS,
  fade: TRANSITION_FADE,
  smooth: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  bounce: { type: "spring", stiffness: 400, damping: 25 } as Transition,
  snappy: { type: "spring", stiffness: 500, damping: 30 } as Transition,
  gentle: { type: "spring", stiffness: 300, damping: 35 } as Transition,
} as const;

// ============================================
// Reusable Animation Variants
// ============================================

export const VARIANTS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  fadeUp: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },
  fadeDown: {
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
} as const satisfies Record<string, Variants>;

// ============================================
// Stagger Helpers for Lists
// ============================================

export function createStaggerVariants(staggerMs: number = 50): {
  container: Variants;
  item: Variants;
} {
  return {
    container: {
      animate: {
        transition: { staggerChildren: staggerMs / 1000 },
      },
    },
    item: VARIANTS.fadeUp,
  };
}

// Pre-built stagger configs for common use cases
export const STAGGER = {
  fast: createStaggerVariants(30),
  default: createStaggerVariants(50),
  slow: createStaggerVariants(80),
} as const;

