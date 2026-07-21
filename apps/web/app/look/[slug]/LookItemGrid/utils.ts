export function getLowestPrice(
  sizes: Array<{ size: string; stock: number; price: number }> | undefined,
): number | null {
  if (!sizes || sizes.length === 0) return null;
  const prices = sizes
    .map((s) => Number(s.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return "";
  return `KES ${price.toLocaleString()}`;
}
