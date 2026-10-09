import { describe, expect, it } from "vitest";
import {
  decideAdminAccess,
  isAdminApiPath,
  isAdminPath,
  parseAdminEmails,
} from "../admin-access";

describe("parseAdminEmails", () => {
  it("parses a mixed-separator list, lowercased and de-duplicated", () => {
    expect(
      parseAdminEmails({ ADMIN_EMAILS: "Ops@Example.com, ceo@example.com;ops@example.com  x" }),
    ).toEqual(["ops@example.com", "ceo@example.com"]);
  });

  it("falls back to the single ADMIN_EMAIL used for digest mail", () => {
    expect(parseAdminEmails({ ADMIN_EMAIL: "admin@example.com" })).toEqual(["admin@example.com"]);
  });

  it("prefers ADMIN_EMAILS when both are set", () => {
    expect(
      parseAdminEmails({ ADMIN_EMAILS: "a@example.com", ADMIN_EMAIL: "b@example.com" }),
    ).toEqual(["a@example.com"]);
  });

  it("returns an empty list when nothing is configured", () => {
    expect(parseAdminEmails({})).toEqual([]);
    expect(parseAdminEmails({ ADMIN_EMAILS: "   ", ADMIN_EMAIL: "" })).toEqual([]);
  });
});

describe("isAdminPath", () => {
  it.each(["/admin", "/admin/", "/admin/curators/nia", "/api/admin/proxy/curators/x", "/api/admin/curator/payments", "/ADMIN/x"])(
    "protects %s",
    (p) => expect(isAdminPath(p)).toBe(true),
  );

  it.each(["/", "/s/nia", "/administrator", "/admins", "/api/administrator", "/api/curator/payments", "/look/admin"])(
    "leaves %s public",
    (p) => expect(isAdminPath(p)).toBe(false),
  );

  it("distinguishes API paths", () => {
    expect(isAdminApiPath("/api/admin/x")).toBe(true);
    expect(isAdminApiPath("/admin/x")).toBe(false);
  });
});

describe("decideAdminAccess", () => {
  const allowlist = ["ops@example.com"];
  const adminUser = { email: "Ops@Example.com", email_verified: true };

  it("allows non-admin paths for anyone", () => {
    expect(decideAdminAccess({ pathname: "/s/nia", user: null, allowlist: [] })).toEqual({ action: "allow" });
  });

  it("fails closed when no allowlist is configured, even for a signed-in user", () => {
    expect(decideAdminAccess({ pathname: "/admin", user: adminUser, allowlist: [] })).toEqual({ action: "unconfigured" });
  });

  it("asks anonymous visitors to log in", () => {
    expect(decideAdminAccess({ pathname: "/admin/curators", user: null, allowlist })).toEqual({ action: "login" });
  });

  it("allows a verified allowlisted email, case-insensitively", () => {
    expect(decideAdminAccess({ pathname: "/api/admin/curator/payments", user: adminUser, allowlist })).toEqual({ action: "allow" });
  });

  it("rejects a signed-in user who is not on the list", () => {
    expect(
      decideAdminAccess({ pathname: "/admin", user: { email: "x@example.com", email_verified: true }, allowlist }),
    ).toEqual({ action: "forbidden", reason: "not_allowlisted" });
  });

  it("rejects an allowlisted but UNVERIFIED email (self-registration cannot impersonate an admin)", () => {
    for (const email_verified of [false, undefined, null]) {
      expect(
        decideAdminAccess({ pathname: "/admin", user: { email: "ops@example.com", email_verified }, allowlist }),
      ).toEqual({ action: "forbidden", reason: "unverified_email" });
    }
  });

  it("rejects a session with no email", () => {
    expect(decideAdminAccess({ pathname: "/admin", user: { email_verified: true }, allowlist })).toEqual({
      action: "forbidden",
      reason: "no_email",
    });
  });
});
