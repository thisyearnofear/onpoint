/**
 * Provider latency persistence — stores rolling latency averages to localStorage.
 *
 * Each provider gets a circular buffer of recent latency samples.
 * The stored data is used to show historical averages in the UI.
 */

const STORAGE_KEY = "onpoint_provider_latency";
const MAX_SAMPLES_PER_PROVIDER = 20;

interface LatencyStore {
  [provider: string]: number[];
}

function readStore(): LatencyStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LatencyStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: LatencyStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Record a latency sample for a given provider.
 * Maintains a circular buffer of recent samples.
 */
export function recordLatency(provider: string, latencyMs: number): void {
  const store = readStore();
  if (!store[provider]) {
    store[provider] = [];
  }
  store[provider].push(latencyMs);
  if (store[provider].length > MAX_SAMPLES_PER_PROVIDER) {
    // Keep the most recent samples
    store[provider] = store[provider].slice(-MAX_SAMPLES_PER_PROVIDER);
  }
  writeStore(store);
}

/**
 * Get the historical average latency for a provider.
 * Returns 0 if no data is available.
 */
export function getProviderLatencyAverage(provider: string): number {
  const store = readStore();
  const samples = store[provider];
  if (!samples || samples.length === 0) return 0;
  const sum = samples.reduce((a, b) => a + b, 0);
  return Math.round(sum / samples.length);
}

/**
 * Get all historical averages across all providers.
 * Returns a map of provider name → average latency.
 */
export function getAllLatencyAverages(): Record<string, number> {
  const store = readStore();
  const result: Record<string, number> = {};
  for (const [provider, samples] of Object.entries(store)) {
    if (samples.length > 0) {
      const sum = samples.reduce((a, b) => a + b, 0);
      result[provider] = Math.round(sum / samples.length);
    }
  }
  return result;
}

/**
 * Clear all stored latency data.
 */
export function clearLatencyData(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore
  }
}
