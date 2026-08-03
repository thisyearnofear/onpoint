import { PravaReturn } from "@/components/Agent/PravaReturn";

export default async function PravaReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId = "" } = await searchParams;
  return <PravaReturn orderId={orderId} />;
}
