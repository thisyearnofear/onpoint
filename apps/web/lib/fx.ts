// Approximate display-only FX for the price-reveal pattern.
// Prices are KES-denominated internally; conversion is indicative, never
// a checkout amount. Rates are refreshed manually — labeled "≈" in UI.
const KES_TO: Record<string, number> = {
  USD: 0.0077,
  EUR: 0.0071,
  GBP: 0.0061,
  NGN: 12.1,
  ZAR: 0.14,
  KES: 1,
};

const REGION_TO_CURRENCY: Record<string, string> = {
  US: "USD", GB: "GBP", IE: "EUR", FR: "EUR", DE: "EUR", IT: "EUR",
  ES: "EUR", NL: "EUR", BE: "EUR", PT: "EUR", AT: "EUR", FI: "EUR",
  NG: "NGN", ZA: "ZAR", KE: "KES",
};

export function localCurrencyFor(locale?: string): string {
  try {
    const region = new Intl.Locale(locale ?? "en-US").maximize().region ?? "US";
    return REGION_TO_CURRENCY[region] ?? "USD";
  } catch {
    return "USD";
  }
}

export function localPriceLabel(kesAmount: number, locale?: string): string {
  const currency = localCurrencyFor(locale);
  const converted = kesAmount * (KES_TO[currency] ?? 0.0077);
  const formatted = new Intl.NumberFormat(locale ?? "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(converted);
  return `≈${formatted}`;
}
