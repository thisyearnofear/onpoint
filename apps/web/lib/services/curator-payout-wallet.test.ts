import { describe, expect, it } from "vitest";
import {
  isValidCuratorWhatsapp,
  isValidPayoutAddress,
} from "./curator-payout-wallet";

describe("curator-payout-wallet", () => {
  it("validates payout addresses", () => {
    expect(isValidPayoutAddress("0x1111111111111111111111111111111111111111")).toBe(true);
    expect(isValidPayoutAddress("0x123")).toBe(false);
  });

  it("validates curator whatsapp numbers", () => {
    expect(isValidCuratorWhatsapp("+254712345678")).toBe(true);
    expect(isValidCuratorWhatsapp("254712345678")).toBe(false);
  });
});
