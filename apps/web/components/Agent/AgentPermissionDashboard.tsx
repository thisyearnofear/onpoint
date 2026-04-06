"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@auth0/nextjs-auth0/client";
import {
  Shield,
  Check,
  X,
  LogIn,
  ExternalLink,
  Settings,
  Loader2,
  Key,
  Eye,
  EyeOff,
  Clock,
  Zap,
  AlertCircle,
  ChevronRight,
  Sparkles,
  ShoppingBag,
  Globe,
  Lock,
  RefreshCw,
  Activity,
} from "lucide-react";

interface Authorization {
  id: string;
  name: string;
  authorized: boolean;
  scopes: string[];
  lastUsed?: number;
  connection?: string;
}

interface AuthStatus {
  auth0Id: string;
  hasAuth0Session: boolean;
  scopes: string[];
  authorizations: Authorization[];
}

interface ActivityLog {
  id: string;
  action: string;
  retailer: string;
  timestamp: number;
  status: "success" | "pending" | "failed";
}

const EXPLAINER_STEPS = [
  {
    icon: Lock,
    title: "Credentials Isolated",
    description:
      "Your login credentials never touch the AI agent. They're stored securely in Auth0's Token Vault.",
  },
  {
    icon: Key,
    title: "Scoped Access",
    description:
      "The agent only gets specific permissions you approve—like browsing, but not purchasing.",
  },
  {
    icon: Eye,
    title: "Full Transparency",
    description:
      "Every action the agent takes is logged. You can revoke access anytime.",
  },
];

const AVAILABLE_RETAILERS = [
  { id: "zara", name: "Zara", logo: "Z", color: "from-black to-gray-800" },
  { id: "ssense", name: "SSENSE", logo: "S", color: "from-red-600 to-black" },
  {
    id: "farfetch",
    name: "FARFETCH",
    logo: "F",
    color: "from-amber-500 to-amber-700",
  },
  { id: "asos", name: "ASOS", logo: "A", color: "from-pink-500 to-rose-600" },
  { id: "hype", name: "END.", logo: "E", color: "from-slate-800 to-slate-900" },
];

