import { describe, expect, it } from "vitest";
import {
  formatKitType,
  formatMoney,
  getInitials,
  getLowestPrice,
  getTotalStock,
} from "../storefront-helpers";

describe("curator storefront helpers", () => {
  it("formatKitType capitalises first letter", async () => {
    expect(formatKitType("home")).toBe("Home");
    expect(formatKitType("away")).toBe("Away");
    expect(formatKitType("goalkeeper")).toBe("Goalkeeper");
  });

  it("getLowestPrice returns the minimum positive price", async () => {
    const sizes = [
      { size: "S", stock: 2, price: 3000 },
      { size: "M", stock: 0, price: 2500 },
      { size: "L", stock: 1, price: 3500 },
    ];
    expect(getLowestPrice(sizes)).toBe(2500);
  });

  it("getLowestPrice returns null when no valid prices", async () => {
    expect(getLowestPrice([])).toBeNull();
    expect(getLowestPrice([{ size: "M", stock: 0, price: 0 }])).toBeNull();
  });

  it("getTotalStock sums stock across sizes", async () => {
    const sizes = [
      { size: "S", stock: 2, price: 100 },
      { size: "M", stock: 5, price: 100 },
      { size: "L", stock: 0, price: 100 },
    ];
    expect(getTotalStock(sizes)).toBe(7);
  });

  it("getInitials extracts first two initials", async () => {
    expect(getInitials("Arsenal")).toBe("A");
    expect(getInitials("Manchester United")).toBe("MU");
    expect(getInitials("")).toBe("");
    expect(getInitials("  spaced  out  ")).toBe("SO");
  });

  it("formatMoney formats using env locale and currency", async () => {
    const result = formatMoney(2500);
    expect(result).toContain("2,500");
  });
});
