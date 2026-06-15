/**
 * camera-permissions — Detection, classification, and recovery guidance
 * for camera-related failures in live session setup.
 *
 * Browsers will NOT re-prompt for camera permission after a denial — they
 * cache the decision silently. The only way to recover is for the user to
 * manually reset the permission in browser settings. Our job is to:
 *
 *   1. Detect the permission state proactively (where the Permissions API
 *      is available: Chromium, Firefox) so we can show a guided recovery
 *      message before the user even hits "Try again".
 *   2. Translate DOMException names from getUserMedia rejections into
 *      specific, actionable error categories.
 *   3. Produce browser-specific recovery instructions so the user knows
 *      exactly what to do.
 */

// ── Public types ──

/** What kind of camera problem we're dealing with. */
export type CameraErrorKind =
  /** User previously denied camera permission (or just denied it). Browser will not re-prompt. */
  | "permission_denied"
  /** Browser does not expose a camera at all (no webcam, HTTP context, or unsupported browser). */
  | "no_camera"
  /** A camera exists but another app/OS process is holding it. */
  | "in_use"
  /** Requested constraints (resolution, facingMode) could not be satisfied. */
  | "constraints_not_met"
  /** Browser doesn't expose getUserMedia at all (HTTP context, old browser, iframe sandbox). */
  | "unsupported"
  /** One of the session setup steps (getUserMedia, provisioning, connect) didn't complete in time. */
  | "timeout"
  /** getUserMedia succeeded but the browser blocked autoplay (Low Power Mode, Data Saver, in-app browser). */
  | "playback_blocked"
  /** Caught something we don't recognize. */
  | "other";

export type CameraErrorStep =
  | "precheck"
  | "getUserMedia"
  | "provision"
  | "create"
  | "connect";

/** Coarse browser classification — used to pick the right recovery copy. */
export type BrowserName =
  | "chrome"
  | "edge"
  | "firefox"
  | "safari"
  | "ios-safari"
  | "android-chrome"
  | "other";

export interface BrowserInfo {
  name: BrowserName;
  /** True for iPhone/iPad (regardless of in-app browser). */
  ios: boolean;
  /** True for any mobile OS. */
  mobile: boolean;
}

/** Structured camera error — carries everything the UI needs to render guidance. */
export interface CameraError {
  kind: CameraErrorKind;
  /** Short heading, e.g. "Camera access is blocked". */
  title: string;
  /** One-sentence explanation of what happened. */
  message: string;
  /** Numbered recovery steps the user can follow right now. */
  steps: string[];
  /** What the primary action button should do. */
  primaryAction: "upload" | "retry";
  /** Whether a "Go Back" / "Cancel" secondary action makes sense. */
  canGoBack: boolean;
  /** Which step of the setup flow the error originated from. */
  step: CameraErrorStep;
}

// ── Typed error classes ──
//
// `classifyCameraError` matches on the thrown value's `name` property.
// Using real Error subclasses keeps the call site type-safe and avoids
// the `as DOMException` / string-literal-name hacks that lie to the
// type system.

/**
 * Thrown when getUserMedia succeeded but the browser refused to autoplay
 * the resulting <video> (iOS Low Power Mode, Android Data Saver, in-app
 * browsers that suppress autoplay). Classified as `playback_blocked`.
 */
export class PlaybackBlockedError extends Error {
  override readonly name = "PlaybackBlockedError";
  constructor(message = "Video playback was blocked by the browser") {
    super(message);
  }
}

// ── Browser detection ──

/**
 * Parse the user agent into a coarse browser classification. Intentionally
 * not exhaustive — we just need enough to pick the right recovery copy.
 */
export function detectBrowser(): BrowserInfo {
  if (typeof navigator === "undefined") {
    return { name: "other", ios: false, mobile: false };
  }
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const mobile = /Mobi|Android|iPhone|iPad|iPod/.test(ua);

  // Order matters: Edge/Opera both include "Chrome" in their UA, so check
  // them first; iOS browsers all claim to be Safari.
  if (/Edg\//.test(ua)) return { name: "edge", ios, mobile };
  if (/Firefox\//.test(ua)) return { name: "firefox", ios, mobile };
  if (ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) {
    return { name: "ios-safari", ios, mobile };
  }
  if (ios) {
    // iOS in-app browser (Instagram, Twitter, etc.) — treat like Safari
    // for recovery purposes; the user has to open Settings anyway.
    return { name: "ios-safari", ios, mobile };
  }
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) {
    return mobile
      ? { name: "android-chrome", ios, mobile }
      : { name: "chrome", ios, mobile };
  }
  if (/Safari\//.test(ua)) return { name: "safari", ios, mobile };
  return { name: "other", ios, mobile };
}

// ── Permission pre-check ──

export type CameraPermissionState =
  | "granted"
  | "denied"
  | "prompt"
  | "unsupported";

/**
 * Query the current camera permission state via the Permissions API.
 * Returns "unsupported" when the API is missing or the name is unknown
 * to the browser (Safari does not support { name: "camera" }).
 *
 * The caller should treat "unsupported" as "try anyway" — Safari will
 * still prompt the user, and the result will be visible in the
 * DOMException name from the getUserMedia call.
 */
export async function checkCameraPermission(): Promise<CameraPermissionState> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unsupported";
  }
  try {
    const status = await navigator.permissions.query({
      // `name: "camera"` is valid in Chromium + Firefox. Safari throws.
      name: "camera" as PermissionName,
    });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "unsupported";
  }
}

