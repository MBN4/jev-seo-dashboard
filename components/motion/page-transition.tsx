"use client";
import { motion, useReducedMotion } from "motion/react";
import { EASE } from "./primitives";

/** Re-runs a soft entrance whenever `routeKey` changes. */
export function PageTransition({ routeKey, children }: { routeKey: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div key={routeKey} initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.4, ease: EASE }}>
      {children}
    </motion.div>
  );
}
