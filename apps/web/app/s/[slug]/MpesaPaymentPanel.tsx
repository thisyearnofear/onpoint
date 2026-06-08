"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  Phone,
  User,
  FileText,
  Truck,
  Smartphone,
  AlertTriangle,
  RefreshCcw,
  Mail,
} from "lucide-react";
import { ReceiptPanel } from "../../../components/ReceiptPanel";

type SizeOption = {
  size: string;
  stock: number;
  price: number;
  printingAvailable?: boolean;
  printingPrice?: number;
};

type DeliveryDetails = {
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryNotes: string;
  pickupLocation: string;
  courierMethod: string;
  customerEmail: string;
};

export function MpesaPaymentPanel({
  curatorSlug,
  curatorName,
  listingId,
  itemName,
  sizes,
  mpesaNumber,
  checkoutType = "whatsapp",
  checkoutUrl,
}: {
  curatorSlug: string;
  curatorName: string;
  listingId: string;
  itemName: string;
  sizes: SizeOption[];
  mpesaNumber?: string;
  checkoutType?: "whatsapp" | "shopify" | "stripe";
  checkoutUrl?: string | null;
}) {
  const availableSizes = sizes.filter((size) => Number(size.stock) > 0);
  const firstSize = availableSizes[0] || sizes[0];
  const [open, setOpen] = useState(false);

  // Shared fields
  const [selectedSize, setSelectedSize] = useState(firstSize?.size || "");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentId, setPaymentId] = useState<string | null>(null);

  // STK Push state
  const [method, setMethod] = useState<"stk" | "manual">("stk");
  const [stkStatus, setStkStatus] = useState<
    "idle" | "sending" | "sent" | "waiting" | "paid" | "failed" | "timeout"
  >("idle");
  const [stkError, setStkError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual payment state
  const [mpesaCode, setMpesaCode] = useState("");
  const [manualStatus, setManualStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [manualError, setManualError] = useState<string | null>(null);

  // Receipt / delivery flow state
  const [showDelivery, setShowDelivery] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptMpesaCode, setReceiptMpesaCode] = useState<string | null>(null);
  const [paidAt, setPaidAt] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryDetails>({
    recipientName: "",
    recipientPhone: "",
    deliveryAddress: "",
    deliveryNotes: "",
    pickupLocation: "",
    courierMethod: "Bolt Send",
    customerEmail: "",
  });
  const [deliveryStatus, setDeliveryStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  const selected = useMemo(
    () => sizes.find((size) => size.size === selectedSize) || firstSize,
    [firstSize, selectedSize, sizes],
  );
  const amount = selected?.price || 0;

  // ─── STK Push flow ────────────────────────────────────────────

  const startStkPush = async () => {
    setStkStatus("sending");
    setStkError(null);

    try {
      const res = await fetch("/api/curator/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curatorSlug,
          listingId,
          itemName,
          size: selectedSize,
          amount,
          customerPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setPaymentId(data.paymentId || null);
      setStkStatus("sent");

      // Start polling for payment status
      startPolling(data.paymentId);
    } catch (err) {
      setStkError(err instanceof Error ? err.message : "Could not initiate payment");
      setStkStatus("idle");
    }
  };

  const startPolling = (pid: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 * 10s = 5 minutes timeout

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      attempts++;

      try {
        const checkRes = await fetch(`/api/curator/payments/status?id=${encodeURIComponent(pid)}&curatorSlug=${encodeURIComponent(curatorSlug)}`);

        if (checkRes.ok) {
          const checkData = await checkRes.json();

          if (checkData.status === "paid") {
            setStkStatus("paid");
            setPaymentId(pid);
            setReceiptMpesaCode(checkData.mpesaCode || null);
            setPaidAt(new Date().toISOString());
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setTimeout(() => setShowDelivery(true), 800);
            return;
          }
          if (checkData.status === "rejected") {
            setStkStatus("failed");
            setStkError(String(checkData.resultDesc || "Payment was rejected"));
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            return;
          }
        }
      } catch {
        // Silently continue polling
      }

      if (attempts >= maxAttempts) {
        setStkStatus("timeout");
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }, 10000); // Poll every 10 seconds
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // ─── Manual flow ──────────────────────────────────────────────

  const submitManualPayment = async () => {
    setManualStatus("saving");
    setManualError(null);

    try {
      const response = await fetch("/api/curator/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curatorSlug,
          listingId,
          itemName,
          size: selectedSize,
          amount,
          customerPhone,
          mpesaCode,
          status: "pending_verification",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setManualStatus("saved");
      setPaymentId(data.payment?.id || null);
      setReceiptMpesaCode(mpesaCode);
      setPaidAt(new Date().toISOString());
      setShowDelivery(true);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Could not submit payment");
      setManualStatus("error");
    }
  };

  // ─── Delivery flow ─────────────────────────────────────────────

  const submitDelivery = async () => {
    if (!paymentId) return;

    if (!delivery.recipientName.trim() || !delivery.recipientPhone.trim() || !delivery.deliveryAddress.trim()) {
      setDeliveryError("Recipient name, phone, and delivery address are required.");
      return;
    }

    setDeliveryStatus("saving");
    setDeliveryError(null);

    try {
      const response = await fetch("/api/curator/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          curatorSlug,
          recipientName: delivery.recipientName,
          recipientPhone: delivery.recipientPhone,
          deliveryAddress: delivery.deliveryAddress,
          deliveryNotes: delivery.deliveryNotes,
          pickupLocation: delivery.pickupLocation,
          courierMethod: delivery.courierMethod,
          customerEmail: delivery.customerEmail || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setDeliveryStatus("saved");
      setShowReceipt(true);
    } catch (err) {
      setDeliveryError(err instanceof Error ? err.message : "Could not submit delivery details");
      setDeliveryStatus("error");
    }
  };

  // ─── Reset ─────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setOpen(false);
    setShowDelivery(false);
    setShowReceipt(false);
    setPaymentId(null);
    setCheckoutRequestId(null);
    setStkStatus("idle");
    setStkError(null);
    setManualStatus("idle");
    setManualError(null);
    setDeliveryStatus("idle");
    setDeliveryError(null);
    setCustomerPhone("");
    setMpesaCode("");
    setReceiptMpesaCode(null);
    setPaidAt(null);
    setDelivery({
      recipientName: "",
      recipientPhone: "",
      deliveryAddress: "",
      deliveryNotes: "",
      pickupLocation: "",
      courierMethod: "Bolt Send",
      customerEmail: "",
    });
  }, []);

  const resetPayment = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setStkStatus("idle");
    setStkError(null);
    setManualStatus("idle");
    setManualError(null);
    setPaymentId(null);
    setCheckoutRequestId(null);
  }, []);

  if (!firstSize) return null;

  if (checkoutType === "shopify" || checkoutType === "stripe") {
    const label = checkoutType === "shopify" ? "Shopify" : "Stripe";
    return (
      <div className="rounded-lg border border-border bg-muted/25 p-3">
        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            <CreditCard className="h-4 w-4" />
            Checkout on {label}
          </a>
        ) : (
          <button
            disabled
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-bold text-muted-foreground"
          >
            <CreditCard className="h-4 w-4" />
            {label} checkout not configured
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/25 p-3">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          resetPayment();
        }}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        <CreditCard className="h-4 w-4" />
        Pay with M-Pesa
      </button>

      {open && !showDelivery && (
        <div className="mt-3 space-y-3">
          {/* Method toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setMethod("stk"); resetPayment(); }}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-bold transition-colors ${
                method === "stk"
                  ? "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/30"
                  : "bg-muted text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <Smartphone className="mr-1.5 inline h-3.5 w-3.5" />
              Auto-pay (STK)
            </button>
            <button
              type="button"
              onClick={() => { setMethod("manual"); resetPayment(); }}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-bold transition-colors ${
                method === "manual"
                  ? "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/30"
                  : "bg-muted text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <CreditCard className="mr-1.5 inline h-3.5 w-3.5" />
              Manual code
            </button>
          </div>

          {method === "stk" ? (
            /* ═══════════ STK Push flow ═══════════ */
            <div className="space-y-3">
              <div className="rounded-md bg-background p-3 text-xs leading-5 text-muted-foreground">
                <p className="font-semibold text-foreground">Auto-pay via M-Pesa</p>
                <p className="mt-1">
                  Enter your Safaricom number below. A push notification will appear on your phone —
                  enter your M-Pesa PIN to complete the payment.
                </p>
              </div>

              {stkStatus === "sent" || stkStatus === "waiting" ? (
                /* STK sent — waiting for customer to enter PIN */
                <div className="rounded-md bg-amber-500/10 p-4 text-center">
                  <Smartphone className="mx-auto h-8 w-8 text-amber-500" />
                  <p className="mt-2 text-sm font-bold text-foreground">Check your phone</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter your M-Pesa PIN on the Safaricom prompt to complete payment of <strong>KES {amount.toLocaleString("en-KE")}</strong>.
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs text-amber-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Waiting for confirmation...
                  </div>
                </div>
              ) : stkStatus === "paid" ? (
                /* STK succeeded */
                <div className="rounded-md bg-emerald-500/10 p-4 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                  <p className="mt-2 text-sm font-bold text-foreground">Payment received!</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    KES {amount.toLocaleString("en-KE")} confirmed.
                  </p>
                </div>
              ) : stkStatus === "failed" ? (
                <div className="rounded-md bg-red-500/10 p-3 text-center">
                  <AlertTriangle className="mx-auto h-6 w-6 text-red-500" />
                  <p className="mt-1 text-xs font-medium text-red-600">{stkError || "Payment failed"}</p>
                  <button
                    type="button"
                    onClick={startStkPush}
                    className="mt-2 inline-flex items-center gap-1 rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/20"
                  >
                    <RefreshCcw className="h-3 w-3" />
                    Try again
                  </button>
                </div>
              ) : stkStatus === "timeout" ? (
                <div className="rounded-md bg-amber-500/10 p-3 text-center">
                  <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
                  <p className="mt-1 text-xs font-medium text-amber-600">Payment request timed out</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    You can try the auto-pay again or use manual code entry below.
                  </p>
                  <div className="mt-2 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={startStkPush}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-500/20"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      Retry STK
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod("manual")}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60"
                    >
                      <CreditCard className="h-3 w-3" />
                      Enter code manually
                    </button>
                  </div>
                </div>
              ) : (
                /* Idle — show form */
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-xs font-medium">
                      Size
                      <select
                        value={selectedSize}
                        onChange={(event) => setSelectedSize(event.target.value)}
                        className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                      >
                        {availableSizes.map((size) => (
                          <option key={size.size} value={size.size}>
                            {size.size} - KES {Number(size.price).toLocaleString("en-KE")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium">
                      Safaricom number
                      <input
                        value={customerPhone}
                        onChange={(event) => setCustomerPhone(event.target.value)}
                        placeholder="2547XXXXXXXX"
                        className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                      />
                    </label>
                  </div>

                  {stkError && (
                    <p className="text-xs font-medium text-destructive">{stkError}</p>
                  )}

                  <button
                    type="button"
                    onClick={startStkPush}
                    disabled={stkStatus === "sending" || !customerPhone.trim()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {stkStatus === "sending" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Smartphone className="h-4 w-4" />
                    )}
                    Pay KES {amount.toLocaleString("en-KE")}
                  </button>
                </>
              )}
            </div>
          ) : (
            /* ═══════════ Manual flow ═══════════ */
            <div className="space-y-3">
              <div className="rounded-md bg-background p-3 text-xs leading-5 text-muted-foreground">
                <p className="font-semibold text-foreground">Manual M-Pesa confirmation</p>
                <p>
                  Send <span className="font-semibold text-foreground">KES {amount.toLocaleString("en-KE")}</span>
                  {mpesaNumber ? ` to ${mpesaNumber}` : ` to ${curatorName}'s M-Pesa number`}, then enter
                  your M-Pesa transaction code below.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-medium">
                  Size
                  <select
                    value={selectedSize}
                    onChange={(event) => setSelectedSize(event.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                  >
                    {availableSizes.map((size) => (
                      <option key={size.size} value={size.size}>
                        {size.size} - KES {Number(size.price).toLocaleString("en-KE")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium">
                  Phone
                  <input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="+254..."
                    className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs font-medium">
                M-Pesa transaction code
                <input
                  value={mpesaCode}
                  onChange={(event) => setMpesaCode(event.target.value.toUpperCase())}
                  placeholder="e.g. RF12ABC345"
                  className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                />
              </label>

              {manualError && <p className="text-xs font-medium text-destructive">{manualError}</p>}
              {manualStatus === "saved" && (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Payment submitted! Now add your delivery details below.
                </p>
              )}

              <button
                type="button"
                onClick={submitManualPayment}
                disabled={manualStatus === "saving"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-bold transition-colors hover:bg-background disabled:opacity-60"
              >
                {manualStatus === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Submit payment code
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ Delivery details form / Receipt ═══════════ */}
      {open && showDelivery && (
        <>
          {showReceipt ? (
            <ReceiptPanel
              payment={{
                id: paymentId,
                method,
                amount,
                currency: "KES",
                mpesaCode: receiptMpesaCode,
                itemName,
                size: selectedSize,
                paidAt,
              }}
              delivery={{
                recipientName: delivery.recipientName,
                recipientPhone: delivery.recipientPhone,
                deliveryAddress: delivery.deliveryAddress,
                deliveryNotes: delivery.deliveryNotes,
                pickupLocation: delivery.pickupLocation,
                courierMethod: delivery.courierMethod,
              }}
              curator={{
                name: curatorName,
                slug: curatorSlug,
                whatsapp: mpesaNumber,
              }}
              onReset={handleReset}
            />
          ) : (
            <div className="mt-3 space-y-3">
              <div className="rounded-md bg-emerald-500/10 p-3 text-xs leading-5">
                <p className="flex items-center gap-1.5 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Payment confirmed
                </p>
                <p className="mt-1 text-emerald-600">
                  Now tell {curatorName} where to send your item.
                </p>
              </div>

              {deliveryStatus === "idle" || deliveryStatus === "error" ? (
                <>
                  <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5 font-medium text-foreground">
                      <Truck className="h-3.5 w-3.5" />
                      Delivery via Bolt Send
                    </p>
                    <p className="mt-1">
                      Items are dispatched via Bolt Send courier. Provide your pickup location
                      and delivery address so {curatorName} can arrange the handoff.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <label className="text-xs font-medium">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Recipient name <span className="text-destructive">*</span>
                      </span>
                      <input
                        value={delivery.recipientName}
                        onChange={(e) => setDelivery((d) => ({ ...d, recipientName: e.target.value }))}
                        placeholder="Full name"
                        className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                      />
                    </label>

                    <label className="text-xs font-medium">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        Recipient phone <span className="text-destructive">*</span>
                      </span>
                      <input
                        value={delivery.recipientPhone}
                        onChange={(e) => setDelivery((d) => ({ ...d, recipientPhone: e.target.value }))}
                        placeholder="+254..."
                        className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                      />
                    </label>

                    <label className="text-xs font-medium">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Delivery address / pin <span className="text-destructive">*</span>
                      </span>
                      <textarea
                        value={delivery.deliveryAddress}
                        onChange={(e) => setDelivery((d) => ({ ...d, deliveryAddress: e.target.value }))}
                        placeholder="Estate, building, apartment number, or what3words pin"
                        rows={2}
                        className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm resize-none"
                      />
                    </label>

                    <label className="text-xs font-medium">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Pickup location / contact
                      </span>
                      <input
                        value={delivery.pickupLocation}
                        onChange={(e) => setDelivery((d) => ({ ...d, pickupLocation: e.target.value }))}
                        placeholder="Nearest town, shop, or landmark for pickup"
                        className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                      />
                    </label>

                    <label className="text-xs font-medium">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Delivery notes
                      </span>
                      <textarea
                        value={delivery.deliveryNotes}
                        onChange={(e) => setDelivery((d) => ({ ...d, deliveryNotes: e.target.value }))}
                        placeholder="Any special instructions for the rider..."
                        rows={2}
                        className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm resize-none"
                      />
                    </label>

                    <div className="rounded-md bg-muted/50 px-3 py-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Truck className="h-3.5 w-3.5" />
                        Courier: <span className="font-semibold text-foreground">Bolt Send</span>
                      </span>
                    </div>

                    <label className="text-xs font-medium">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        Email (optional — get a receipt)
                      </span>
                      <input
                        value={delivery.customerEmail}
                        onChange={(e) => setDelivery((d) => ({ ...d, customerEmail: e.target.value }))}
                        placeholder="you@example.com"
                        type="email"
                        className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                      />
                    </label>
                  </div>

                  {deliveryError && <p className="text-xs font-medium text-destructive">{deliveryError}</p>}

                  <button
                    type="button"
                    onClick={submitDelivery}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Submit delivery details
                  </button>
                </>
              ) : deliveryStatus === "saving" ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
