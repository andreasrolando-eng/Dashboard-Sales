/** Wraps a tool handler so a thrown validation/Postgres error becomes an MCP tool-error result instead of an uncaught throw -- one bad call must never kill the server process. Never logs to stdout (reserved for the stdio transport's protocol frames); stderr only. Generic over the handler's own return type (rather than a hand-rolled result interface) so it stays structurally assignable to whatever CallToolResult shape the installed SDK version expects. */
export function withToolErrorHandling<Args extends unknown[], R>(handler: (...args: Args) => Promise<R>) {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[mcp-server] tool error:", message);
      return { isError: true as const, content: [{ type: "text" as const, text: message }] };
    }
  };
}
