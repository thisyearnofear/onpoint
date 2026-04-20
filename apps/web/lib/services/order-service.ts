/**
 * Order Service
 *
 * Persists orders in Redis for history/confirmation.
 * Schema is Postgres-ready (flat fields, no nested JSON for queries).
 */

import {
  readPersistentState,
  writePersistentState,
} from "../utils/persistent-state";

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: "confirmed" | "pending" | "failed";
  txHash?: string;
  chain?: string;
  explorerUrl?: string;
  createdAt: number;
}

const ORDERS_KEY = (userId: string) => `orders:${userId}`;

export async function saveOrder(order: Order): Promise<void> {
  const orders = await getUserOrders(order.userId);
  orders.unshift(order);
  // Keep last 50 orders per user
  await writePersistentState(ORDERS_KEY(order.userId), orders.slice(0, 50));
}

export async function getUserOrders(userId: string): Promise<Order[]> {
  return readPersistentState(ORDERS_KEY(userId), () => []);
}

export async function getOrder(
  userId: string,
  orderId: string,
): Promise<Order | undefined> {
  const orders = await getUserOrders(userId);
  return orders.find((o) => o.id === orderId);
}
