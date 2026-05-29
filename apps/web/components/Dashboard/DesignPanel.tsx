"use client";

import React from "react";
import { motion } from "framer-motion";
import { DesignStudio } from "../DesignStudio";

interface DesignPanelProps {
  onNavigate: (mode: string) => void;
}

export function DesignPanel({ onNavigate }: DesignPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="mb-4">
        <button
          onClick={() => onNavigate("my-looks")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to My Looks
        </button>
      </div>
      <DesignStudio />
    </motion.div>
  );
}
