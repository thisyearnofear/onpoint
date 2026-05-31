"use client";

import { useMemo } from "react";
import {
  CheckCircle2,
  CreditCard,
  MapPin,
  Package,
  Phone,
  User,
  FileText,
  Truck,
  Smartphone,
  MessageCircle,
  ArrowLeft,
  Calendar,
  Hash,
  Receipt,
  Printer,
  ExternalLink,
} from "lucide-react";

interface ReceiptPayment {
  id: string | null;
  method: "stk" | "manual";
  amount: number;
  currency: string;
  mpesaCode?: string | null;
  itemName: string;
  size: string;
  paidAt?: string | null;
}

interface ReceiptDelivery {
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryNotes: string;
  pickupLocation: string;
  courierMethod: string;
}

interface ReceiptCurator {
  name: string;
  slug: string;
  whatsapp?: string | null;
}

interface ReceiptProps {
  payment: ReceiptPayment;
  delivery: ReceiptDelivery;
  curator: ReceiptCurator;
  onReset?: () => void;
  /** If true, hides the WhatsApp message and "Shop more" button (for admin view) */
  readonly?: boolean;
  /** Optional title override (defaults to "Order confirmed!") */
  title?: string;
}

function formatDate(iso?: string | null): string {
  if (!iso) {
    return new Date().toLocaleDateString("en-KE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ReceiptPanel({
  payment,
  delivery,
  curator,
  onReset,
  readonly,
  title = "Order confirmed!",
}: ReceiptProps) {
  const orderNumber = useMemo(() => {
    if (payment.id) {
      return `ONP-${payment.id.slice(-8).toUpperCase()}`;
    }
    return `ONP-${Date.now().toString(36).toUpperCase()}`;
  }, [payment.id]);

  const whatsappLink = curator.whatsapp
    ? `https://wa.me/${curator.whatsapp.replace(/^\+/, "")}?text=${encodeURIComponent(
        `Hi ${curator.name}, I just completed payment (${orderNumber}) for ${payment.itemName}. Looking forward to the delivery!`,
      )}`
    : null;

  const methodLabel = payment.method === "stk" ? "Auto-pay (STK)" : "Manual code";

  return (
    <>
      {/* ─── Print styles ─── */}
      <style>{`
        @media print {
          /* Hide everything outside the receipt */
          body * {
            visibility: hidden;
          }
          .receipt-root, .receipt-root * {
            visibility: visible;
          }
          .receipt-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
            padding: 0.5in;
            background: white !important;
          }

          /* Clean up receipt cards for print */
          .receipt-root .receipt-card {
            border: 1px solid #ddd !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: white !important;
            page-break-inside: avoid;
          }
          .receipt-root .receipt-banner {
            background: white !important;
            border: 1px solid #ddd !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 1rem !important;
          }
          .receipt-root .receipt-banner * {
            color: #000 !important;
          }
          .receipt-root .receipt-banner .receipt-icon-wrap {
            background: #e8f5e9 !important;
          }
          .receipt-root .receipt-banner .receipt-icon-wrap * {
            color: #2e7d32 !important;
          }

          /* Hide interactive elements */
          .receipt-print-btn,
          .receipt-whatsapp-btn,
          .receipt-shop-btn,
          .receipt-reset-btn {
            display: none !important;
          }

          /* Typography for print */
          .receipt-root {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            color: #000 !important;
          }
          .receipt-root .receipt-heading {
            font-size: 18px !important;
            font-weight: 700 !important;
            color: #000 !important;
          }
          .receipt-root .receipt-label {
            color: #666 !important;
          }
          .receipt-root .receipt-amount {
            font-weight: 700 !important;
            color: #000 !important;
          }
          .receipt-root .receipt-divider {
            border-color: #ddd !important;
          }
          .receipt-root .receipt-step {
            color: #000 !important;
          }
          .receipt-root .receipt-step-num {
            background: #e8f5e9 !important;
            color: #2e7d32 !important;
          }
          .receipt-root .receipt-notes {
            color: #666 !important;
            font-style: italic !important;
          }

          /* Order number badge */
          .receipt-root .receipt-order-badge {
            border: 1px solid #ddd !important;
            background: #f5f5f5 !important;
          }
          .receipt-root .receipt-order-badge * {
            color: #000 !important;
          }

          /* Ensure code blocks print */
          .receipt-root code {
            border: 1px solid #ddd !important;
            background: #f5f5f5 !important;
            color: #000 !important;
          }
        }
      `}</style>

      <div className="receipt-root space-y-3">
        {/* Success banner */}
        <div className="receipt-banner receipt-card rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-700/10 border border-emerald-500/30 p-4 sm:p-5 text-center">
          <div className="receipt-icon-wrap mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <h3 className="receipt-heading mt-3 text-base font-bold text-foreground">
            {title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(payment.paidAt)}
          </p>
          <p className="receipt-order-badge mt-1 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs font-mono text-muted-foreground">
            <Hash className="h-3 w-3" />
            {orderNumber}
          </p>
        </div>

        {/* Print button — hidden during print */}
        <button
          type="button"
          onClick={() => window.print()}
          className="receipt-print-btn inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted sm:hidden"
        >
          <Printer className="h-3.5 w-3.5" />
          Print / Save as PDF
        </button>

        {/* Receipt card */}
        <div className="receipt-card rounded-xl border border-border bg-card overflow-hidden">
          {/* Receipt header */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Payment receipt
            </span>
          </div>

          {/* Line items */}
          <div className="receipt-divider divide-y divide-border/50 px-4 py-2 text-sm">
            <Row label="Item" value={payment.itemName} />
            <Row label="Size" value={payment.size} />
            <Row
              label="Total paid"
              value={formatMoney(payment.amount, payment.currency)}
              highlight
            />
            <Row
              label="Payment"
              value={
                <span className="inline-flex items-center gap-1">
                  {payment.method === "stk" ? (
                    <Smartphone className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <CreditCard className="h-3 w-3 text-emerald-500" />
                  )}
                  {methodLabel}
                </span>
              }
            />
            {payment.mpesaCode && (
              <Row
                label="M-Pesa code"
                value={
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {payment.mpesaCode}
                  </code>
                }
              />
            )}
          </div>
        </div>

        {/* Delivery details card */}
        <div className="receipt-card rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Delivery details
            </span>
          </div>

          <div className="receipt-divider divide-y divide-border/50 px-4 py-2 text-sm">
            <Row
              label="Recipient"
              value={
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  {delivery.recipientName}
                </span>
              }
            />
            <Row
              label="Phone"
              value={
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  {delivery.recipientPhone}
                </span>
              }
            />
            <Row
              label="Address"
              value={
                <span className="inline-flex items-start gap-1">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  {delivery.deliveryAddress}
                </span>
              }
            />
            {delivery.pickupLocation && (
              <Row
                label="Pickup"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Package className="h-3 w-3 text-muted-foreground" />
                    {delivery.pickupLocation}
                  </span>
                }
              />
            )}
            <Row
              label="Courier"
              value={
                <span className="inline-flex items-center gap-1">
                  <Truck className="h-3 w-3 text-muted-foreground" />
                  {delivery.courierMethod}
                </span>
              }
            />
            {delivery.deliveryNotes && (
              <Row
                label="Notes"
                value={
                  <span className="inline-flex items-start gap-1">
                    <FileText className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="receipt-notes">{delivery.deliveryNotes}</span>
                  </span>
                }
              />
            )}
          </div>
        </div>

        {/* Next steps */}
        <div className="receipt-card rounded-xl border border-border bg-muted/25 p-4">
          <h4 className="receipt-heading flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {readonly ? "Customer sees this next" : "What happens next"}
          </h4>
          <ol className="mt-3 space-y-2">
            {[
              `${curator.name} has received your order and delivery details.`,
              "The item will be prepared and dispatched via Bolt Send courier.",
              "You will be notified when the rider is on the way.",
            ].map((step, i) => (
              <li key={i} className="receipt-step flex items-start gap-2.5 text-xs leading-5 text-foreground">
                <span className="receipt-step-num mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[9px] font-bold text-emerald-600">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          {!readonly && whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="receipt-whatsapp-btn mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
              Message {curator.name} on WhatsApp
            </a>
          )}

          {!readonly && !whatsappLink && (
            <p className="mt-3 text-xs text-muted-foreground text-center">
              {curator.name} will reach out to you for delivery coordination.
            </p>
          )}

          {/* Track order link */}
          {payment.id && (
            <a
              href={`/track?id=${encodeURIComponent(payment.id)}&slug=${encodeURIComponent(curator.slug)}`}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Track order status
            </a>
          )}
        </div>

        {/* Action buttons — hidden during print */}
        <div className="receipt-reset-btn space-y-2">
          {!readonly && onReset && (
            <button
              type="button"
              onClick={onReset}
              className="receipt-shop-btn inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Shop more from {curator.name}
            </button>
          )}

          {/* Desktop print button — hidden during print, visible on desktop */}
          <button
            type="button"
            onClick={() => window.print()}
            className="receipt-print-btn hidden w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted sm:inline-flex"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save as PDF
          </button>
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <span className="receipt-label text-xs text-muted-foreground shrink-0">{label}</span>
      <span
        className={`receipt-amount text-right text-xs ${
          highlight ? "font-bold text-foreground" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export type { ReceiptPayment, ReceiptDelivery, ReceiptCurator, ReceiptProps };
