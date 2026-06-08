import { describe, expect, it } from "vitest";

describe("curator storefront helpers", () => {
  it("formatKitType capitalises first letter", async () => {
    const { __test } = await import("../page");
    expect(__test.formatKitType("home")).toBe("Home");
    expect(__test.formatKitType("away")).toBe("Away");
    expect(__test.formatKitType("goalkeeper")).toBe("Goalkeeper");
  });

  it("getLowestPrice returns the minimum positive price", async () => {
    const { __test } = await import("../page");
    const sizes = [
      { size: "S", stock: 2, price: 3000 },
      { size: "M", stock: 0, price: 2500 },
      { size: "L", stock: 1, price: 3500 },
    ];
    expect(__test.getLowestPrice(sizes)).toBe(2500);
  });

  it("getLowestPrice returns null when no valid prices", async () => {
    const { __test } = await import("../page");
    expect(__test.getLowestPrice([])).toBeNull();
    expect(__test.getLowestPrice([{ size: "M", stock: 0, price: 0 }])).toBeNull();
  });

  it("getTotalStock sums stock across sizes", async () => {
    const { __test } = await import("../page");
    const sizes = [
      { size: "S", stock: 2, price: 100 },
      { size: "M", stock: 5, price: 100 },
      { size: "L", stock: 0, price: 100 },
    ];
    expect(__test.getTotalStock(sizes)).toBe(7);
  });

  it("getInitials extracts first two initials", async () => {
    const { __test } = await import("../page");
    expect(__test.getInitials("Arsenal")).toBe("A");
    expect(__test.getInitials("Manchester United")).toBe("MU");
    expect(__test.getInitials("")).toBe("");
    expect(__test.getInitials("  spaced  out  ")).toBe("SO");
  });

  it("formatMoney formats using env locale and currency", async () => {
    const { __test } = await import("../page");
    const result = __test.formatMoney(2500);
    expect(result).toContain("2,500");
  });
});
