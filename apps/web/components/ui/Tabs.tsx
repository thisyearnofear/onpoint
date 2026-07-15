"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  defaultTab?: string;
  className?: string;
}

/**
 * Tabs — segmented content switcher for progressive disclosure.
 * Shows one panel at a time, reducing visual overwhelm.
 *
 * @example
 * <Tabs items={[
 *   { id: "free", label: "Free", content: <FreeContent /> },
 *   { id: "paid", label: "Paid", content: <PaidContent /> },
 * ]} />
 */
export function Tabs({ items, defaultTab, className = "" }: TabsProps) {
  const [active, setActive] = useState(defaultTab || items[0]?.id);
  const activeItem = items.find((i) => i.id === active);

  return (
    <div className={className}>
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl mb-6 sticky top-16 z-10 backdrop-blur-sm">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              active === item.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeItem?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
