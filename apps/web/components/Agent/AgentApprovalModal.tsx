"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Check,
  X,
  AlertTriangle,
  Coins,
  ShoppingBag,
  Sparkles,
  Clock,
} from "lucide-react";
import { Button } from "@repo/ui/button";

export type ActionType =
  | "tip"
  | "purchase"
  | "mint"
  | "premium"
  | "agent_to_agent";

export interface ApprovalRequest {
  id: string;
  agentId: string;
  actionType: ActionType;
  amount: string;
  description: string;
  recipient?: string;
  status: "pending" | "approved" | "rejected" | "expired";
  createdAt: number;
  expiresAt: number;
}

interface AgentApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => void;
  request: ApprovalRequest | null;
  spendingLimit?: {
    daily: string;
    remaining: string;
  };
}

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  purchase: ShoppingBag,
  mint: Sparkles,
  tip: Coins,
  premium: Shield,
  agent_to_agent: Coins,
};

const ACTION_LABELS: Record<ActionType, string> = {
  purchase: "Purchase Request",
  mint: "NFT Mint Request",
  tip: "Tip Request",
  premium: "Premium Service",
  agent_to_agent: "Agent Transfer",
};

export function AgentApprovalModal({
  isOpen,
  onClose,
  onApprove,
  onReject,
  request,
  spendingLimit,
}: AgentApprovalModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!request) return null;

  const Icon = ACTION_ICONS[request.actionType] || Shield;
  const label = ACTION_LABELS[request.actionType] || "Action Request";

  // Calculate time remaining
  const timeRemaining = Math.max(0, request.expiresAt - Date.now());
  const minutesRemaining = Math.floor(timeRemaining / 60000);
  const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(request.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = () => {
    onReject(request.id);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-slate-900 rounded-3xl border border-white/10 max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/30 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold">{label}</h3>
                  <p className="text-slate-400 text-sm">
                    Agent requests your approval
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Action Details */}
              <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Action</span>
                  <span className="text-white font-medium">
                    {request.description}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount</span>
                  <span className="text-amber-400 font-bold">
                    {request.amount}
                  </span>
                </div>
                {request.recipient && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">To</span>
                    <span className="text-white font-mono text-sm">
                      {request.recipient.slice(0, 6)}...
                      {request.recipient.slice(-4)}
                    </span>
                  </div>
                )}
              </div>

              {/* Time Remaining */}
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Clock className="w-4 h-4" />
                <span>
                  Expires in {minutesRemaining}:
                  {secondsRemaining.toString().padStart(2, "0")}
                </span>
              </div>

              {/* Spending Limit Info */}
              {spendingLimit && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>
                    Daily limit: {spendingLimit.remaining} /{" "}
                    {spendingLimit.daily} remaining
                  </span>
                </div>
              )}

              {/* Security Notice */}
              <div className="flex items-start gap-2 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-emerald-300 text-xs">
                  This action will be recorded on-chain. You can revoke
                  permissions at any time from your agent settings.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isProcessing}
                className="flex-1 border-white/20 text-slate-300 hover:bg-white/10"
              >
                <X className="w-4 h-4 mr-2" />
                Deny
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isProcessing}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Approve
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Hook for managing approval state
// ============================================

export function useAgentApproval() {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>(
    [],
  );
  const [currentApproval, setCurrentApproval] =
    useState<ApprovalRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const requestApproval = async (params: {
    actionType: ActionType;
    amount: string;
    description: string;
    recipient?: string;
  }): Promise<string | null> => {
    // Call the approval API
    const response = await fetch("/api/agent/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error("Failed to create approval request");
    }

    const data = await response.json();
    const request: ApprovalRequest = data.request;

    // Show modal for user approval
    setCurrentApproval(request);
    setIsModalOpen(true);

    // Poll for approval status
    return new Promise((resolve) => {
      const pollInterval = setInterval(async () => {
        const statusResponse = await fetch(
          `/api/agent/approval?id=${request.id}`,
        );
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.request.status === "approved") {
            clearInterval(pollInterval);
            setIsModalOpen(false);
            setCurrentApproval(null);
            resolve(request.id);
          } else if (
            statusData.request.status === "rejected" ||
            statusData.request.status === "expired"
          ) {
            clearInterval(pollInterval);
            setIsModalOpen(false);
            setCurrentApproval(null);
            resolve(null);
          }
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(
        () => {
          clearInterval(pollInterval);
          setIsModalOpen(false);
          setCurrentApproval(null);
          resolve(null);
        },
        5 * 60 * 1000,
      );
    });
  };

  const approveRequest = async (requestId: string) => {
    const response = await fetch("/api/agent/approval", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: requestId, action: "approve" }),
    });

    if (!response.ok) {
      throw new Error("Failed to approve request");
    }
  };

  const rejectRequest = async (requestId: string) => {
    const response = await fetch("/api/agent/approval", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: requestId, action: "reject" }),
    });

    if (!response.ok) {
      throw new Error("Failed to reject request");
    }
  };

  return {
    pendingApprovals,
    currentApproval,
    isModalOpen,
    setIsModalOpen,
    requestApproval,
    approveRequest,
    rejectRequest,
  };
}
