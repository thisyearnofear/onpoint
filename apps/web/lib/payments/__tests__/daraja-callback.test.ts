import { describe, expect, it } from "vitest";
import { buildCallbackUrl, verifyCallbackToken } from "../daraja";

describe("buildCallbackUrl", () => {
  it("appends the secret as ?s= when configured", () => {
    expect(buildCallbackUrl({ callbackBaseUrl: "https://onpoint.test", callbackSecret: "a b&c" })).toBe(
      "https://onpoint.test/api/curator/stk-callback?s=a%20b%26c",
    );
  });
  it("is the plain callback path when no secret is set", () => {
    expect(buildCallbackUrl({ callbackBaseUrl: "https://onpoint.test" })).toBe(
      "https://onpoint.test/api/curator/stk-callback",
    );
  });
});

describe("verifyCallbackToken", () => {
  it("does not enforce when no secret is configured", () => {
    expect(verifyCallbackToken(null, undefined)).toEqual({ ok: true, enforced: false });
    expect(verifyCallbackToken("anything", "")).toEqual({ ok: true, enforced: false });
  });
  it("accepts only the exact secret", () => {
    expect(verifyCallbackToken("s3cret", "s3cret")).toEqual({ ok: true, enforced: true });
    expect(verifyCallbackToken("s3cre", "s3cret")).toEqual({ ok: false, enforced: true });
    expect(verifyCallbackToken("S3CRET", "s3cret")).toEqual({ ok: false, enforced: true });
    expect(verifyCallbackToken("s3cret ", "s3cret")).toEqual({ ok: false, enforced: true });
  });
  it("rejects a missing or empty token when a secret is configured", () => {
    expect(verifyCallbackToken(null, "s3cret")).toEqual({ ok: false, enforced: true });
    expect(verifyCallbackToken(undefined, "s3cret")).toEqual({ ok: false, enforced: true });
    expect(verifyCallbackToken("", "s3cret")).toEqual({ ok: false, enforced: true });
  });
  it("handles tokens of very different length without throwing", () => {
    expect(verifyCallbackToken("x".repeat(5000), "s3cret")).toEqual({ ok: false, enforced: true });
  });
});
