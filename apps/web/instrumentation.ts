/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the server starts. Used for startup validation
 * and one-time initialization tasks.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/utils/env-validation");
    validateEnv();
  }
}
