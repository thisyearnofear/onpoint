/**
 * Simple analytics tracking for provider selection and conversion
 *
 * For production, consider using:
 * - PostHog, Mixpanel, or Amplitude for product analytics
 * - A custom event ingestion service
 */

interface AnalyticsEvent {
  event: string;
  properties: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
}

interface ProviderEventProperties {
  provider: "venice" | "gemini";
  goal?: "event" | "daily" | "critique";
  sessionDuration?: number;
  framesAnalyzed?: number;
  error?: string;
  paymentAmount?: string;
  walletAddress?: string;
  isByok?: boolean;
  [key: string]: unknown;
}

// In-memory event buffer (for client-side batching)
const eventBuffer: AnalyticsEvent[] = [];
const FLUSH_INTERVAL = 10000; // 10 seconds
const MAX_BUFFER_SIZE = 50;

// Generate a session ID for this browser session
const sessionId =
  typeof window !== "undefined"
    ? sessionStorage.getItem("analytics_session_id") || generateSessionId()
    : "server";

function generateSessionId(): string {
  const id = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  if (typeof window !== "undefined") {
    sessionStorage.setItem("analytics_session_id", id);
  }
  return id;
}

import posthog from "posthog-js";

// Initialize PostHog (no-op if key not set)
if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_POSTHOG_KEY &&
  !posthog.__loaded
) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: true,
    persistence: "localStorage",
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.debug();
    },
  });
}

/**
 * Track an analytics event
 */
export function trackEvent(
  event: string,
  properties: Record<string, unknown> = {},
): void {
  const analyticsEvent: AnalyticsEvent = {
    event,
    properties,
    timestamp: Date.now(),
    sessionId,
  };

  eventBuffer.push(analyticsEvent);

  // Send to PostHog
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.capture(event, properties);
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[Analytics]", event, properties);
  }

  if (eventBuffer.length >= MAX_BUFFER_SIZE) {
    flushEvents();
  }
}

/**
 * Track provider selection event
 */
export function trackProviderSelected(
  properties: ProviderEventProperties,
): void {
  trackEvent("provider_selected", properties);
}

/**
 * track session started event
 */
export function trackSessionStarted(properties: ProviderEventProperties): void {
  trackEvent("live_session_started", properties);
}

/**
 * Track session ended event
 */
export function trackSessionEnded(properties: ProviderEventProperties): void {
  trackEvent("live_session_ended", properties);
}

/**
 * Track payment initiated event
 */
export function trackPaymentInitiated(
  properties: ProviderEventProperties,
): void {
  trackEvent("payment_initiated", properties);
}

/**
 * Track payment completed event
 */
export function trackPaymentCompleted(
  properties: ProviderEventProperties,
): void {
  trackEvent("payment_completed", properties);
}

/**
 * Track payment failed event
 */
export function trackPaymentFailed(
  properties: ProviderEventProperties & { error: string },
): void {
  trackEvent("payment_failed", properties);
}

/**
 * Track error event
 */
export function trackError(
  event: string,
  error: string,
  properties: Record<string, unknown> = {},
): void {
  trackEvent(event, { ...properties, error });
}

/**
 * Track styling tip variant click
 * P0.4 - Try Variant buttons under styling tips
 */
export function trackStylingTipVariantClicked(properties: {
  tip_index: number;
  tip_text: string;
  has_custom_action: boolean;
  action_type?: string;
}): void {
  trackEvent("styling_tip_variant_clicked", properties);
}

/**
 * Track before/after compare toggle
 * P0.5 - Hold to compare original vs generated
 */
export function trackResultCompareToggled(properties: {
  duration_ms: number;
}): void {
  trackEvent("result_compare_toggled", properties);
}

/**
 * Flush events to the server
 */
export async function flushEvents(): Promise<void> {
  if (eventBuffer.length === 0) return;

  const events = [...eventBuffer];
  eventBuffer.length = 0;

  try {
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });
  } catch (error) {
    // Silently fail - analytics should not block user experience
    console.error("[Analytics] Failed to flush events:", error);
  }
}

// Set up periodic flush
if (typeof window !== "undefined") {
  setInterval(flushEvents, FLUSH_INTERVAL);

  // Flush on page unload
  window.addEventListener("beforeunload", () => {
    if (eventBuffer.length > 0) {
      // Use sendBeacon for reliability on page unload
      const data = JSON.stringify({ events: eventBuffer });
      navigator.sendBeacon("/api/analytics/events", data);
      eventBuffer.length = 0;
    }
  });
}

/**
 * A/B test configuration
 */
interface ABTest {
  id: string;
  variants: Record<string, unknown>;
  startDate: number;
  endDate?: number;
}

// Active A/B tests
const abTests: Record<string, ABTest> = {
  gemini_pricing: {
    id: "gemini_pricing",
    variants: {
      control: { price: 0.5 },
      lower_price: { price: 0.25 },
      higher_price: { price: 1.0 },
    },
    startDate: Date.now(),
  },
};

/**
 * Get variant for an A/B test
 * Uses deterministic assignment based on session ID
 */
export function getABTestVariant(testId: string): string | null {
  const test = abTests[testId];
  if (!test) return null;

  // Check if test is still active
  if (test.endDate && test.endDate < Date.now()) return null;

  // Deterministic variant assignment based on session ID hash
  const hash = hashCode(sessionId + testId);
  const variantKeys = Object.keys(test.variants);
  const variantIndex = Math.abs(hash) % variantKeys.length;

  return variantKeys[variantIndex] ?? null;
}

/**
 * Get A/B test value
 */
export function getABTestValue<T>(
  testId: string,
  key: string,
  defaultValue: T,
): T {
  const variant = getABTestVariant(testId);
  if (!variant) return defaultValue;

  const test = abTests[testId];
  const variantConfig = test?.variants[variant] as
    | Record<string, unknown>
    | undefined;

  return (variantConfig?.[key] as T) ?? defaultValue;
}

/**
 * Simple string hash function
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}