// ── Error classification ──

const CAMERA_TIMEOUT_KEYWORDS = [
  "camera setup",
  "setting up your ai",
  "connecting to your ai",
];

/**
 * Build a structured CameraError from a thrown value. `step` lets us give
 * better context for the message (e.g. a timeout in `provision` is
 * "server is busy", not "camera blocked").
 */
export function classifyCameraError(
  err: unknown,
  step: CameraErrorStep,
  browser: BrowserInfo = detectBrowser(),
): CameraError {
  // Try to read a DOMException name from whatever the browser threw.
  const name =
    (err &&
      typeof err === "object" &&
      "name" in err &&
      typeof (err as { name: unknown }).name === "string" &&
      (err as { name: string }).name) ||
    (err instanceof Error ? err.name : "");

  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Unknown camera error";

  // ── Playback blocked: getUserMedia succeeded but the browser refused
  // to autoplay the video (iOS Low Power Mode, Android Data Saver,
  // in-app browsers that suppress autoplay). Checked BEFORE the
  // NotAllowedError message regex below, otherwise a message that
  // contains the word "denied" (e.g. "autoplay denied") would be
  // misclassified as permission_denied. ──
  if (name === "PlaybackBlockedError") {
    return {
      kind: "playback_blocked",
      title: "Video playback was blocked",
      message:
        "Your camera started, but your browser blocked video playback. This can happen in Low Power Mode, Data Saver mode, or when using an in-app browser.",
      steps: playbackBlockedSteps(browser),
      primaryAction: "upload",
      canGoBack: true,
      step,
    };
  }

  // ── Timeouts get their own kind so we can offer "retry" or "upload". ──
  if (name === "AbortError" || isTimeoutMessage(message)) {
    return {
      kind: "timeout",
      title: timeoutTitle(step),
      message: timeoutMessage(step),
      steps: timeoutSteps(step, browser),
      primaryAction: "upload",
      canGoBack: true,
      step,
    };
  }

  // ── Permission denied: user previously blocked the camera. Browser will
  // not re-prompt — they have to go into settings. ──
  if (name === "NotAllowedError" || /permission|denied|not allowed/i.test(message)) {
    return {
      kind: "permission_denied",
      title: "Camera access is blocked",
      message:
        "Your browser is blocking camera access for this site. Once permission is denied, the browser won't ask again — you'll need to reset it manually.",
      steps: resetPermissionSteps(browser),
      primaryAction: "upload",
      canGoBack: true,
      step,
    };
  }

  // ── No camera: device has none, or getUserMedia is undefined. ──
  if (
    name === "NotFoundError" ||
    name === "OverconstrainedError" ||
    name === "NotReadableError" ||
    /no camera|not found|not found|not supported|https/i.test(message)
  ) {
    if (name === "NotReadableError") {
      return {
        kind: "in_use",
        title: "Camera is in use",
        message:
          "Another app or browser tab is using your camera. Close it and try again, or upload a photo instead.",
        steps: [
          "Close other apps that might be using the camera (Zoom, Meet, FaceTime, etc.)",
          "Close other browser tabs that have camera access",
          "Try again — or upload a photo instead",
        ],
        primaryAction: "upload",
        canGoBack: true,
        step,
      };
    }
    if (name === "OverconstrainedError") {
      return {
        kind: "constraints_not_met",
        title: "Camera doesn't support this resolution",
        message:
          "Your camera can't deliver the resolution we need. Try uploading a photo instead — you'll get the same AI analysis.",
        steps: [
          "Try a different camera if you have one",
          "Or upload a photo — you'll get the same AI analysis",
        ],
        primaryAction: "upload",
        canGoBack: true,
        step,
      };
    }
    return {
      kind: "no_camera",
      title: "No camera detected",
      message:
        "We couldn't find a camera on this device. You can still get the same AI analysis by uploading a photo.",
      steps: noCameraSteps(browser),
      primaryAction: "upload",
      canGoBack: true,
      step,
    };
  }

  // ── SecurityError: usually means the page is on HTTP or in an
  // iframe sandbox without the right allow attribute. ──
  if (
    name === "SecurityError" ||
    /secure context|https|sandbox|not supported/i.test(message)
  ) {
    return {
      kind: "unsupported",
      title: "Camera needs a secure connection",
      message:
        "Camera access requires HTTPS (or localhost). The current page isn't secure, so the browser blocks the camera.",
      steps: [
        "Open this page over HTTPS (the address bar should start with https://)",
        "If you're testing locally, use http://localhost instead of an IP address",
        "Or upload a photo instead",
      ],
      primaryAction: "upload",
      canGoBack: true,
      step,
    };
  }

  // ── Fallback: pass through the message but tag as `other`. ──
  return {
    kind: "other",
    title: "Couldn't start your camera",
    message: message || "Something went wrong while starting your camera.",
    steps: [
      "Refresh the page and try again",
      "If the problem persists, try a different browser",
      "Or upload a photo instead",
    ],
    primaryAction: "upload",
    canGoBack: true,
    step,
  };
}

