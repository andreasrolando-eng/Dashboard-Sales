// ESB OMS "Master Menu - Get Menu" (GET /corev1/master/get-menu). Only the
// fields this function reads are typed; the response carries many more.
export interface EsbMenuRecord {
  menuID: number;
  menuCode?: string | null;
  menuName?: string | null;
  bomID?: number | null; // 0 = menu has no BOM
  bomName?: string | null;
  categoryDetail?: string | null;
  flagActive?: number | null;
  menuPackages?: { menuGroup?: unknown[] | null } | null;
}

export interface EsbGetMenuBody {
  status?: string;
  result?: { page?: string | number; limit?: number; count?: number; data?: EsbMenuRecord[] } | null;
}

// ESB Core "Get bill of material detail lines" (GET /product/bom/detail/{bomID}).
// Numbers are passed through untouched (never Number()-converted) so whatever
// precision ESB sent reaches Postgres NUMERIC as-is.
export interface EsbBomLineRecord {
  ID: number;
  bomID?: number;
  productID?: number | null;
  productCode?: string | null;
  productName?: string | null;
  qty?: number | string | null;
  uomName?: string | null;
  convertionQty?: number | string | null;
  yieldPercent?: number | string | null;
  tolerancePercent?: number | string | null;
  weightFactor?: number | string | null;
  lastHpp?: number | string | null;
  subtitution?: unknown[] | null;
}

// Payload shapes for fn_hpp_publish (see supabase/migrations/20261013090000_menu_hpp.sql).
export interface MenuRow {
  menu_id: number;
  menu_code: string | null;
  menu_name: string | null;
  bom_id: number | null;
  bom_name: string | null;
  category_detail: string | null;
  flag_active: number | null;
  is_package: boolean;
}

export interface BomLineRow {
  bom_id: number;
  line_id: number;
  product_id: number | null;
  product_code: string | null;
  product_name: string | null;
  qty: number | string | null;
  uom_name: string | null;
  convertion_qty: number | string | null;
  yield_percent: number | string | null;
  tolerance_percent: number | string | null;
  weight_factor: number | string | null;
  last_hpp: number | string | null;
  substitutions: unknown[];
}

export interface BomFailure {
  bomId: number;
  error: string;
}
