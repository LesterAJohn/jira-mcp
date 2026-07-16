import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { env } from "./config/env.js";
import { createMcpServer } from "./mcp/server.js";
import { TargetServiceClient } from "./services/targetService.js";

async function main() {
  if (env.transport.mode === "http") {
    await import("./http/index.js");
    return;
  }

  if (env.transport.mode === "both") {
    await import("./start-both.js");
    return;
  }

  const targetServiceClient = new TargetServiceClient(env.targetService);

  const server = createMcpServer({
    name: env.mcpServerName,
    version: env.mcpServerVersion,
    serviceClient: targetServiceClient
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("MCP server failed to start", error);
  process.exit(1);
});
