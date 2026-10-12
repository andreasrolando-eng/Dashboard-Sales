import type { ToolAnnotations } from "@modelcontextprotocol/server";

/**
 * Every tool here only runs SELECTs against the analytics views. Declaring
 * that lets clients skip their per-call confirmation prompt -- ChatGPT's
 * Developer Mode, notably, asks before every tool call not marked read-only.
 */
export const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
