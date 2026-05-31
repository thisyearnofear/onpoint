"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  User,
  FileText,
  Package,
  Truck,
  Clock,
  PackageCheck,
  Bike,
  Handshake,
  Receipt,
  X,
} from "lucide-react";
import { ReceiptPanel } from "../../../../components/ReceiptPanel";

interface PaymentRecord {
  id: string;
  curatorSlug: string;
  listingId?: string | null;
  itemName?: string | null;
  size?: string | null;
  amount?: number | null;
  currency?: string | null;
  customerPhone?: string | null;
  mpesaCode?: string | null;
  status?: string | null;
  fulfilmentStatus?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryNotes?: string | null;
  pickupLocation?: string | null;
  courierMethod?: string | null;
  createdAt: string;
}

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_verification: { label: "Pending verification", color: "text-amber-600", bg: "bg-amber-500/10" },
  paid: { label: "Paid", color: "text-emerald-600", bg: "bg-emerald-500/10" },
  rejected: { label: "Rejected", color: "text-red-600", bg: "bg-red-500/10" },
};

const FULFILMENT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  awaiting_delivery_details: { label: "Awaiting delivery", color: "text-amber-600", bg: "bg-amber-500/10" },
  ready_for_pickup: { label: "Ready for pickup", color: "text-blue-600", bg: "bg-blue-500/10" },
  rider_assigned: { label: "Rider assigned", color: "text-violet-600", bg: "bg-violet-500/10" },
  delivered: { label: "Delivered", color: "text-emerald-600", bg: "bg-emerald-500/10" },
};

