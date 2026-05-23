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
} from "lucide-react";

// --- Types (mirrored from subscription-service for the component) ---

type NotificationType =
  | "trial_ending"
  | "payment_succeeded"
  | "payment_failed"
  | "subscription_past_due"
  | "subscription_canceled"
  | "subscription_renewed"
  | "subscription_upgraded"
  | "usage_limit_reached";

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
    default:
      return { icon: Bell, color: "text-muted-foreground", bg: "bg-muted" };
  }
}

// --- Component ---

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, []);

  // Initial fetch + polling every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Mark single notification as read
  const handleMarkRead = async (id: string) => {
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

  // Open/close dropdown
  const handleToggle = () => {
    if (!open) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-full hover:bg-muted/60 transition-colors focus-ring"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 text-primary" />
        ) : (
          <Bell className="w-5 h-5 text-muted-foreground" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4.5 h-4.5 text-[10px] font-bold text-white bg-red-500 rounded-full min-w-[18px] min-h-[18px] leading-none shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
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
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground space-y-2">
                  <Bell className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p>No notifications yet</p>
                  <p className="text-xs text-muted-foreground/60">
                    Subscription events will appear here
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {notifications.map((notification) => {
                    const meta = notificationIcon(notification.type);
                    return (
                      <li
                        key={notification.id}
                        className={`relative transition-colors ${
                          notification.read
                            ? "bg-transparent"
                            : "bg-primary/5"
                        } hover:bg-muted/40 cursor-pointer`}
                        onClick={() => {
                          if (!notification.read) {
                            handleMarkRead(notification.id);
                          }
                          if (notification.actionUrl) {
                            window.location.href = notification.actionUrl;
                          }
                        }}
                      >
                        <div className="flex items-start gap-3 p-3">
                          {/* Icon */}
                          <div
                            className={`shrink-0 w-8 h-8 rounded-full ${meta.bg} flex items-center justify-center ${meta.color}`}
                          >
                            <meta.icon className="w-4 h-4" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`text-sm ${
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
                            <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                          </div>

                          {/* Unread dot */}
                          {!notification.read && (
                            <div className="shrink-0 mt-2 w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        {notification.actionUrl && (
                          <div className="px-3 pb-2 -mt-1">
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
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2 border-t border-border text-center">
                <button
                  onClick={() => setOpen(false)}
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
