"use client";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type HTMLMotionProps } from "motion/react";
import { useEffect, useRef } from "react";

/** Shared easing: quick start, soft landing. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Content entrance: fade + small rise. */
export function FadeIn({ delay = 0, y = 8, ...props }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      {...props}
    />
  );
}

/** Parent that reveals its <StaggerItem> children one after another. */
export function Stagger({ gap = 0.05, delay = 0, ...props }: HTMLMotionProps<"div"> & { gap?: number; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
      {...props}
    />
  );
}

export function StaggerItem(props: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 10, scale: 0.985 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE } } }}
      {...props}
    />
  );
}

/** Animates a number from 0 (or its previous value) to `value` when it scrolls into view. */
export function CountUp({ value, decimals = 0, duration = 0.9, className }: { value: number; decimals?: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration, ease: EASE });
    return () => c.stop();
  }, [inView, value, duration, mv, reduce]);
  return (
    <motion.span ref={ref} className={className} aria-label={String(value)}>
      {text}
    </motion.span>
  );
}

/** Horizontal bar that grows to `pct` (0–100). */
export function GrowBar({ pct, className, delay = 0 }: { pct: number; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { width: 0 }}
      animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    />
  );
}
