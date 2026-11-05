import { WalletProviders } from "../../wallet-providers";

export default function CuratorOnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WalletProviders>{children}</WalletProviders>;
}
