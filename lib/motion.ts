import type { Transition } from "motion/react";

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