// ── Recovery step generators (per browser) ──

function resetPermissionSteps(browser: BrowserInfo): string[] {
  switch (browser.name) {
    case "ios-safari":
      return [
        "Open the iOS Settings app",
        "Scroll down and tap Safari → Camera",
        "Set it to \"Ask\" or \"Allow\"",
        "Come back here and refresh the page",
        "Or upload a photo instead",
      ];
    case "android-chrome":
      return [
        "Tap the lock or camera icon in the address bar",
        "Tap \"Permissions\"",
        "Set Camera to \"Ask before allowing\" or \"Allow\"",
        "Refresh the page",
        "Or upload a photo instead",
      ];
    case "chrome":
      return [
        "Click the camera icon (or lock icon) in the address bar",
        "Click \"Reset permission\" or set Camera to \"Allow\"",
        "Refresh the page and try again",
        "Or upload a photo instead",
      ];
    case "edge":
      return [
        "Click the lock icon in the address bar",
        "Set Camera to \"Allow\"",
        "Refresh the page and try again",
        "Or upload a photo instead",
      ];
    case "firefox":
      return [
        "Click the camera icon in the address bar",
        "Click \"Clear this permission\"",
        "Refresh the page and try again",
        "Or upload a photo instead",
      ];
    case "safari":
      return [
        "Open Safari → Settings → Websites → Camera",
        "Find this site and set it to \"Ask\" or \"Allow\"",
        "Refresh the page and try again",
        "Or upload a photo instead",
      ];
    default:
      return [
        "Check your browser's site settings and re-enable camera access for this site",
        "Refresh the page and try again",
        "Or upload a photo instead",
      ];
  }
}

function noCameraSteps(browser: BrowserInfo): string[] {
  if (browser.ios) {
    return [
      "Check that no other app is using the camera (FaceTime, Instagram, etc.)",
      "Make sure Safari has camera access in Settings → Safari → Camera",
      "Or upload a photo instead — you'll get the same AI analysis",
    ];
  }
  return [
    "Make sure a webcam is connected (if you're on a desktop)",
    "Check that no other app is using the camera (Zoom, Meet, etc.)",
    "Or upload a photo instead — you'll get the same AI analysis",
  ];
}

function timeoutSteps(step: CameraErrorStep, browser: BrowserInfo): string[] {
  if (step === "getUserMedia") {
    return [
      "Your browser may be slow to show the camera permission prompt — check the address bar",
      "If the prompt already appeared, click Allow",
      browser.ios
        ? "Or upload a photo instead"
        : "Or upload a photo instead",
    ];
  }
  if (step === "provision" || step === "create") {
    return [
      "Our AI servers may be busy — try again in a moment",
      "Check your internet connection",
      "Or upload a photo instead",
    ];
  }
  return [
    "Check your internet connection",
    "Try again — or upload a photo instead",
  ];
}

function playbackBlockedSteps(browser: BrowserInfo): string[] {
  if (browser.ios) {
    return [
      "Disable Low Power Mode in Settings → Battery",
      "If you're using an in-app browser (Instagram, Twitter, etc.), try opening this page in Safari instead",
      "Or upload a photo — you'll get the same AI analysis",
    ];
  }
  if (browser.mobile) {
    return [
      "Disable Data Saver in Chrome Settings → Data Saver",
      "If you're using an in-app browser, try opening this page in Chrome instead",
      "Or upload a photo — you'll get the same AI analysis",
    ];
  }
  return [
    "Check that your browser isn't blocking media autoplay (check site permissions)",
    "Try tapping the screen once to start playback",
    "Or upload a photo instead — you'll get the same AI analysis",
  ];
}

function timeoutTitle(step: CameraErrorStep): string {
  if (step === "getUserMedia") return "Camera is taking too long to start";
  if (step === "provision" || step === "create")
    return "Server is taking too long to respond";
  return "Connection timed out";
}

function timeoutMessage(step: CameraErrorStep): string {
  if (step === "getUserMedia")
    return "The camera didn't start in time. Your browser may be blocking the permission prompt.";
  if (step === "provision")
    return "Our server didn't respond in time. It may be busy — try again in a moment.";
  if (step === "create")
    return "We couldn't connect to your AI stylist in time. Try again, or upload a photo instead.";
  return "The connection timed out. Try again, or upload a photo instead.";
}

function isTimeoutMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return CAMERA_TIMEOUT_KEYWORDS.some((kw) => lower.includes(kw));
}
