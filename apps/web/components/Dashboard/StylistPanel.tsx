"use client";

import React from "react";
import { motion } from "framer-motion";
import { AIStylist } from "../AIStylist";

export function StylistPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <AIStylist />
    </motion.div>
  );
}
