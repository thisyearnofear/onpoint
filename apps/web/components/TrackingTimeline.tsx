"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import {
  Smartphone,
  Truck,
  PackageCheck,
  Bike,
  CheckCircle2,
  Package,
  Clock,
  AlertTriangle,
} from "lucide-react";

type FulfilmentStatus =
  | "pending_verification"
  | "awaiting_delivery_details"
  | "ready_for_pickup"
  | "rider_assigned"
  | "delivered"
  | string;

interface TimelineStep {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const ALL_STEPS: TimelineStep[] = [
  {
    key: "paid",
    label: "Payment confirmed",
    description: "Your payment was received successfully.",
    icon: <Smartphone className="h-4 w-4" />,
  },
  {
    key: "awaiting_delivery_details",
    label: "Delivery details submitted",
    description: "Curator received your address and contact info.",
    icon: <Package className="h-4 w-4" />,
  },
  {
    key: "ready_for_pickup",
    label: "Ready for pickup",
    description: "Your order has been prepared and is ready for courier pickup.",
    icon: <PackageCheck className="h-4 w-4" />,
  },
  {
    key: "rider_assigned",
    label: "Rider assigned",
    description: "A rider has been assigned and is heading to collect your order.",
    icon: <Bike className="h-4 w-4" />,
  },
  {
    key: "delivered",
    label: "Delivered",
    description: "Your order has been delivered successfully!",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
];

function getActiveSteps(
  fulfilmentStatus: FulfilmentStatus | null,
  hasDelivery: boolean,
): number {
  if (!fulfilmentStatus) return 0;

  // If payment is pending but we have no other info, show 0 active (paid not yet confirmed)
  if (fulfilmentStatus === "pending_verification" && !hasDelivery) return 0;

  const statusOrder = [
    "pending_verification",
    "awaiting_delivery_details",
    "ready_for_pickup",
    "rider_assigned",
    "delivered",
  ];

  // paid is step 0, so we add 1 to the index
  const idx = statusOrder.indexOf(fulfilmentStatus);
  if (idx === -1) return 0;
  return idx + 1; // +1 for "paid" step
}

export function TrackingTimeline({
  paymentStatus,
  fulfilmentStatus,
  hasDelivery,
  createdAt,
}: {
  paymentStatus?: string | null;
  fulfilmentStatus?: string | null;
  hasDelivery: boolean;
  createdAt?: string | null;
}) {
  const prevStatusRef = useRef<string | null>(null);
  const [justAdvancedIndex, setJustAdvancedIndex] = useState<number | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  const activeSteps = useMemo(
    () => getActiveSteps(fulfilmentStatus || null, hasDelivery),
    [fulfilmentStatus, hasDelivery],
  );

  const isDelivered = fulfilmentStatus === "delivered";
  const isPaymentPending =
    paymentStatus === "pending_verification" && !hasDelivery;

  // Detect when status advances and trigger animations
  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = fulfilmentStatus || null;
    if (prev !== null && prev !== curr) {
      const prevActive = getActiveSteps(prev, hasDelivery);
      const currActive = getActiveSteps(curr, hasDelivery);

      // Animate the step that just became active
      if (currActive > prevActive) {
        setJustAdvancedIndex(currActive);
        const timer = setTimeout(() => setJustAdvancedIndex(null), 1200);
        return () => clearTimeout(timer);
      }

      // Animate celebration on delivered
      if (curr === "delivered" && prev !== "delivered") {
        setShowCelebration(true);
      }
    }
    prevStatusRef.current = curr;
  }, [fulfilmentStatus, hasDelivery]);

  return (
    <div className="space-y-1">
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-8 bottom-2 w-0.5 bg-border" />

        <ul className="space-y-0">
          {ALL_STEPS.map((step, index) => {
            const isActive = index <= activeSteps;
            const isCurrent = index === activeSteps;
            const isPast = index < activeSteps;
            const isJustAdvanced = index === justAdvancedIndex;
            const willActivate = index === activeSteps && index > 0;

            return (
              <li
                key={step.key}
                className={`relative flex items-start gap-4 pb-8 last:pb-0 ${
                  willActivate && !isPast
                    ? "animate-step-enter"
                    : ""
                }`}
              >
                {/* Circle indicator */}
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    isDelivered && isPast
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : isJustAdvanced
                        ? "border-emerald-500 bg-emerald-500 text-white animate-step-activate shadow-lg shadow-emerald-500/30"
                        : isCurrent && isActive
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 ring-4 ring-emerald-500/20 animate-glow-pulse"
                          : isPast
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                            : "border-muted-foreground/30 bg-muted text-muted-foreground/50"
                  }`}
                >
                  {isDelivered && isPast ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    step.icon
                  )}
                </div>

                {/* Content */}
                <div
                  className={`min-w-0 flex-1 pt-1 ${
                    isJustAdvanced ? "animate-fade-slide-in" : ""
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      isActive ? "text-foreground" : "text-muted-foreground/50"
                    }`}
                  >
                    {step.label}
                    {isCurrent && !isDelivered && (
                      <span className="ml-2 inline-flex animate-fade-slide-in items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                        <Clock className="h-2.5 w-2.5" />
                        Current
                      </span>
                    )}
                  </p>
                  <p
                    className={`mt-0.5 text-xs ${
                      isActive
                        ? "text-muted-foreground"
                        : "text-muted-foreground/30"
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Payment pending notice */}
      {isPaymentPending && (
        <div className="mt-2 animate-fade-slide-in rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="text-xs font-semibold text-amber-700">
                Payment pending verification
              </p>
              <p className="mt-0.5 text-[11px] text-amber-600/80">
                Your payment is being verified. This page will update automatically once confirmed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delivered celebration */}
      {isDelivered && (
        <div
          className={`mt-2 rounded-lg border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-emerald-600/5 p-4 text-center ${
            showCelebration ? "animate-celebration-bounce" : "animate-fade-slide-in"
          }`}
        >
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-2 text-sm font-bold text-foreground">
            Delivered! 🎉
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your order has been delivered. Thank you for shopping with OnPoint!
          </p>
        </div>
      )}
    </div>
  );
}