export function AgentPermissionDashboard() {
  const { user, isLoading: authLoading } = useUser();
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);
  const [activeTab, setActiveTab] = useState<"permissions" | "activity">(
    "permissions",
  );
  const [showConnectWizard, setShowConnectWizard] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([
    {
      id: "1",
      action: "Browse catalog",
      retailer: "Zara",
      timestamp: Date.now() - 300000,
      status: "success",
    },
    {
      id: "2",
      action: "Check prices",
      retailer: "SSENSE",
      timestamp: Date.now() - 600000,
      status: "success",
    },
    {
      id: "3",
      action: "Search items",
      retailer: "FARFETCH",
      timestamp: Date.now() - 900000,
      status: "success",
    },
  ]);

  useEffect(() => {
    if (user) {
      fetchAuthStatus();
    }
  }, [user]);

  const fetchAuthStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth0/authorization");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setAuthStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (authLoading) {
    return (
      <div className="relative bg-zinc-900/90 border border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-emerald-500/5" />
        <div className="relative p-8 flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 animate-pulse" />
            <div className="h-4 w-32 bg-zinc-800/50 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <OnboardingView onComplete={() => {}} />;
  }

  if (isLoading) {
    return (
      <div className="relative bg-zinc-900/90 border border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-emerald-500/5" />
        <div className="relative p-8 flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
            <p className="text-zinc-400 text-sm">Loading your permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative bg-zinc-900/90 border border-red-900/30 rounded-3xl overflow-hidden backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent" />
        <div className="relative p-8 flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchAuthStatus}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const permissions = authStatus?.authorizations || [];
  const hasPermissions =
    permissions.length > 0 && permissions.some((p) => p.authorized);

  return (
    <div className="relative bg-zinc-900/90 border border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.03] via-transparent to-emerald-500/[0.03]" />

      {/* Animated background grid */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-emerald-500 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zinc-900">
                  <div className="w-full h-full rounded-full bg-emerald-400 animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Token Vault</h3>
                <p className="text-xs text-zinc-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Auth0 Protected
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowExplainer(!showExplainer)}
                className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"
                title="How it works"
              >
                <Sparkles className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab("permissions")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "permissions"
                  ? "bg-violet-500/20 text-violet-400"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              <Key className="w-4 h-4 inline mr-2" />
              Permissions
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "activity"
                  ? "bg-violet-500/20 text-violet-400"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              <Activity className="w-4 h-4 inline mr-2" />
              Activity
            </button>
          </div>
        </div>

        {/* Explainer Accordion */}
        <AnimatePresence>
          {showExplainer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-zinc-800/50 overflow-hidden"
            >
              <div className="p-6 space-y-4">
                {EXPLAINER_STEPS.map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                      <step.icon className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white text-sm">
                        {step.title}
                      </h4>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="p-6">
          {activeTab === "permissions" ? (
            <div className="space-y-4">
              {!hasPermissions ? (
                <EmptyState onConnect={() => setShowConnectWizard(true)} />
              ) : (
                permissions.map((perm) => (
                  <RetailerCard
                    key={perm.id}
                    permission={perm}
                    onRevoke={() => {}}
                  />
                ))
              )}

              {/* Connect More Button */}
              {hasPermissions && (
                <button
                  onClick={() => setShowConnectWizard(true)}
                  className="w-full p-4 rounded-xl border border-dashed border-zinc-700 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all group"
                >
                  <div className="flex items-center justify-center gap-2 text-zinc-500 group-hover:text-violet-400">
                    <Globe className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Connect more retailers
                    </span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              )}
            </div>
          ) : (
            <ActivityView logs={activityLog} />
          )}
        </div>

        {/* Agent Reasoning Footer */}
        <div className="p-4 bg-zinc-950/50 border-t border-zinc-800/50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-emerald-500/20 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                <span className="text-violet-400 font-medium">Agent: </span>
                {hasPermissions
                  ? "Monitoring your favorite retailers for price drops. I'll alert you before making any purchases."
                  : "Waiting for you to connect retailer accounts so I can start browsing on your behalf."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Connect Wizard Modal */}
      <AnimatePresence>
        {showConnectWizard && (
          <ConnectWizard
            onClose={() => setShowConnectWizard(false)}
            connected={permissions.map((p) => p.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function OnboardingView({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);

  return (
    <div className="relative bg-zinc-900/90 border border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.05] via-transparent to-emerald-500/[0.05]" />

      <div className="relative p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-emerald-500 mx-auto mb-6 flex items-center justify-center">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">
            Enable Agent Shopping
          </h3>
          <p className="text-zinc-400 text-sm max-w-sm mx-auto">
            Let your AI agent browse and purchase from your favorite
            retailers—securely.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="space-y-4 mb-8">
          {EXPLAINER_STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/30"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <s.icon className="w-5 h-5 text-violet-400" />
              </div>
              <div className="text-left">
                <h4 className="font-medium text-white text-sm">{s.title}</h4>
                <p className="text-zinc-500 text-xs">{s.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <a
          href="/auth/login"
          className="flex items-center justify-center gap-3 w-full p-4 bg-gradient-to-r from-violet-600 to-emerald-600 hover:from-violet-500 hover:to-emerald-500 text-white rounded-xl font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <LogIn className="w-5 h-5" />
          Connect with Auth0
        </a>

        <p className="text-center text-zinc-600 text-xs mt-4">
          Takes 30 seconds • No account required
        </p>
      </div>
    </div>
  );
}

function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 mx-auto mb-4 flex items-center justify-center">
        <ShoppingBag className="w-8 h-8 text-zinc-600" />
      </div>
      <h4 className="text-white font-medium mb-2">No retailers connected</h4>
      <p className="text-zinc-500 text-sm mb-6">
        Connect your favorite shopping accounts so the agent can browse for you.
      </p>
      <button
        onClick={onConnect}
        className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-all"
      >
        <Globe className="w-4 h-4" />
        Connect Retailers
      </button>
    </div>
  );
}

function RetailerCard({
  permission,
  onRevoke,
}: {
  permission: Authorization;
  onRevoke: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-2xl border transition-all ${
        permission.authorized
          ? "bg-zinc-800/30 border-zinc-700/50"
          : "bg-zinc-900/50 border-dashed border-zinc-800"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold ${
              permission.id === "zara"
                ? "from-black to-gray-800"
                : permission.id === "ssense"
                  ? "from-red-600 to-black"
                  : permission.id === "farfetch"
                    ? "from-amber-500 to-amber-700"
                    : "from-zinc-700 to-zinc-900"
            }`}
          >
            {permission.name[0]}
          </div>
          <div>
            <h4 className="font-medium text-white">{permission.name}</h4>
            <div className="flex gap-1.5 mt-1">
              {permission.scopes.map((scope) => (
                <span
                  key={scope}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700/50"
                >
                  {scope.replace(":", " ")}
                </span>
              ))}
            </div>
          </div>
        </div>

        {permission.authorized ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-emerald-500">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium">Active</span>
            </div>
            {showConfirm ? (
              <div className="flex gap-1">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={onRevoke}
                  className="px-3 py-1.5 text-xs text-white bg-red-600 hover:bg-red-500 rounded-lg"
                >
                  Confirm
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
              >
                Revoke
              </button>
            )}
          </div>
        ) : (
          <button className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-colors">
            Connect
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {permission.lastUsed && (
        <div className="mt-3 pt-3 border-t border-zinc-800/50 flex items-center gap-2 text-xs text-zinc-500">
          <Clock className="w-3 h-3" />
          Last used {formatTimeAgo(permission.lastUsed)}
        </div>
      )}
    </motion.div>
  );
}

function ActivityView({ logs }: { logs: ActivityLog[] }) {
  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-center gap-4 p-3 rounded-xl bg-zinc-800/30"
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              log.status === "success"
                ? "bg-emerald-500/10"
                : log.status === "pending"
                  ? "bg-amber-500/10"
                  : "bg-red-500/10"
            }`}
          >
            {log.status === "success" ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : log.status === "pending" ? (
              <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
            ) : (
              <X className="w-4 h-4 text-red-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-white text-sm">{log.action}</p>
            <p className="text-zinc-500 text-xs">{log.retailer}</p>
          </div>
          <span className="text-zinc-600 text-xs">
            {formatTimeAgo(log.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ConnectWizard({
  onClose,
  connected,
}: {
  onClose: () => void;
  connected: string[];
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const available = AVAILABLE_RETAILERS.filter(
    (r) => !connected.includes(r.id),
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-zinc-900 rounded-3xl border border-zinc-800 max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-800">
          <h3 className="text-xl font-bold text-white">Connect Retailers</h3>
          <p className="text-zinc-500 text-sm mt-1">
            Select stores for your agent to access
          </p>
        </div>

        <div className="p-6 space-y-3 max-h-64 overflow-y-auto">
          {available.map((retailer) => (
            <button
              key={retailer.id}
              onClick={() =>
                setSelected((prev) =>
                  prev.includes(retailer.id)
                    ? prev.filter((id) => id !== retailer.id)
                    : [...prev, retailer.id],
                )
              }
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                selected.includes(retailer.id)
                  ? "bg-violet-500/10 border-violet-500/50"
                  : "bg-zinc-800/30 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${retailer.color} flex items-center justify-center text-white font-bold text-xl`}
              >
                {retailer.logo}
              </div>
              <span className="font-medium text-white">{retailer.name}</span>
              <div className="ml-auto">
                {selected.includes(retailer.id) && (
                  <Check className="w-5 h-5 text-violet-400" />
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="p-6 border-t border-zinc-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-zinc-400 hover:text-white bg-zinc-800 rounded-xl font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={selected.length === 0}
            className="flex-1 px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
          >
            Connect ({selected.length})
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function formatTimeAgo(timestamp: number) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
