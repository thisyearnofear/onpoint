"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import {
  Sparkles,
  Camera,
  ShoppingBag,
  MessageCircle,
  Target,
  Palette,
  Users,
  Share2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";

// ── Types ──

export type EmptyStateVariant =
  | "social-feed"
  | "cart"
  | "captures"
  | "suggestions"
  | "missions"
  | "recommendations"
  | "style-history"
  | "custom";

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: React.ElementType;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "ghost";
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  compact?: boolean;
  className?: string;
}

// ── Variant Configs ──

const VARIANT_CONFIGS: Record<
  EmptyStateVariant,
  {
    icon: React.ElementType;
    title: string;
    description: string;
    actionLabel?: string;
    color: string;
  }
> = {
  "social-feed": {
    icon: MessageCircle,
    title: "No activities yet",
    description:
      "Start creating outfits and trying them on to see social activities here!",
    actionLabel: "Start Styling",
    color: "text-indigo-400",
  },
  cart: {
    icon: ShoppingBag,
    title: "Your cart is empty",
    description:
      "Browse our catalog and add items to your cart to get started.",
    actionLabel: "Browse Catalog",
    color: "text-emerald-400",
  },
  captures: {
    icon: Camera,
    title: "No captures yet",
    description:
      "Take photos during your Live AR session to build your style gallery.",
    actionLabel: "Start Session",
    color: "text-blue-400",
  },
  suggestions: {
    icon: Sparkles,
    title: "No suggestions yet",
    description:
      "Your AI stylist will offer recommendations as you explore. Start a session to begin.",
    actionLabel: "Start Styling",
    color: "text-purple-400",
  },
  missions: {
    icon: Target,
    title: "No missions in progress",
    description:
      "Complete styling sessions and explore features to unlock missions and earn rewards.",
    actionLabel: "View Missions",
    color: "text-amber-400",
  },
  recommendations: {
    icon: Palette,
    title: "No recommendations yet",
    description:
      "Your style preferences will be learned as you interact with the AI stylist.",
    actionLabel: "Start Styling",
    color: "text-rose-400",
  },
  "style-history": {
    icon: RefreshCw,
    title: "No style history",
    description:
      "Your past styling sessions and analyses will appear here.",
    actionLabel: "Start Session",
    color: "text-cyan-400",
  },
  custom: {
    icon: Sparkles,
    title: "Nothing here yet",
    description: "Get started by taking an action.",
    color: "text-white/40",
  },
};

// ── Component ──

export function EmptyState({
  variant = "custom",
  title,
  description,
  icon,
  action,
  secondaryAction,
  compact = false,
  className = "",
}: EmptyStateProps) {
  const config = VARIANT_CONFIGS[variant];
  const Icon = icon || config.icon;
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;

  if (compact) {
    return (
      <div className={`flex flex-col items-center justify-center py-6 text-center ${className}`}>
        <Icon className={`w-8 h-8 mb-2 ${config.color} opacity-50`} />
        <p className="text-sm text-white/50">{displayTitle}</p>
        {action && (
          <Button
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className="mt-2 text-xs text-white/40 hover:text-white"
          >
            {action.label}
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 15 }}
        className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4`}
      >
        <Icon className={`w-8 h-8 ${config.color}`} />
      </motion.div>

      {/* Title */}
      <h3 className="text-lg font-bold text-white mb-2">{displayTitle}</h3>

      {/* Description */}
      <p className="text-sm text-white/50 max-w-xs leading-relaxed mb-6">
        {displayDescription}
      </p>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {action && (
          <Button
            onClick={action.onClick}
            variant={action.variant || "default"}
            className={
              action.variant === "outline"
                ? "border-white/10 text-white hover:bg-white/5"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }
          >
            {action.label}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}

        {secondaryAction && (
          <Button
            variant="ghost"
            onClick={secondaryAction.onClick}
            className="text-white/40 hover:text-white hover:bg-white/5"
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ── Preset Components ──

export function SocialFeedEmpty({ onStartStyling }: { onStartStyling: () => void }) {
  return (
    <EmptyState
      variant="social-feed"
      action={{ label: "Start Styling", onClick: onStartStyling }}
    />
  );
}

export function CartEmpty({ onBrowse }: { onBrowse: () => void }) {
  return (
    <EmptyState
      variant="cart"
      action={{ label: "Browse Catalog", onClick: onBrowse }}
    />
  );
}

export function CapturesEmpty({ onStartSession }: { onStartSession: () => void }) {
  return (
    <EmptyState
      variant="captures"
      action={{ label: "Start Session", onClick: onStartSession }}
    />
  );
}

export function SuggestionsEmpty({ onStartStyling }: { onStartStyling: () => void }) {
  return (
    <EmptyState
      variant="suggestions"
      action={{ label: "Start Styling", onClick: onStartStyling }}
    />
  );
}

export function MissionsEmpty({ onViewMissions }: { onViewMissions: () => void }) {
  return (
    <EmptyState
      variant="missions"
      action={{ label: "View Missions", onClick: onViewMissions }}
    />
  );
}