/**
 * OnPoint Qwen Cloud MCP server — entry point.
 *
 * Qwen Cloud Hackathon, Track 4: Autopilot Agent.
 *
 * Run with stdio transport (default, for local agent runtimes):
 *   node --experimental-strip-types packages/qwen-mcp/src/index.ts
 *
 * Inspect with the MCP inspector:
 *   npx @modelcontextprotocol/inspector node --experimental-strip-types packages/qwen-mcp/src/index.ts
 *
 * Configure in an MCP client (e.g. Claude Desktop, Qwen Agent):
 *   {
 *     "mcpServers": {
 *       "onpoint": {
 *         "command": "node",
 *         "args": ["--experimental-strip-types", "/path/to/packages/qwen-mcp/src/index.ts"],
 *         "env": {
 *           "DASHSCOPE_API_KEY": "sk-...",
 *           "ONPOINT_API_BASE": "https://api.onpoint.famile.xyz"
 *         }
 *       }
 *     }
 *   }
 */

import { main } from "./server.js";

main().catch((err: unknown) => {
  console.error("[onpoint-mcp] Fatal:", err);
  process.exit(1);
});
