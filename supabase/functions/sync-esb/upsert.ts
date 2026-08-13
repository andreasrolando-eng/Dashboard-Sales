import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { OutletRow, RawSaleRow, RawSalesMenuItemRow, RawSalesPaymentRow, TransformedBatch } from "./transform.ts";

const BATCH_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function upsertBatched<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  rows: T[],
  onConflict: string
): Promise<number> {
  let count = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    if (batch.length === 0) continue;
    const { error, count: batchCount } = await client
      .from(table)
      .upsert(batch, { onConflict, count: "exact" });
    if (error) throw new Error(`Upsert failed for ${table}: ${error.message}`);
    count += batchCount ?? batch.length;
  }
  return count;
}

export async function upsertOutlets(client: SupabaseClient, rows: OutletRow[]): Promise<number> {
  return upsertBatched(client, "outlets", rows, "branch_code");
}

export async function upsertSales(client: SupabaseClient, rows: RawSaleRow[]): Promise<number> {
  return upsertBatched(client, "raw_sales", rows, "sales_num");
}

export async function upsertPayments(client: SupabaseClient, rows: RawSalesPaymentRow[]): Promise<number> {
  return upsertBatched(client, "raw_sales_payments", rows, "sales_num,sales_payment_backend_id");
}

export async function upsertMenuItems(client: SupabaseClient, rows: RawSalesMenuItemRow[]): Promise<number> {
  // Conflict key is (sales_num, line_seq), NOT menu_id/batch_id -- see
  // migration 20260813100000_fix_menu_items_key.sql for why.
  return upsertBatched(client, "raw_sales_menu_items", rows, "sales_num,line_seq");
}

export interface UpsertResult {
  outlets: number;
  sales: number;
  payments: number;
  menuItems: number;
}

/**
 * Order matters: outlets first (raw_sales.branch_code FKs to it), then
 * sales (raw_sales_payments/raw_sales_menu_items FK to sales_num).
 */
export async function upsertBatch(client: SupabaseClient, batch: TransformedBatch): Promise<UpsertResult> {
  const outlets = await upsertOutlets(client, batch.outlets);
  const sales = await upsertSales(client, batch.sales);
  const payments = await upsertPayments(client, batch.payments);
  const menuItems = await upsertMenuItems(client, batch.menuItems);
  return { outlets, sales, payments, menuItems };
}
