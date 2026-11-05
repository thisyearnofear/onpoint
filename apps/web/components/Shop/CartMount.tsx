"use client";

import { useState } from "react";
import { CartDrawer } from "./CartDrawer";
import { CheckoutModal } from "./CheckoutModal";

/**
 * Mounted once by OnPointLayout so a cart added anywhere can be opened from
 * anywhere — including after /shop left the nav. Both children render nothing
 * until opened, so the static shell of every page stays empty-featured.
 */
export function CartMount() {
  const [showCheckout, setShowCheckout] = useState(false);

  return (
    <>
      <CartDrawer onCheckout={() => setShowCheckout(true)} />
      <CheckoutModal isOpen={showCheckout} onClose={() => setShowCheckout(false)} />
    </>
  );
}
