"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@repo/ui/button";
import { Check, ExternalLink, Lock, Unlock, AlertCircle } from "lucide-react";
import type { SupportedProvider } from "../lib/services/token-vault";

interface ConnectedAccount {
  connection: SupportedProvider;
  connected: boolean;
  scopes?: string[];
  connectedAt?: number;
}

const PROVIDER_CONFIG: Record<SupportedProvider, {
  name: string;
  description: string;
  icon: string;
  defaultScopes: string[];
  color: string;
}> = {
  'custom-shop': {
    name: 'Shop',
    description: 'Shopify shopping history & preferences',
    icon: '🛍️',
    defaultScopes: ['openid', 'profile', 'email'],
    color: 'from-indigo-500 to-indigo-600'
  },
  'custom-klarna': {
    name: 'Klarna',
    description: 'Payment history & wishlists',
    icon: '💳',
    defaultScopes: ['openid', 'profile'],
    color: 'from-pink-500 to-pink-600'
  },
  'paypal': {
    name: 'PayPal',
    description: 'Payment & transaction history',
    icon: '💰',
    defaultScopes: ['openid', 'profile', 'email'],
    color: 'from-blue-600 to-blue-700'
  },
  'amazon': {
    name: 'Amazon',
    description: 'Shopping history & wishlists',
    icon: '📦',
    defaultScopes: ['profile', 'postal_code'],
    color: 'from-orange-500 to-orange-600'
  },
  'google-oauth2': {
    name: 'Google',
    description: 'Calendar & Gmail for receipts',
    icon: '📅',
    defaultScopes: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/gmail.readonly'
    ],
    color: 'from-blue-500 to-blue-600'
  },
  'discord': {
    name: 'Discord',
    description: 'Share with fashion communities',
    icon: '💬',
    defaultScopes: ['identify', 'email'],
    color: 'from-indigo-600 to-indigo-700'
  }
};

export function ConnectedAccounts() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<SupportedProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConnectedAccounts();
  }, []);

  const loadConnectedAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/connected-accounts');
      
      if (!response.ok) {
        throw new Error('Failed to load connected accounts');
      }
      
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err: any) {
      console.error('Failed to load accounts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (connection: SupportedProvider) => {
    try {
      setConnecting(connection);
      setError(null);
      
      const config = PROVIDER_CONFIG[connection];
      const scopes = config.defaultScopes.join(' ');
      
      // Redirect to Auth0 OAuth flow
      const redirectUri = `${window.location.origin}/api/auth/callback`;
      const authUrl = `/api/auth/connect?connection=${connection}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      window.location.href = authUrl;
    } catch (err: any) {
      console.error('Failed to connect:', err);
      setError(err.message);
      setConnecting(null);
    }
  };

  const handleRevoke = async (connection: SupportedProvider) => {
    if (!confirm(`Revoke access to ${PROVIDER_CONFIG[connection].name}?`)) {
      return;
    }
    
    try {
      const response = await fetch('/api/auth/revoke-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection })
      });
      
      if (!response.ok) {
        throw new Error('Failed to revoke connection');
      }
      
      await loadConnectedAccounts();
    } catch (err: any) {
      console.error('Failed to revoke:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-foreground">Connected Accounts</h3>
        <p className="text-sm text-muted-foreground">
          Connect external accounts to let your AI agent act on your behalf. Your credentials are stored securely in Auth0 Token Vault.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-destructive font-medium">Error</p>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {Object.entries(PROVIDER_CONFIG).map(([connection, config]) => {
          const account = accounts.find(a => a.connection === connection);
          const isConnected = account?.connected || false;
          const isConnecting = connecting === connection;

          return (
            <div
              key={connection}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
            >
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center text-2xl`}>
                {config.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-foreground">{config.name}</h4>
                  {isConnected && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-medium">
                      <Check className="w-3 h-3" />
                      Connected
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{config.description}</p>
                {isConnected && account?.scopes && account.scopes.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Scopes: {account.scopes.slice(0, 2).join(', ')}
                    {account.scopes.length > 2 && ` +${account.scopes.length - 2} more`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(connection as SupportedProvider)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Unlock className="w-4 h-4 mr-1" />
                      Revoke
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleConnect(connection as SupportedProvider)}
                    disabled={isConnecting}
                    className="bg-gradient-to-r from-primary to-accent"
                  >
                    {isConnecting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-1" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-start gap-2">
          <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">How it works</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Click "Connect" to authorize access via OAuth</li>
              <li>Your credentials are stored securely in Auth0 Token Vault</li>
              <li>Your AI agent requests tokens only when needed</li>
              <li>You can revoke access anytime</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
