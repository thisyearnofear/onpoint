import { WalletProviders } from "../../wallet-providers";

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <WalletProviders>{children}</WalletProviders>;
}
