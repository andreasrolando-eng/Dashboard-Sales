import type { EsbCoreClient } from "../_shared/esb-core-client.ts";
import type { BomLineRow, EsbBomLineRecord } from "./types.ts";

/**
 * GET /product/bom/detail/{bomID}, mapped to fn_hpp_publish's line shape. An
 * empty result is an error -- a BOM with an id but no lines is never
 * published as "costs nothing".
 */
export async function fetchBomLines(core: EsbCoreClient, bomId: number): Promise<BomLineRow[]> {
  const result = await core.get<EsbBomLineRecord[]>(`/product/bom/detail/${encodeURIComponent(String(bomId))}`);
  if (!Array.isArray(result)) throw new Error("unexpected body (result is not an array)");
  if (result.length === 0) throw new Error("BOM has no detail lines");

  // Keyed by line ID: the publish step's primary key is (date, bom, line).
  const byLine = new Map<number, BomLineRow>();
  for (const l of result) {
    if (l.ID == null) throw new Error("detail line without ID");
    byLine.set(l.ID, {
      bom_id: bomId,
      line_id: l.ID,
      product_id: l.productID ?? null,
      product_code: l.productCode ?? null,
      product_name: l.productName ?? null,
      qty: l.qty ?? null,
      uom_name: l.uomName ?? null,
      convertion_qty: l.convertionQty ?? null,
      yield_percent: l.yieldPercent ?? null,
      tolerance_percent: l.tolerancePercent ?? null,
      weight_factor: l.weightFactor ?? null,
      last_hpp: l.lastHpp ?? null,
      substitutions: Array.isArray(l.subtitution) ? l.subtitution : [],
    });
  }
  return [...byLine.values()];
}
