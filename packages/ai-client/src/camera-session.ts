/**
 * camera-session — Camera + timeout primitives used by the live session
 * setup. Extracted from use-live-provider.ts so the helpers can be unit
 * tested in isolation and so the camera timeout policy lives in one place
 * rather than being scattered across the startSession call site.
 *
 * Three primitives, layered by cancellation strength:
 *
 *   1. `withTimeout`         — race a promise against a timer. No
 *      cancellation of the loser; only the timer is cleared.
 *
 *   2. `abortableTimeout`    — race a promise against a timer AND let
 *      the caller stop the loser. Used for promises whose side effects
 *      (e.g. a leaked MediaStream's tracks) the caller wants to clean
 *      up if the timer wins.
 *
 *   3. `getUserMediaWithTimeout` — the camera-specific combination.
 *      Uses an `AbortController` (native cancellation in Chrome 103+,
 *      Edge, Firefox 132+) AND the abortableTimeout fallback (Safari /
 *      older Firefox that silently ignore the signal). Either way, no
 *      MediaStream is leaked if the user takes too long on the OS
 *      permission prompt.
 *
 * The two timeouts (camera vs session) are different on purpose. The
 * camera permission prompt is human-driven — the user has to read the
 * text and click — so it gets a longer budget. The session setup steps
 * (provision / create / connect) are server-driven and shorter.
 */

export const CAMERA_SETUP_TIMEOUT_MS = 30_000;
export const SESSION_SETUP_TIMEOUT_MS = 15_000;

/**
 * Race a promise against a timeout. If the timeout wins, reject with a
 * user-friendly message that the caller can surface verbatim. The loser's
 * timer is cleared; the loser's promise is NOT cancelled — callers that
 * need cancellation (e.g. getUserMedia) must use `abortableTimeout`.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Race a promise against a timeout AND cancel the loser. If the timeout
 * wins, `onTimeout` is called with the still-pending promise so the caller
 * can stop it (e.g. stop a leaked MediaStream's tracks when getUserMedia
 * resolves after we've given up). This is the only safe way to use a
 * timeout on getUserMedia — otherwise the camera LED stays on after the UI
 * gives up, and the next retry fails with NotReadableError.
 */
export function abortableTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
  onTimeout: (pending: Promise<T>) => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        onTimeout(promise);
        reject(new Error(message));
      }, ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Open the camera with a hard timeout AND clean cancellation. Uses two
 * complementary mechanisms:
 *
 *   1. AbortController — passed as `signal` on the getUserMedia constraints.
 *      Supported in Chrome 103+, Edge, Firefox 132+. When supported, the
 *      browser itself rejects the in-flight call and releases the camera
 *      hardware the moment we call `controller.abort()` — no race window.
 *
 *   2. abortableTimeout — races against a timer. If the browser ignored
 *      the signal (Safari, older Firefox), the timer still fires and we
 *      stop any late-arriving tracks on the still-pending promise. This
 *      closes the leak even on browsers without native signal support.
 *
 * Always passing the signal is intentional: there is no reliable
 * runtime feature-detect for `getUserMedia({ signal })` support, and an
 * unsupported signal is silently ignored by the browser — so the worst
 * case degrades to the same behavior we had before (timer-driven).
 */
export function getUserMediaWithTimeout(
  constraints: MediaStreamConstraints,
  ms: number,
  message: string,
): Promise<MediaStream> {
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const mediaPromise = navigator.mediaDevices.getUserMedia({
    ...constraints,
    ...(controller ? { signal: controller.signal } : {}),
  });

  // Cleanup: if getUserMedia resolves after we already gave up, stop the
  // tracks so the camera LED goes off. Runs on a separate chain so the
  // race below is not affected.
  mediaPromise
    .then((stream) => {
      if (timedOut) {
        stream.getTracks().forEach((t) => t.stop());
      }
    })
    .catch(() => {
      // Expected when the browser honors the abort signal and rejects
      // with AbortError — the timeout is what surfaces to the user.
    });

  const timeoutPromise = new Promise<MediaStream>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      // Asks the browser to release the camera right now. If the browser
      // supports it, this rejects `mediaPromise` with AbortError; if not,
      // it's a no-op and the cleanup .then() above handles the tail.
      controller?.abort();
      reject(new Error(message));
    }, ms);
  });

  return Promise.race<MediaStream>([mediaPromise, timeoutPromise]).finally(
    () => {
      if (timer) clearTimeout(timer);
    },
  );
}
