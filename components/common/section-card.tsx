"use client";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/motion/primitives";

/** The standard elevated panel used across every page; rises in when scrolled into view. */
export function SectionCard({ title, description, actions, children, className, bodyClassName, id }: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      id={id}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn("surface", className)}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </motion.section>
  );
}
