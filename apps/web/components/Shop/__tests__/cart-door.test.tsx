import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { FashionItem } from "@onpoint/shared-types";
import { useCartStore } from "../../../lib/stores/cart-store";
import { CartSlot } from "../CartDrawer";
import { CartMount } from "../CartMount";

const item = {
  id: "sku-1",
  slug: "sku-1",
  name: "Navy cardigan",
  description: "A cardigan.",
  price: 12,
  category: "outerwear",
  cover: "/assets/1Model.png",
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as FashionItem;

/** The layout pairs these two; neither is reachable without the other. */
function Shell() {
  return (
    <>
      <CartSlot />
      <CartMount />
    </>
  );
}

describe("header cart door", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], isOpen: false, lastAddedItem: null });
  });
  afterEach(() => {
    localStorage.clear();
    useCartStore.setState({ items: [], isOpen: false, lastAddedItem: null });
  });

  it("is absent while the cart is empty", async () => {
    render(<Shell />);
    await act(async () => {});
    expect(screen.queryByRole("button", { name: /Open cart/ })).toBeNull();
  });

  // Shop left the nav. Without this, an item added anywhere is unopenable
  // everywhere except the page it was added on.
  it("opens the drawer for a cart added on another page", async () => {
    render(<Shell />);
    await act(async () => {});

    await act(async () => { useCartStore.getState().addItem(item); });
    fireEvent.click(screen.getByRole("button", { name: "Open cart, 1 item" }));

    expect(useCartStore.getState().isOpen).toBe(true);
    // The just-added preview also names the item, so presence is the claim here.
    expect(screen.getAllByText("Navy cardigan").length).toBeGreaterThan(0);
  });

  it("badges the count and says so to a screen reader", async () => {
    render(<Shell />);
    await act(async () => {});

    await act(async () => {
      useCartStore.getState().addItem(item);
      useCartStore.getState().addItem(item);
    });
    expect(screen.getByRole("button", { name: "Open cart, 2 items" })).toBeTruthy();
  });
});
