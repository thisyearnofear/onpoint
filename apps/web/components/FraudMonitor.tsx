"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Lock,
  Unlock,
  Fingerprint,
  RefreshCw,
  ChevronRight,
  Clock,
  Ban,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@repo/ui/button";

interface AgentHealth {
  agentId: string;
  userId: string;
  lastHeartbeat: number;
  status: "healthy" | "warning" | "frozen";
  consecutiveFailures: number;
  anomalyScore: number;
}

interface FraudAlert {
  id: string;
  userId: string;
  agentId: string;
  type: "velocity" | "amount" | "pattern" | "heartbeat" | "multisig_required";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  timestamp: number;
  resolved: boolean;
  metadata?: Record<string, unknown>;
}

const SEVERITY_COLORS = {
  low: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-400", dot: "bg-yellow-400" },
  high: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
  critical: { bg: "bg-error/10", text: "text-red-400", dot: "bg-red-400" },
} as const;

const ALERT_ICONS = {
  velocity: Activity,
  amount: AlertTriangle,
  pattern: Fingerprint,
  heartbeat: Clock,
  multisig_required: Ban,
} as const;

export function FraudMonitor() {
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/fraud?action=health&agentId=onpoint-stylist");
      if (res.ok) {
        const data = await res.json();
        setHealth(data.health);
        // Mock alerts for demo — in production these come from Redis
        setAlerts([
          {
            id: "alert_1",
            userId: data.health?.userId || "user",
            agentId: "onpoint-stylist",
            type: "heartbeat",
            severity: "low",
            description: "Regular heartbeat check passed",
            timestamp: Date.now() - 60000,
            resolved: true,
          },
          {
            id: "alert_2",
            userId: data.health?.userId || "user",
            agentId: "onpoint-stylist",
            type: "velocity",
            severity: data.health?.anomalyScore > 50 ? "high" : "low",
            description: data.health?.anomalyScore > 50
              ? "Unusual transaction velocity detected — multiple purchases in short window"
              : "Normal transaction velocity",
            timestamp: Date.now() - 300000,
            resolved: data.health?.anomalyScore <= 50,
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to fetch fraud status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleFreeze = async () => {
    setActionLoading("freeze");
    try {
      await fetch("/api/agent/fraud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "freeze",
          agentId: "onpoint-stylist",
          reason: "Manual freeze via dashboard",
        }),
      });
      await fetchStatus();
    } catch (err) {
      console.error("Failed to freeze agent:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnfreeze = async () => {
    setActionLoading("unfreeze");
    try {
      await fetch("/api/agent/fraud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unfreeze",
          agentId: "onpoint-stylist",
        }),
      });
      await fetchStatus();
    } catch (err) {
      console.error("Failed to unfreeze agent:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const activeAlerts = alerts.filter((a) => !a.resolved);
  const resolvedAlerts = alerts.filter((a) => a.resolved);

  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold uppercase tracking-wider">Fraud Monitor</span>
          </div>
          <div className="flex items-center gap-2">
            {health?.status === "frozen" && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-error/20 text-red-400 rounded-full uppercase tracking-wider animate-pulse">
                FROZEN
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStatus}
              disabled={loading}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Health Status */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {health?.status === "frozen" ? (
              <Lock className="w-4 h-4 text-red-400" />
            ) : health?.status === "warning" ? (
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-green-400" />
            )}
            <span className="text-sm font-medium">Agent Status</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              health?.status === "frozen" ? "bg-red-400" :
              health?.status === "warning" ? "bg-yellow-400" :
              "bg-green-400"
            } ${health?.status !== "frozen" ? "animate-pulse" : ""}`} />
            <span className={`text-xs font-medium ${
              health?.status === "frozen" ? "text-red-400" :
              health?.status === "warning" ? "text-yellow-400" :
              "text-green-400"
            }`}>
              {health?.status === "frozen" ? "Frozen" :
               health?.status === "warning" ? "Warning" :
               "Healthy"}
            </span>
          </div>
        </div>

        {/* Anomaly Score Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Anomaly Score</span>
            <span className={health && health.anomalyScore > 50 ? "text-red-400 font-bold" : ""}>
              {health?.anomalyScore ?? 0}/100
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                health && health.anomalyScore > 75 ? "bg-error" :
                health && health.anomalyScore > 50 ? "bg-yellow-500" :
                "bg-green-500"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${health?.anomalyScore ?? 0}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          {health && health.anomalyScore > 50 && (
            <p className="text-[10px] text-red-400/80 mt-1">
              {health.anomalyScore > 75
                ? "Auto-freeze threshold reached. Agent will be frozen automatically."
                : "Elevated anomaly score — review recent activity."}
            </p>
          )}
        </div>

        {/* Agent Info */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-muted/30 rounded-lg p-2">
            <div className="text-[10px] text-muted-foreground font-medium">Heartbeat</div>
            <div className="text-xs font-semibold mt-0.5">
              {health ? `${Math.floor((Date.now() - health.lastHeartbeat) / 60000)}m ago` : "—"}
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <div className="text-[10px] text-muted-foreground font-medium">Consecutive Failures</div>
            <div className="text-xs font-semibold mt-0.5">{health?.consecutiveFailures ?? 0}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          {health?.status !== "frozen" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFreeze}
              disabled={actionLoading === "freeze"}
              className="text-red-400 border-red-400/30 hover:bg-error/10 text-xs flex-1"
            >
              {actionLoading === "freeze" ? (
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Ban className="w-3 h-3 mr-1" />
              )}
              Freeze Agent
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnfreeze}
              disabled={actionLoading === "unfreeze"}
              className="text-green-400 border-green-400/30 hover:bg-green-500/10 text-xs flex-1"
            >
              {actionLoading === "unfreeze" ? (
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Unlock className="w-3 h-3 mr-1" />
              )}
              Unfreeze Agent
            </Button>
          )}
        </div>
      </div>

      {/* Alerts Section */}
      <details
        className="group border-t border-border/60"
        open={activeAlerts.length > 0}
      >
        <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-muted/30 transition-colors list-none">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Recent Alerts</span>
            {activeAlerts.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-error/20 text-red-400 rounded-full">
                {activeAlerts.length}
              </span>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
        </summary>
        <div className="px-4 pb-4 space-y-2 max-h-48 overflow-y-auto">
          <AnimatePresence>
            {[...activeAlerts, ...resolvedAlerts].length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No alerts yet. All clear.
              </p>
            )}
            {[...activeAlerts, ...resolvedAlerts].map((alert) => {
              const AlertIcon = ALERT_ICONS[alert.type];
              const severityColor = SEVERITY_COLORS[alert.severity];
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-start gap-3 p-2 rounded-lg ${
                    alert.resolved ? "opacity-50" : severityColor.bg
                  }`}
                >
                  <AlertIcon className={`w-3.5 h-3.5 mt-0.5 ${
                    alert.resolved ? "text-muted-foreground" : severityColor.text
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-medium truncate ${
                        alert.resolved ? "text-muted-foreground" : "text-foreground"
                      }`}>
                        {alert.description}
                      </p>
                      {alert.resolved && (
                        <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${alert.resolved ? "bg-muted-foreground" : severityColor.dot}`} />
                      <span className="text-[10px] text-muted-foreground">
                        {alert.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {Math.floor((Date.now() - alert.timestamp) / 60000)}m ago
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </details>
    </div>
  );
}
