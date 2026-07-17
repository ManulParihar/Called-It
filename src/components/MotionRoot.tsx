"use client";

// One motion policy for the whole app: framer-motion respects the device's
// reduced-motion setting (transforms are dropped, opacity fades stay).

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
