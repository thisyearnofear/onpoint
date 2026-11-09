import { WalletProviders } from "../../wallet-providers";

/**
 * Storefront route needs wallet hooks for owner-only look tools:
 * look writes require a signature-verified session (challenge → sign →
 * verify), so the owner chrome signs with the connected wallet.
 * Public shoppers never touch this stack — it only activates inside
 * CuratorOwnerTools, which renders for the owner (localStorage) only.
 */
export default function StorefrontSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WalletProviders>{children}</WalletProviders>;
}
