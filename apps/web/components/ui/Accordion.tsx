"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface AccordionItemProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}

/**
 * AccordionItem — a single collapsible section.
 * Used inside Accordion or standalone.
 */
export function AccordionItem({
  title,
  subtitle,
  children,
  defaultOpen = false,
  icon,
}: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 py-4 text-left transition-colors hover:text-primary"
        aria-expanded={open}
      >
        {icon && <span className="flex-shrink-0 text-primary">{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground">{title}</div>
          {subtitle && (
            <div className="text-sm text-muted-foreground truncate">{subtitle}</div>
          )}
        </div>
        <ChevronDown
          className={`flex-shrink-0 h-5 w-5 text-muted-foreground transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-5 pt-1 text-muted-foreground leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Accordion — a group of collapsible sections for progressive disclosure.
 * Reduces cognitive load by hiding detail until the user asks for it.
 *
 * @example
 * <Accordion>
 *   <AccordionItem title="How try-on works" subtitle="AI rendering pipeline">
 *     <p>Details here...</p>
 *   </AccordionItem>
 * </Accordion>
 */
export function Accordion({ children, className = "" }: AccordionProps) {
  return <div className={className}>{children}</div>;
}
