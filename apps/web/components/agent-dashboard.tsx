'use client';

import { useState, useEffect } from 'react';
import { getApiBase } from '../lib/utils/api-base';
import { Wallet, TrendingUp, Users, ArrowUpRight, Copy, CheckCircle, Clock } from 'lucide-react';

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
    agentId: string;
    walletAddress: string;
    status: string;
  };
  wallet?: {
    address: string;
    chain: string;
    balance: string;
  };
  referrals: {
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

  const { referrals } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Agent Identity */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-2xl font-bold mb-4">Agent Identity</h2>
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
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Wallet Balance</div>
                  <div className="text-3xl font-bold mt-1">
                    {parseFloat(data.wallet.balance).toFixed(2)} CELO
                  </div>
                </div>
                <Wallet className="w-12 h-12 text-primary/20" />
              </div>
            </div>
          )}
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
          <div className="flex items-center gap-3">
            <input
              type="text"
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/r/${data.agent.walletAddress}`}
              className="flex-1 bg-muted/50 px-4 py-3 rounded-lg font-mono text-sm"
            />
            <button
              onClick={copyReferralLink}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-semibold"
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
