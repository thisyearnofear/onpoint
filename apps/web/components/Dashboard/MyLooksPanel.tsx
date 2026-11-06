"use client";

import React from "react";
import { motion } from "framer-motion";
import { PolaroidGallery } from "../PolaroidGallery";

interface MyLooksPanelProps {
  onBackToTryOn: () => void;
}

export function MyLooksPanel({ onBackToTryOn }: MyLooksPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <PolaroidGallery onNavigateToTryOn={onBackToTryOn} />
    </motion.div>
  );
}
