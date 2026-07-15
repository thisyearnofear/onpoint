'use client';

import { useState, useEffect } from 'react';
import { getApiBase } from '../lib/utils/api-base';
import { Wallet, TrendingUp, Users, ArrowUpRight, Copy, CheckCircle, Clock, FileCheck, ShieldCheck } from 'lucide-react';

interface ReferralActivity {
  referralCode: string;
  commissionCusd: string;
  status: 'pending' | 'paid';
  orderAmountCusd: string;
  curatorSlug: string;
  createdAt: string;
  payoutTxHash?: string;
}

interface DashboardData {
  agent: {
    name: string;
    agentId: string | number;
    walletAddress: string;
    status: string;
  };
  wallet?: {
    address: string;
    chains: string[];
    balances: {
      celo: string;
      cUSD: string;
    };
    gasHealthy: boolean;
  };
  referrals?: {
    totalReferrals: number;
    totalCommissionCusd: string;
    pendingCommissionCusd: string;
    paidCommissionCusd: string;
    recentActivity: ReferralActivity[];
  };
  activity?: {
    totalReceipts: number;
    onChainReceipts: number;
  };
  identity?: {
    erc8004?: {
      registrationTxHash?: string | null;
    };
    self?: {
      status?: string;
    };
  };
}

export function AgentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getApiBase()}/api/agent/dashboard`);
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/r/${data?.agent.walletAddress}`;
    navigator.clipboard.writeText(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  const referrals = data.referrals ?? {
    totalReferrals: 0,
    totalCommissionCusd: '0.00',
    pendingCommissionCusd: '0.00',
    paidCommissionCusd: '0.00',
    recentActivity: [],
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-2 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Public agent proof</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">OnPoint AI Stylist</h1>
            <p className="mt-2 text-sm text-muted-foreground">Live identity, payment readiness, and referral activity on Celo.</p>
          </div>
          <a href="https://beonpoint.netlify.app/.well-known/agent.json" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80">
            View agent manifest <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-xl font-bold mb-5">Identity</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Name</div>
              <div className="font-semibold">{data.agent.name}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="font-semibold capitalize">{data.agent.status}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Agent ID</div>
              <div className="font-mono text-sm">{data.agent.agentId}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Wallet Address</div>
              <div className="font-mono text-xs truncate">
                {data.agent.walletAddress}
              </div>
            </div>
          </div>
          {data.wallet && (
            <div className="mt-6 grid gap-4 border-t pt-6 sm:grid-cols-3">
              <div className="flex items-center justify-between rounded-lg bg-muted/40 p-4">
                <div>
                  <div className="text-sm text-muted-foreground">CELO for gas</div>
                  <div className="mt-1 text-2xl font-bold">{Number(data.wallet.balances.celo || 0).toFixed(2)}</div>
                </div>
                <Wallet className="h-8 w-8 text-primary/30" />
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <div className="text-sm text-muted-foreground">cUSD balance</div>
                <div className="mt-1 text-2xl font-bold">{Number(data.wallet.balances.cUSD || 0).toFixed(2)}</div>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <div className="text-sm text-muted-foreground">Gas status</div>
                <div className="mt-1 flex items-center gap-2 font-bold">
                  <span className={`h-2 w-2 rounded-full ${data.wallet.gasHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {data.wallet.gasHealthy ? 'Ready' : 'Needs funding'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground"><span>On-chain receipts</span><FileCheck className="h-5 w-5" /></div>
            <p className="mt-3 text-3xl font-black">{data.activity?.onChainReceipts ?? 0}</p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground"><span>ERC-8004</span><ShieldCheck className="h-5 w-5" /></div>
            <p className="mt-3 text-base font-bold">{data.identity?.erc8004?.registrationTxHash ? 'Registered' : 'Pending proof'}</p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Self verification</span><CheckCircle className="h-5 w-5" /></div>
            <p className="mt-3 text-base font-bold capitalize">{data.identity?.self?.status || 'Unregistered'}</p>
          </div>
        </div>

        {/* Referral Stats */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-2xl font-bold mb-4">Referral Earnings</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Total Referrals</div>
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold">{referrals.totalReferrals}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Total Commission</div>
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold">${referrals.totalCommissionCusd}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Pending</div>
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold">${referrals.pendingCommissionCusd}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Paid</div>
                <CheckCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold">${referrals.paidCommissionCusd}</div>
            </div>
          </div>
        </div>

        {/* Referral Link */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-2xl font-bold mb-4">Your Referral Link</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/r/${data.agent.walletAddress}`}
              className="w-full min-w-0 flex-1 bg-muted/50 px-4 py-3 rounded-lg font-mono text-sm sm:w-auto"
            />
            <button
              onClick={copyReferralLink}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Share this link to earn 2.5% commission on every purchase made through it
          </p>
        </div>

        {/* Recent Referral Activity */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-2xl font-bold mb-4">Recent Referral Activity</h2>
          {referrals.recentActivity.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No referral activity yet. Share your referral link to start earning!
            </div>
          ) : (
            <div className="space-y-3">
              {referrals.recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold">{activity.curatorSlug}</div>
                    <div className="text-sm text-muted-foreground">
                      Order: ${activity.orderAmountCusd} • Commission: ${activity.commissionCusd}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      activity.status === 'paid' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {activity.status}
                    </div>
                    {activity.payoutTxHash && (
                      <a
                        href={`https://celoscan.io/tx/${activity.payoutTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        View TX <ArrowUpRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
