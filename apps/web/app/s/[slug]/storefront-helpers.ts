import type { CuratorStorefrontResponse } from "@onpoint/shared-types";

type SizeOption = CuratorStorefrontResponse["listings"][number]["sizes"][number];

export function formatKitType(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatMoney(value: number) {
  const locale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE || "en-KE";
  const currency = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || "KES";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function getLowestPrice(sizes: SizeOption[]) {
  const prices = sizes
    .map((item) => Number(item.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  return prices.length ? Math.min(...prices) : null;
}

export function getTotalStock(sizes: SizeOption[]) {
  return sizes.reduce((total, item) => total + Number(item.stock || 0), 0);
}

export function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
