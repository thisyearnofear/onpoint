"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellRing,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  CreditCard,
  Crown,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Flame,
  Users,
} from "lucide-react";
import { useAnalysisHistory } from "../lib/stores/analysis-history-store";

// --- Types (mirrored from subscription-service for the component) ---

type NotificationType =
  | "trial_ending"
  | "payment_succeeded"
  | "payment_failed"
  | "subscription_past_due"
  | "subscription_canceled"
  | "subscription_renewed"
  | "subscription_upgraded"
  | "usage_limit_reached"
  | "score_milestone"
  | "streak_reminder"
  | "persona_unlock";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

// --- Helpers ---

/** Safely trigger device vibration. No-op on unsupported devices or desktop. */
function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration API not available
  }
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function notificationIcon(type: NotificationType) {
  switch (type) {
    case "trial_ending":
      return { icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" };
    case "payment_succeeded":
      return { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" };
    case "payment_failed":
      return { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" };
    case "subscription_past_due":
      return { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10" };
    case "subscription_canceled":
      return { icon: X, color: "text-red-500", bg: "bg-red-500/10" };
    case "subscription_renewed":
      return { icon: Crown, color: "text-primary", bg: "bg-primary/10" };
    case "subscription_upgraded":
      return { icon: Sparkles, color: "text-accent", bg: "bg-accent/10" };
    case "usage_limit_reached":
      return { icon: CreditCard, color: "text-amber-500", bg: "bg-amber-500/10" };
    case "score_milestone":
      return { icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" };
    case "streak_reminder":
      return { icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10" };
    case "persona_unlock":
      return { icon: Users, color: "text-violet-500", bg: "bg-violet-500/10" };
    default:
      return { icon: Bell, color: "text-muted-foreground", bg: "bg-muted" };
  }
}

// --- Notification List (shared between desktop dropdown and mobile overlay) ---

function NotificationList({
  notifications,
  loading,
  onMarkRead,
  onAction,
}: {
  notifications: Notification[];
  loading: boolean;
  onMarkRead: (id: string) => void;
  onAction: (url: string) => void;
}) {
  if (loading && notifications.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground space-y-2">
        <Bell className="w-10 h-10 mx-auto text-muted-foreground/40" />
        <p>No notifications yet</p>
        <p className="text-xs text-muted-foreground/60">
          Style milestones and subscription events will appear here
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/50">
      {notifications.map((notification) => {
        const meta = notificationIcon(notification.type);
        return (
          <li
            key={notification.id}
            className={`relative transition-colors ${
              notification.read ? "bg-transparent" : "bg-primary/5"
            } hover:bg-muted/40 cursor-pointer active:bg-muted/60`}
            onClick={() => {
              if (!notification.read) {
                onMarkRead(notification.id);
              }
              if (notification.actionUrl) {
                onAction(notification.actionUrl);
              }
            }}
          >
            <div className="flex items-start gap-3 p-3 md:p-3">
              {/* Icon */}
              <div
                className={`shrink-0 w-9 h-9 md:w-8 md:h-8 rounded-full ${meta.bg} flex items-center justify-center ${meta.color}`}
              >
                <meta.icon className="w-5 h-5 md:w-4 md:h-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm md:text-sm ${
                      notification.read
                        ? "text-muted-foreground"
                        : "text-foreground font-medium"
                    }`}
                  >
                    {notification.title}
                  </p>
                  <span className="shrink-0 text-[10px] text-muted-foreground/60 mt-0.5">
                    {timeAgo(notification.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/80 mt-1 md:mt-0.5 line-clamp-2 leading-relaxed">
                  {notification.message}
                </p>
              </div>

              {/* Unread dot */}
              {!notification.read && (
                <div className="shrink-0 mt-2 w-2 h-2 rounded-full bg-primary" />
              )}
            </div>
            {notification.actionUrl && (
              <div className="px-3 pb-2 md:pb-2 -mt-1">
                <span className="text-xs text-primary/80 flex items-center gap-0.5 hover:text-primary transition-colors">
                  View details
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// --- Client-side product notification generator ---

function generateProductNotifications(
  sessions: { id: string; score: number; persona?: string | null; createdAt: string }[],
): Notification[] {
  if (sessions.length === 0) return [];
  const dismissed = new Set(
    (typeof window !== "undefined" ? sessionStorage.getItem("dismissed_product_notifs") : "")?.split(",").filter(Boolean) || [],
  );
  const result: Notification[] = [];

  const bestScore = Math.max(...sessions.map((s) => s.score));
  if (bestScore >= 9 && !dismissed.has("score_milestone")) {
    result.push({
      id: "product:score_milestone",
      type: "score_milestone",
      title: `You hit ${bestScore}/10!`,
      message: "Your best look yet. Keep pushing the boundaries.",
      timestamp: Date.now() - 3600000,
      read: false,
      actionUrl: "/lab?tab=my-looks",
    });
  }

  const weekAgo = Date.now() - 7 * 86400000;
  const thisWeek = sessions.filter((s) => new Date(s.createdAt).getTime() > weekAgo);
  if (thisWeek.length >= 3 && !dismissed.has("streak_reminder")) {
    result.push({
      id: "product:streak_reminder",
      type: "streak_reminder",
      title: `${thisWeek.length} looks this week`,
      message: thisWeek.length >= 5
        ? "You're on fire! Keep the streak going."
        : "One more to hit your weekly streak.",
      timestamp: Date.now() - 7200000,
      read: false,
      actionUrl: "/lab",
    });
  }

  const personaCounts: Record<string, number> = {};
  for (const s of sessions) {
    if (s.persona) personaCounts[s.persona] = (personaCounts[s.persona] || 0) + 1;
  }
  for (const [persona, count] of Object.entries(personaCounts)) {
    if (count >= 5 && !dismissed.has(`persona_unlock:${persona}`)) {
      const others = Object.keys(personaCounts).filter((p) => p !== persona);
      const suggestion = others.length > 0 ? ` Try ${others[0]} for a fresh perspective?` : "";
      result.push({
        id: `product:persona_unlock:${persona}`,
        type: "persona_unlock",
        title: `${count} looks with ${persona}`,
        message: `You're a ${persona} regular.${suggestion}`,
        timestamp: Date.now() - 5400000,
        read: false,
        actionUrl: `/lab?tab=try-on`,
      });
    }
  }

  return result;
}

// --- Component ---

export function NotificationBell({ direction = "down" }: { direction?: "up" | "down" }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sessions = useAnalysisHistory((state) => state.sessions);

  const isMobileOverlay = direction === "up";
  const prevUnreadRef = useRef(0);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      const serverNotifications: Notification[] = data.notifications || [];
      const productNotifications = generateProductNotifications(sessions);
      const merged = [...productNotifications, ...serverNotifications];
      const newCount = merged.filter((n) => !n.read).length;
      const prevCount = prevUnreadRef.current;
      setNotifications(merged);
      setUnreadCount(newCount);

      // Vibrate on new notification arrival (mobile only)
      if (isMobileOverlay && newCount > prevCount && prevCount !== 0) {
        vibrate(50); // Short tap
      }

      prevUnreadRef.current = newCount;
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, [isMobileOverlay, sessions]);

  // Initial fetch + polling every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Prevent body scroll when mobile overlay is open
  useEffect(() => {
    if (isMobileOverlay && open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isMobileOverlay, open]);

  // Click outside to close (desktop dropdown only)
  useEffect(() => {
    if (!open || isMobileOverlay) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, isMobileOverlay]);

  // Mark single notification as read
  const handleMarkRead = async (id: string) => {
    if (id.startsWith("product:")) {
      const dismissed = sessionStorage.getItem("dismissed_product_notifs") || "";
      const key = id.replace("product:", "");
      const keys = dismissed ? dismissed.split(",") : [];
      if (!keys.includes(key)) {
        sessionStorage.setItem("dismissed_product_notifs", [...keys, key].join(","));
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      return;
    }

    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Best-effort
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Best-effort
    }
  };

  // Open/close
  const handleToggle = () => {
    if (!open) {
      // Vibrate on open (mobile only — user gesture guaranteed)
      if (isMobileOverlay) {
        vibrate([30, 50, 30]); // Gentle triple tap
      }
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
    setOpen((prev) => !prev);
  };

  const handleClose = () => setOpen(false);

  // --- Render Bell Button (shared) ---
  const bellButton = (
    <button
      onClick={handleToggle}
      className={`relative p-2 rounded-full hover:bg-muted/60 transition-colors focus-ring ${
        isMobileOverlay ? "" : ""
      }`}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
    >
      {unreadCount > 0 ? (
        <BellRing className="w-5 h-5 text-primary" />
      ) : (
        <Bell className="w-5 h-5 text-muted-foreground" />
      )}
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-[18px] h-[18px] text-[10px] font-bold text-white bg-red-500 rounded-full leading-none shadow-sm">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );

  // --- Mobile Full-Screen Overlay ---
  if (isMobileOverlay) {
    return (
      <>
        {bellButton}

        <AnimatePresence>
          {open && (
            <motion.div
              key="mobile-overlay"
              className="fixed inset-0 z-[100] flex flex-col md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Backdrop */}
              <motion.div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleClose}
              />

              {/* Panel — slides up from bottom */}
              <motion.div
                className="relative mt-auto bg-background rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300, mass: 0.8 }}
              >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <BellRing className="w-5 h-5 text-primary" />
                    Notifications
                    {unreadCount > 0 && (
                      <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs font-medium text-primary hover:text-primary/80 transition-colors px-2 py-1"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={handleClose}
                      className="p-1.5 rounded-full hover:bg-muted transition-colors -mr-1"
                      aria-label="Close notifications"
                    >
                      <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto overscroll-contain pb-6">
                  <NotificationList
                    notifications={notifications}
                    loading={loading}
                    onMarkRead={handleMarkRead}
                    onAction={(url) => {
                      handleClose();
                      window.location.href = url;
                    }}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // --- Desktop Dropdown ---
  return (
    <div className="relative" ref={dropdownRef}>
      {bellButton}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl shadow-black/20 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <BellRing className="w-4 h-4 text-primary" />
                Notifications
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Body */}
            <div className="max-h-80 overflow-y-auto overscroll-contain">
              <NotificationList
                notifications={notifications}
                loading={loading}
                onMarkRead={handleMarkRead}
                onAction={(url) => {
                  window.location.href = url;
                }}
              />
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2 border-t border-border text-center">
                <button
                  onClick={handleClose}
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
