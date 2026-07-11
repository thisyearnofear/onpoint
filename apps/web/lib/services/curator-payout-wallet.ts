/**
 * Curator payout wallet — single client module for provision, migrate, and types.
 * Used by CuratorPayoutWalletPanel (onboard + /curator/wallet) and admin flows.
 */

export type PayoutWalletStatus = "unset" | "platform_custodial" | "curator_owned";

export type PayoutWalletProvider = "platform_custodial" | "magic" | "minipay" | "manual";

export interface WalletStatusResponse {
  slug: string;
  name: string;
  walletAddress: string | null;
  payoutWalletStatus: PayoutWalletStatus;
  payoutWalletProvider?: PayoutWalletProvider | null;
  payoutWalletProvisionedAt?: string | null;
  payoutWalletClaimedAt?: string | null;
  message?: string;
}

export function isValidPayoutAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

export function isValidCuratorWhatsapp(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value.replace(/\s/g, "").trim());
}

export async function fetchWalletStatus(
  apiBase: string,
  slug: string,
): Promise<WalletStatusResponse> {
  const res = await fetch(
    `${apiBase}/api/curator/${encodeURIComponent(slug)}/wallet/status`,
    { cache: "no-store" },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Failed to load wallet status (${res.status})`);
  }
  return data;
}

export async function provisionCustodialWallet(
  apiBase: string,
  slug: string,
  whatsapp: string,
): Promise<WalletStatusResponse> {
  const res = await fetch(
    `${apiBase}/api/curator/${encodeURIComponent(slug)}/wallet/provision`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ whatsapp }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Provision failed (${res.status})`);
  }
  return data;
}

export async function migrateCuratorWallet(
  apiBase: string,
  slug: string,
  whatsapp: string,
  newWalletAddress: string,
  provider: PayoutWalletProvider = "manual",
): Promise<WalletStatusResponse> {
  const res = await fetch(
    `${apiBase}/api/curator/${encodeURIComponent(slug)}/wallet/migrate`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ whatsapp, newWalletAddress, provider }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Migration failed (${res.status})`);
  }
  return data;
}

/** Map API response fields to panel state. */
export function walletFromApiResponse(data: WalletStatusResponse): {
  address: string;
  status: PayoutWalletStatus;
  message?: string;
} {
  return {
    address: data.walletAddress || "",
    status: data.payoutWalletStatus || "unset",
    message: data.message,
  };
}
