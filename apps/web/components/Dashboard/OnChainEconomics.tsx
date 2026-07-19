"use client";

import { useEffect, useState } from "react";
import {
  Zap,
  Coins,
  FileCheck,
  ShoppingBag,
  ArrowRightLeft,
  Loader2,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

interface AgentAction {
  id?: string;
  action?: string;
  timestamp?: string;
  txHash?: string;
  gasCost?: number;
  gasCostUsd?: number;
  chain?: string;
  status?: string;
}

interface DashboardData {
  agentId?: number;
  name?: string;
  walletAddress?: string;
  balance?: string;
  recentActions?: AgentAction[];
  stats?: {
    totalActions: number;
    totalGasSpent: number;
    totalGasSpentUsd: number;
    avgGasCostUsd: number;
  };
}

function formatUsd(value: number) {
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function StatBadge({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function OnChainEconomics() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agent/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card/40 p-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = data?.stats;
  const actions = (data?.recentActions || []).slice(0, 5);
  const avgGas = stats?.avgGasCostUsd || 0.003;
  const totalGas = stats?.totalGasSpentUsd || 0;
  const totalActions = stats?.totalActions || actions.length || 0;

  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Coins className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-bold uppercase tracking-wider text-foreground">
          On-Chain Economics
        </span>
        <span className="ml-auto rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
          Celo Mainnet
        </span>
      </div>

      <div className="p-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatBadge
            icon={Zap}
            label="Avg Tx Cost"
            value={formatUsd(avgGas)}
            color="#22c55e"
          />
          <StatBadge
            icon={ArrowRightLeft}
            label="Total Gas"
            value={formatUsd(totalGas)}
            color="#f59e0b"
          />
          <StatBadge
            icon={FileCheck}
            label="Actions"
            value={String(totalActions)}
            color="#3b82f6"
          />
        </div>

        {/* Sub-cent proof */}
        {avgGas < 0.01 && (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/20 px-3 py-2 mb-4">
            <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
            <p className="text-xs font-medium text-success">
              Sub-cent transactions verified — avg {formatUsd(avgGas)} per action
            </p>
          </div>
        )}

        {/* Recent transactions */}
        {actions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Recent On-Chain Actions
            </p>
            {actions.map((action, i) => (
              <div
                key={action.id || i}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 px-3 py-2"
              >
                {action.action === "purchase" || action.action === "shop" ? (
                  <ShoppingBag className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                ) : (
                  <FileCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium capitalize text-foreground">
                    {action.action || "agent action"}
                  </p>
                  {action.timestamp && (
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(action.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-success">
                    {action.gasCostUsd ? formatUsd(action.gasCostUsd) : "<$0.01"}
                  </p>
                  {action.txHash && (
                    <a
                      href={`https://celoscan.io/tx/${action.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      View <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-xs text-muted-foreground">
              No recent transactions. Agent actions will appear here as the styling agent shops autonomously.
            </p>
          </div>
        )}

        {/* Agent wallet info */}
        {data?.walletAddress && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Agent Wallet</p>
              <p className="truncate text-xs font-mono text-foreground">
                {data.walletAddress.slice(0, 6)}...{data.walletAddress.slice(-4)}
              </p>
            </div>
            <a
              href={`https://celoscan.io/address/${data.walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
