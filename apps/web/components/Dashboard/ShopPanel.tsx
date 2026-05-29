"use client";

import React from "react";
import { motion } from "framer-motion";
import { InlineShop } from "../Shop/InlineShop";

interface ShopPanelProps {
  onTryOn: () => void;
}

export function ShopPanel({ onTryOn }: ShopPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <InlineShop onTryOn={onTryOn} />
    </motion.div>
  );
}
