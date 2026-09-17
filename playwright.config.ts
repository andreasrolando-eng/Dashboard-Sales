import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against `next dev` (not `next start`) on purpose: the mock
// data bypass (`NEXT_PUBLIC_USE_MOCK_DATA=true`, see src/lib/mock/is-mock.ts)
// is gated on NODE_ENV !== "production", which `next start` sets but `next
// dev` doesn't -- so this is the only way to exercise the dashboard without a
// real Supabase project / ESB data.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // Next logs "Slow filesystem detected" on this machine -- Turbopack's first
  // compile of a route can take a while, especially with several workers
  // racing to compile different routes at once. Generous default timeout to
  // avoid flaking on that rather than a real bug.
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { NEXT_PUBLIC_USE_MOCK_DATA: "true" },
  },
});
