/**
 * @repo/qwen-cloud — public surface.
 *
 * Direct Qwen Cloud (DashScope) integration for the Qwen Cloud Hackathon.
 * Track 4: Autopilot Agent.
 *
 * This is the first-party Qwen Cloud client — calls go directly to
 * https://dashscope-intl.aliyuncs.com/compatible-mode/v1, not through
 * a third-party router (0G, Venice). This satisfies the hackathon
 * requirement of "sophisticated use of QwenCloud APIs."
 *
 * Docs: https://docs.qwencloud.com/developer-guides/text-generation/quickstart
 */

export * from "./types";
export * from "./models";
export {
  QwenCloudClient,
  QwenCloudSpendGuardError,
  getQwenCloudClient,
  _resetQwenCloudClientForTests,
} from "./client";
