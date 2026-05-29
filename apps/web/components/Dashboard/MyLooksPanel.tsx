"use client";

import React from "react";
import { motion } from "framer-motion";
import { PolaroidGallery } from "../PolaroidGallery";

interface MyLooksPanelProps {
  onNavigate: (mode: string) => void;
}

export function MyLooksPanel({ onNavigate }: MyLooksPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <PolaroidGallery
        onNavigateToTryOn={() => onNavigate("try-on")}
        onNavigateToDesign={() => onNavigate("design")}
      />
    </motion.div>
  );
}
