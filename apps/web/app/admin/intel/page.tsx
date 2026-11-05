import type { Metadata } from "next";
import { MarketIntelPanel } from "../../../components/Dashboard/MarketIntelPanel";

export const metadata: Metadata = {
  title: "Market Intel | OnPoint Admin",
};

export default function AdminIntelPage() {
  return <MarketIntelPanel />;
}
