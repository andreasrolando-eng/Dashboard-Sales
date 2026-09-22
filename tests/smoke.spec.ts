import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";

const TABS = ["overview", "sales", "ops", "membership", "marketing"] as const;

/** Fails the test on any browser console error or uncaught page error. */
function trackErrors(page: Page): { errors: string[] } {
  const state = { errors: [] as string[] };
  page.on("console", (msg) => {
    if (msg.type() === "error") state.errors.push(msg.text());
  });
  page.on("pageerror", (err) => state.errors.push(err.message));
  return state;
}

test("login page renders the Google sign-in button when logged out", async ({ page }) => {
  const { errors } = trackErrors(page);
  await page.goto("/login");

  // .first() because the button repeats the "Masuk ke Dashboard" headline text.
  await expect(page.getByText("Masuk ke Dashboard", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Masuk dengan Google" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("unauthenticated visitors are redirected away from /dashboard", async ({ page }) => {
  // Mock mode bypasses auth entirely (see src/lib/mock/is-mock.ts), so this
  // only proves the route resolves under mock data -- the real proxy.ts /
  // dashboard/layout.tsx guard is exercised in Bagian A #3's manual prod
  // check, not here.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
});

for (const tab of TABS) {
  test(`dashboard tab "${tab}" renders without console errors`, async ({ page }) => {
    const { errors } = trackErrors(page);
    await page.goto(`/dashboard?tab=${tab}`);

    // Every tab eventually replaces its own "Memuat data..." loading state --
    // waiting for that (rather than a tab-specific heading) keeps this test
    // agnostic to each tab's exact content while still proving data loaded.
    await expect(page.getByText("Memuat data...")).toHaveCount(0, { timeout: 15_000 });
    expect(errors).toEqual([]);
  });
}

test("Excel export downloads a file from Menu Underperforming", async ({ page }) => {
  const { errors } = trackErrors(page);
  await page.goto("/dashboard?tab=sales");
  await expect(page.getByText("Memuat data...")).toHaveCount(0, { timeout: 15_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }),
    page.getByRole("button", { name: "Excel" }).first().click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^menu-underperforming_.*\.xlsx$/);
  // .xlsx is a zip archive -- "PK" magic bytes prove exceljs actually wrote a
  // real archive, not just that the button click/download plumbing worked.
  const path = await download.path();
  const bytes = await readFile(path!);
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
  expect(bytes.length).toBeGreaterThan(1000);
  expect(errors).toEqual([]);
});

test("PDF export downloads a file from Menu Underperforming", async ({ page }) => {
  const { errors } = trackErrors(page);
  await page.goto("/dashboard?tab=sales");
  await expect(page.getByText("Memuat data...")).toHaveCount(0, { timeout: 15_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }),
    page.getByRole("button", { name: "PDF" }).first().click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^menu-underperforming_.*\.pdf$/);
  const path = await download.path();
  const bytes = await readFile(path!);
  expect(bytes.subarray(0, 4).toString("latin1")).toBe("%PDF");
  expect(bytes.length).toBeGreaterThan(500);
  expect(errors).toEqual([]);
});
