const API_BASE = (
  process.env.AGENT_API_INTERNAL_URL || // server-only: Fly 6PN private address
  process.env.AGENT_API_URL ||
  process.env.NEXT_PUBLIC_AGENT_API_URL ||
  "http://localhost:48751"
).replace(/\/$/, "");

export function getApiBase(): string {
  return API_BASE;
}
