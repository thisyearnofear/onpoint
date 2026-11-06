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

export const SUPPORTED_CURRENCIES = Object.keys(KES_TO);

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

// Viewer preference — saved to this device only (per the "local state says
// where it lives" convention; the reveal copy doesn't claim sync).
const PREF_KEY = "onpoint-currency";

export function getPreferredCurrency(locale?: string): string {
  try {
    const saved = typeof localStorage !== "undefined" && localStorage.getItem(PREF_KEY);
    if (saved && saved in KES_TO) return saved;
  } catch { /* private mode */ }
  return localCurrencyFor(locale);
}

export function setPreferredCurrency(currency: string) {
  try {
    if (currency in KES_TO) localStorage.setItem(PREF_KEY, currency);
  } catch { /* private mode */ }
}

export function formatKesAs(kesAmount: number, currency: string, locale?: string): string {
  const rate = KES_TO[currency] ?? 0.0077;
  return new Intl.NumberFormat(locale ?? "en-US", {
    style: "currency",
    currency: currency in KES_TO ? currency : "USD",
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(kesAmount * rate);
}

export function localPriceLabel(kesAmount: number, locale?: string): string {
  return `≈${formatKesAs(kesAmount, getPreferredCurrency(locale), locale)}`;
}
