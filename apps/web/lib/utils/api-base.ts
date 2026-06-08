const API_BASE = (
  process.env.NEXT_PUBLIC_AGENT_API_URL ||
  process.env.AGENT_API_URL ||
  "http://localhost:48751"
).replace(/\/$/, "");

export function getApiBase(): string {
  return API_BASE;
}