function formatDateTime(iso?: string) {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleString("en-KE", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function labelize(value?: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function PaymentsTable({ curatorName, payments }: { curatorName: string; payments: PaymentRecord[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [localPayments, setLocalPayments] = useState(payments);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const updatePayment = async (paymentId: string, body: Record<string, unknown>) => {
    setUpdating(paymentId);
    try {
      const res = await fetch("/api/admin/curator/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.payment) {
        setLocalPayments((prev) =>
          prev.map((p) => (p.id === paymentId ? { ...p, ...data.payment } : p)),
        );
      }
    } catch {
      // silently fail
    } finally {
      setUpdating(null);
    }
  };

  if (localPayments.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        No M-Pesa confirmations yet. Customers can submit transaction codes from the storefront.
      </div>
    );
  }

  // Find the payment for the receipt modal
  const receiptPayment = localPayments.find((p) => p.id === receiptPaymentId);

  return (
    <>
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-left font-medium">Amount</th>
              <th className="px-3 py-2 text-left font-medium">Customer</th>
              <th className="px-3 py-2 text-left font-medium">Code</th>
              <th className="px-3 py-2 text-left font-medium">Payment</th>
              <th className="px-3 py-2 text-left font-medium">Fulfilment</th>
              <th className="px-3 py-2 text-right font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {localPayments.slice(0, 12).map((payment) => {
              const isExpanded = expandedId === payment.id;
              const payConfig = PAYMENT_STATUS_CONFIG[payment.status || ""] || {
                label: labelize(payment.status),
                color: "text-muted-foreground",
                bg: "bg-muted/30",
              };
              const fulfilConfig = FULFILMENT_STATUS_CONFIG[payment.fulfilmentStatus || ""] || {
                label: payment.fulfilmentStatus ? labelize(payment.fulfilmentStatus) : "—",
                color: "text-muted-foreground",
                bg: "bg-muted/30",
              };

              const hasDelivery = payment.recipientName || payment.recipientPhone || payment.deliveryAddress;
              const isPendingPay = payment.status === "pending_verification";
              const isPaid = payment.status === "paid";
              const currentFulfil = payment.fulfilmentStatus || "";

              return (
                <React.Fragment key={payment.id}>
                  <tr
                    className={`cursor-pointer transition-colors hover:bg-muted/30 ${isExpanded ? "bg-muted/20" : ""}`}
                    onClick={() => toggleExpand(payment.id)}
                  >
                    <td className="px-3 py-3">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{payment.itemName || "Storefront item"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Size {payment.size || "—"}
                      </p>
                    </td>
                    <td className="px-3 py-3 font-medium">
                      {payment.currency || "KES"} {Number(payment.amount || 0).toLocaleString("en-KE")}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {payment.customerPhone || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <code className="rounded bg-muted px-2 py-1 text-xs">
                        {payment.mpesaCode || "—"}
                      </code>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full ${payConfig.bg} px-2 py-0.5 text-[11px] font-medium capitalize ${payConfig.color}`}>
                        {payment.status === "paid" ? <CheckCircle2 className="h-3 w-3" /> : null}
                        {payment.status === "rejected" ? <XCircle className="h-3 w-3" /> : null}
                        {payment.status === "pending_verification" ? <Clock className="h-3 w-3" /> : null}
                        {payConfig.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {currentFulfil ? (
                        <span className={`inline-flex items-center gap-1 rounded-full ${fulfilConfig.bg} px-2 py-0.5 text-[11px] font-medium capitalize ${fulfilConfig.color}`}>
                          {currentFulfil === "delivered" ? <Handshake className="h-3 w-3" /> : null}
                          {currentFulfil === "ready_for_pickup" ? <PackageCheck className="h-3 w-3" /> : null}
                          {currentFulfil === "rider_assigned" ? <Bike className="h-3 w-3" /> : null}
                          {currentFulfil === "awaiting_delivery_details" ? <Clock className="h-3 w-3" /> : null}
                          {fulfilConfig.label}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                      {formatDateTime(payment.createdAt)}
                    </td>
                  </tr>

                  {/* Expanded delivery + actions row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="border-t border-border bg-muted/15 px-4 py-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          {/* Delivery details */}
                          <div>
                            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              <Truck className="h-3 w-3" />
                              Delivery details
                            </h4>
                            {hasDelivery ? (
                              <div className="space-y-2 text-xs">
                                {payment.recipientName && (
                                  <div className="flex items-center gap-2">
                                    <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span>{payment.recipientName}</span>
                                  </div>
                                )}
                                {payment.recipientPhone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span>{payment.recipientPhone}</span>
                                  </div>
                                )}
                                {payment.deliveryAddress && (
                                  <div className="flex gap-2">
                                    <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span className="text-muted-foreground">{payment.deliveryAddress}</span>
                                  </div>
                                )}
                                {payment.pickupLocation && (
                                  <div className="flex items-center gap-2">
                                    <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span className="text-muted-foreground">Pickup: {payment.pickupLocation}</span>
                                  </div>
                                )}
                                {payment.deliveryNotes && (
                                  <div className="flex gap-2">
                                    <FileText className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span className="italic text-muted-foreground">{payment.deliveryNotes}</span>
                                  </div>
                                )}
                                {payment.courierMethod && (
                                  <div className="flex items-center gap-2">
                                    <Bike className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span className="font-medium">{payment.courierMethod}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs italic text-muted-foreground">
                                Awaiting delivery details from customer.
                              </p>
                            )}

                            {/* View receipt button */}
                            {hasDelivery && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReceiptPaymentId(payment.id);
                                }}
                                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20"
                              >
                                <Receipt className="h-3 w-3" />
                                View customer receipt
                              </button>
                            )}
                          </div>

                          {/* Status actions */}
                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Actions
                            </h4>
                            <div className="space-y-2">
                              {/* Payment status actions */}
                              {isPendingPay && (
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    disabled={updating === payment.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updatePayment(payment.id, {
                                        paymentId: payment.id,
                                        curatorSlug: payment.curatorSlug,
                                        paymentAction: "verify",
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Verify & mark paid
                                  </button>
                                  <button
                                    type="button"
                                    disabled={updating === payment.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updatePayment(payment.id, {
                                        paymentId: payment.id,
                                        curatorSlug: payment.curatorSlug,
                                        paymentAction: "reject",
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                                  >
                                    <XCircle className="h-3 w-3" />
                                    Reject
                                  </button>
                                </div>
                              )}

                              {/* Fulfilment status actions - only show when paid */}
                              {isPaid && (
                                <div className="flex flex-wrap gap-1.5">
                                  {currentFulfil !== "ready_for_pickup" && currentFulfil !== "rider_assigned" && currentFulfil !== "delivered" && (
                                    <button
                                      type="button"
                                      disabled={updating === payment.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updatePayment(payment.id, {
                                          paymentId: payment.id,
                                          curatorSlug: payment.curatorSlug,
                                          fulfilmentAction: "ready_for_pickup",
                                        });
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2.5 py-1.5 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
                                    >
                                      <Package className="h-3 w-3" />
                                      Ready for pickup
                                    </button>
                                  )}
                                  {currentFulfil === "ready_for_pickup" && (
                                    <button
                                      type="button"
                                      disabled={updating === payment.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updatePayment(payment.id, {
                                          paymentId: payment.id,
                                          curatorSlug: payment.curatorSlug,
                                          fulfilmentAction: "rider_assigned",
                                        });
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-medium text-violet-600 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
                                    >
                                      <Bike className="h-3 w-3" />
                                      Rider assigned
                                    </button>
                                  )}
                                  {currentFulfil === "rider_assigned" && (
                                    <button
                                      type="button"
                                      disabled={updating === payment.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updatePayment(payment.id, {
                                          paymentId: payment.id,
                                          curatorSlug: payment.curatorSlug,
                                          fulfilmentAction: "delivered",
                                        });
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                                    >
                                      <Handshake className="h-3 w-3" />
                                      Mark delivered
                                    </button>
                                  )}
                                </div>
                              )}

                              {!isPendingPay && !isPaid && payment.status === "rejected" && (
                                <p className="text-xs italic text-muted-foreground">
                                  Payment was rejected.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Receipt modal */}
      {receiptPayment && receiptPaymentId && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-8 pb-16"
          onClick={() => setReceiptPaymentId(null)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setReceiptPaymentId(null)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header badge */}
            <div className="mb-3 flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-600 w-fit">
              <Receipt className="h-3.5 w-3.5" />
              Customer view
            </div>

            <ReceiptPanel
              payment={{
                id: receiptPayment.id,
                method: receiptPayment.mpesaCode && receiptPayment.status === "paid" ? "stk" : "manual",
                amount: receiptPayment.amount || 0,
                currency: receiptPayment.currency || "KES",
                mpesaCode: receiptPayment.mpesaCode,
                itemName: receiptPayment.itemName || "Storefront item",
                size: receiptPayment.size || "",
                paidAt: receiptPayment.createdAt,
              }}
              delivery={{
                recipientName: receiptPayment.recipientName || "",
                recipientPhone: receiptPayment.recipientPhone || "",
                deliveryAddress: receiptPayment.deliveryAddress || "",
                deliveryNotes: receiptPayment.deliveryNotes || "",
                pickupLocation: receiptPayment.pickupLocation || "",
                courierMethod: receiptPayment.courierMethod || "Bolt Send",
              }}
              curator={{
                name: curatorName,
                slug: receiptPayment.curatorSlug,
                whatsapp: null, // ReceiptPanel uses this to show a WhatsApp link - hidden in admin
              }}
              readonly
              title="Order confirmed"
            />
          </div>
        </div>
      )}
    </>
  );
}
