/** Every tool returns a short human-readable summary alongside the real payload in structuredContent -- keeps responses bounded instead of dumping raw JSON into prose. Return type is left to inference (not a hand-rolled interface) so it stays structurally assignable to whatever CallToolResult shape the installed SDK version expects. */
export function toResult(summary: string, structuredContent: unknown) {
  return {
    content: [{ type: "text" as const, text: summary }],
    structuredContent,
  };
}
