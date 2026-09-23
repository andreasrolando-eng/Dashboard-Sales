import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Deno Edge Function env/params (e.g. the feature-flagged membership
      // sync stub) intentionally use a leading underscore for "not used yet".
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deno runtime, not Node/Next -- linted separately if at all.
    "supabase/functions/**",
    // Standalone MCP server package, its own tsconfig/build -- not Next/React.
    "mcp-server/**",
  ]),
]);

export default eslintConfig;
