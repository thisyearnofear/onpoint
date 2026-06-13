import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  detectBrowser,
  classifyCameraError,
  checkCameraPermission,
  type CameraError,
} from "@repo/ai-client";

/**
 * The camera-permissions module reads from the global `navigator`, so we
 * swap its userAgent / permissions properties in and out for each test.
 */
function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    value: ua,
    configurable: true,
    writable: true,
  });
}

function setPermissions(perms: Permissions | undefined) {
  if (perms) {
    (navigator as unknown as { permissions: Permissions }).permissions = perms;
  } else {
    delete (navigator as unknown as { permissions?: Permissions }).permissions;
  }
}

describe("detectBrowser", () => {
  let originalUA: string;

  beforeEach(() => {
    originalUA = navigator.userAgent;
  });
  afterEach(() => {
    setUserAgent(originalUA);
  });

  it("classifies iPhone Safari as ios-safari", () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );
    const info = detectBrowser();
    expect(info.name).toBe("ios-safari");
    expect(info.ios).toBe(true);
    expect(info.mobile).toBe(true);
  });

  it("classifies iPad Safari as ios-safari", () => {
    setUserAgent(
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );
    expect(detectBrowser().name).toBe("ios-safari");
  });

  it("classifies Android Chrome as android-chrome", () => {
    setUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    );
    const info = detectBrowser();
    expect(info.name).toBe("android-chrome");
    expect(info.mobile).toBe(true);
  });

  it("classifies desktop Chrome as chrome", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    const info = detectBrowser();
    expect(info.name).toBe("chrome");
    expect(info.mobile).toBe(false);
  });

  it("classifies Edge before Chrome (Edge UA includes 'Chrome')", () => {
    setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    );
    expect(detectBrowser().name).toBe("edge");
  });

  it("classifies Firefox as firefox", () => {
    setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
    );
    const info = detectBrowser();
    expect(info.name).toBe("firefox");
    expect(info.mobile).toBe(false);
  });
});

describe("classifyCameraError", () => {
  it("classifies NotAllowedError as permission_denied with Chrome-specific steps", () => {
    const browser = { name: "chrome" as const, ios: false, mobile: false };
    const result = classifyCameraError(
      { name: "NotAllowedError", message: "Permission denied" },
      "getUserMedia",
      browser,
    );
    expect(result.kind).toBe("permission_denied");
    expect(result.title).toBe("Camera access is blocked");
    expect(result.steps.length).toBeGreaterThan(0);
    expect(
      result.steps.some((s) => s.toLowerCase().includes("address bar")),
    ).toBe(true);
    expect(result.primaryAction).toBe("upload");
  });

  it("returns iOS-specific recovery steps for permission_denied on iOS Safari", () => {
    const browser = { name: "ios-safari" as const, ios: true, mobile: true };
    const result = classifyCameraError(
      { name: "NotAllowedError", message: "denied" },
      "getUserMedia",
      browser,
    );
    expect(result.kind).toBe("permission_denied");
    expect(result.steps.some((s) => s.includes("Settings"))).toBe(true);
    expect(result.steps.some((s) => s.includes("Safari"))).toBe(true);
  });

  it("classifies NotFoundError as no_camera", () => {
    const result = classifyCameraError(
      { name: "NotFoundError", message: "Requested device not found" },
      "getUserMedia",
    );
    expect(result.kind).toBe("no_camera");
    expect(result.primaryAction).toBe("upload");
  });

  it("classifies NotReadableError as in_use", () => {
    const result = classifyCameraError(
      { name: "NotReadableError", message: "Could not start video source" },
      "getUserMedia",
    );
    expect(result.kind).toBe("in_use");
    expect(result.steps.some((s) => /zoom|meet|facetime/i.test(s))).toBe(true);
  });

  it("classifies OverconstrainedError as constraints_not_met", () => {
    const result = classifyCameraError(
      { name: "OverconstrainedError", message: "Constraints cannot be satisfied" },
      "getUserMedia",
    );
    expect(result.kind).toBe("constraints_not_met");
  });

  it("classifies SecurityError (HTTP context) as unsupported", () => {
    const result = classifyCameraError(
      { name: "SecurityError", message: "secure context" },
      "getUserMedia",
    );
    expect(result.kind).toBe("unsupported");
    expect(result.steps.some((s) => /https/i.test(s))).toBe(true);
  });

  it("classifies timeout in provision step with server-busy message", () => {
    const result = classifyCameraError(
      {
        name: "AbortError",
        message: "Setting up your AI session is taking longer than expected.",
      },
      "provision",
    );
    expect(result.kind).toBe("timeout");
    expect(result.steps.some((s) => /server|busy|try again/i.test(s))).toBe(true);
  });

  it("classifies timeout in getUserMedia step with permission-prompt message", () => {
    const result = classifyCameraError(
      {
        name: "AbortError",
        message: "Camera setup is taking longer than expected.",
      },
      "getUserMedia",
    );
    expect(result.kind).toBe("timeout");
    expect(result.steps.some((s) => /permission/i.test(s))).toBe(true);
  });

  it("falls back to 'other' for unrecognized errors", () => {
    const result = classifyCameraError(
      new Error("Something completely unexpected"),
      "getUserMedia",
    );
    expect(result.kind).toBe("other");
    expect(result.title).toBe("Couldn't start your camera");
  });

  it("marks the originating step on every classification", () => {
    const result = classifyCameraError(
      { name: "NotAllowedError", message: "denied" },
      "precheck",
    );
    expect(result.step).toBe("precheck");
  });

  it("always offers upload as the primary action for camera errors", () => {
    const cases = [
      { name: "NotAllowedError" },
      { name: "NotFoundError" },
      { name: "NotReadableError" },
      { name: "SecurityError" },
    ] as const;
    for (const c of cases) {
      const r: CameraError = classifyCameraError(
        { name: c.name, message: "test" },
        "getUserMedia",
      );
      expect(r.primaryAction).toBe("upload");
    }
  });
});

describe("checkCameraPermission", () => {
  let originalPermissions: Permissions | undefined;
  beforeEach(() => {
    originalPermissions = (navigator as unknown as { permissions?: Permissions })
      .permissions;
  });
  afterEach(() => {
    setPermissions(originalPermissions);
  });

  it("returns 'unsupported' when navigator.permissions is missing", async () => {
    setPermissions(undefined);
    expect(await checkCameraPermission()).toBe("unsupported");
  });

  it("returns 'unsupported' when query throws (e.g. Safari)", async () => {
    setPermissions({
      query: () => Promise.reject(new Error("not supported")),
    } as unknown as Permissions);
    expect(await checkCameraPermission()).toBe("unsupported");
  });

  it("returns 'granted' when query resolves with state=granted", async () => {
    setPermissions({
      query: () => Promise.resolve({ state: "granted" } as PermissionStatus),
    } as unknown as Permissions);
    expect(await checkCameraPermission()).toBe("granted");
  });

  it("returns 'denied' when query resolves with state=denied", async () => {
    setPermissions({
      query: () => Promise.resolve({ state: "denied" } as PermissionStatus),
    } as unknown as Permissions);
    expect(await checkCameraPermission()).toBe("denied");
  });

  it("returns 'prompt' when query resolves with state=prompt", async () => {
    setPermissions({
      query: () => Promise.resolve({ state: "prompt" } as PermissionStatus),
    } as unknown as Permissions);
    expect(await checkCameraPermission()).toBe("prompt");
  });
});
