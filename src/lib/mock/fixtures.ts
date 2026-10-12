// Dev-only fixture data, shaped like real query results (see is-mock.ts).
// Categories here are the human-readable Indonesian labels used in the
// design reference (for easy visual comparison against the screenshots) --
// the real schema uses dynamic ESB menuCategoryName values instead, see
// v_categories in the sales_views migration.

export const OUTLETS = [
  { branch_code: "SNY", branch_name: "Outlet Senayan" },
  { branch_code: "KMG", branch_name: "Outlet Kemang" },
  { branch_code: "PIK", branch_name: "Outlet PIK" },
  { branch_code: "BDG", branch_name: "Outlet Bandung" },
  { branch_code: "SBY", branch_name: "Outlet Surabaya" },
];

// category_id/category_detail_id are the filter keys (mirror ESB
// menuCategoryID/menuCategoryDetailID); category/category_detail are just
// the display labels for those IDs, same split as
// v_categories/v_category_details/v_sales_product_daily.
export const PRODUCTS = [
  { menu_id: "P1", menu_name: "Iced Kopi Susu", category_id: "C-MIN", category: "Minuman", category_detail_id: "D-KOPI", category_detail: "Kopi", basePrice: 15000, baseQty: 95 },
  { menu_id: "P2", menu_name: "Nasi Goreng Spesial", category_id: "C-MKN", category: "Makanan", category_detail_id: "D-NASGOR", category_detail: "Nasi Goreng", basePrice: 30000, baseQty: 64 },
  { menu_id: "P3", menu_name: "Ayam Geprek", category_id: "C-MKN", category: "Makanan", category_detail_id: "D-AYAM", category_detail: "Ayam", basePrice: 25000, baseQty: 74 },
  { menu_id: "P4", menu_name: "Choco Lava Cake", category_id: "C-DES", category: "Dessert", category_detail_id: "D-CAKE", category_detail: "Cake", basePrice: 20000, baseQty: 45 },
  { menu_id: "P5", menu_name: "Mineral Water", category_id: "C-MIN", category: "Minuman", category_detail_id: "D-AIR", category_detail: "Air Mineral", basePrice: 3000, baseQty: 103 },
  { menu_id: "P6", menu_name: "Kentang Goreng", category_id: "C-SNK", category: "Snack", category_detail_id: "D-GORENGAN", category_detail: "Gorengan", basePrice: 10000, baseQty: 14 },
  { menu_id: "P7", menu_name: "Puding Taro", category_id: "C-DES", category: "Dessert", category_detail_id: "D-PUDING", category_detail: "Puding", basePrice: 15000, baseQty: 9 },
  { menu_id: "P8", menu_name: "Salad Buah", category_id: "C-SNK", category: "Snack", category_detail_id: "D-SALAD", category_detail: "Salad", basePrice: 15000, baseQty: 6 },
  { menu_id: "P9", menu_name: "Teh Tarik", category_id: "C-MIN", category: "Minuman", category_detail_id: "D-TEH", category_detail: "Teh", basePrice: 8000, baseQty: 83 },
  { menu_id: "P10", menu_name: "Sate Ayam", category_id: "C-MKN", category: "Makanan", category_detail_id: "D-AYAM", category_detail: "Ayam", basePrice: 25000, baseQty: 52 },
];

export const MEMBERS = [
  { member_code: "M1", member_name: "Andi Wijaya", branch_code: "SNY", tier: "Gold" },
  { member_code: "M2", member_name: "Siti Rahma", branch_code: "PIK", tier: "Gold" },
  { member_code: "M3", member_name: "Budi Santoso", branch_code: "KMG", tier: "Silver" },
  { member_code: "M4", member_name: "Dewi Lestari", branch_code: "SNY", tier: "Silver" },
  { member_code: "M5", member_name: "Rian Pratama", branch_code: "BDG", tier: "Silver" },
  { member_code: "M6", member_name: "Maya Putri", branch_code: "SBY", tier: "Silver" },
  { member_code: "M7", member_name: "Fajar Nugraha", branch_code: "PIK", tier: "Bronze" },
  { member_code: "M8", member_name: "Lina Marlina", branch_code: "KMG", tier: "Bronze" },
];

export const PROMOTIONS = [
  { promotion_id: "PR1", promotion_name: "Buy 1 Get 1 Kopi", redemptionsPerDay: 42 },
  { promotion_id: "PR2", promotion_name: "Paket Hemat Nasi Goreng", redemptionsPerDay: 29 },
  { promotion_id: "PR3", promotion_name: "Diskon 20% Dessert", redemptionsPerDay: 14 },
  { promotion_id: "PR4", promotion_name: "Gratis Ongkir Delivery", redemptionsPerDay: 13 },
  { promotion_id: "PR5", promotion_name: "Bundling Snack + Minuman", redemptionsPerDay: 5 },
  { promotion_id: "PR6", promotion_name: "Member Day Diskon 15%", redemptionsPerDay: 3 },
  { promotion_id: "PR7", promotion_name: "Flash Sale Jam Sepi", redemptionsPerDay: 2 },
];

export const PEAK_HOURS = [
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
];
const PEAK_HOUR_WEIGHT: Record<number, number> = {
  10: 0.2, 11: 0.3, 12: 0.55, 13: 0.65, 14: 0.45, 15: 0.25, 16: 0.2,
  17: 0.28, 18: 0.42, 19: 0.85, 20: 1, 21: 0.6, 22: 0.22,
};

// Channel/payment-method labels and weights mirror real distributions seen
// in the live ESB data (visit_purpose_name/payment_method_type_name), 27
// Aug 2026 -- see supabase/migrations/20260828090000_ops_analytics.sql.
export const CHANNELS = [
  { channel: "Dine In", weight: 0.79 },
  { channel: "Pick Up", weight: 0.15 },
  { channel: "Delivery", weight: 0.06 },
];

export const PAYMENT_METHODS = [
  { payment_method_type_name: "CARD", weight: 0.7 },
  { payment_method_type_name: "VOUCHER", weight: 0.16 },
  { payment_method_type_name: "CASH", weight: 0.09 },
  { payment_method_type_name: "MEMBER DEPOSIT", weight: 0.04 },
  { payment_method_type_name: "BANK", weight: 0.01 },
];

/** Deterministic pseudo-random in [0,1), seeded so mock data is stable across renders. */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start);
  const last = new Date(end);
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export { PEAK_HOUR_WEIGHT };

/**
 * Mock BOMs keyed by PRODUCTS.menu_id, for the HPP / ingredient-usage panels.
 * P5 has no BOM, and P8 has an ingredient with no lastHpp (incomplete cost),
 * so every status the panels render shows up in mock mode too.
 */
export const MOCK_BOMS: Record<
  string,
  { bom_id: number; lines: { product_id: number; product_code: string; product_name: string; qty: number; uom_name: string; last_hpp: number | null; substitute?: string }[] }
> = {
  P1: { bom_id: 501, lines: [
    { product_id: 9001, product_code: "RM-KOPI", product_name: "Biji Kopi Arabika", qty: 18, uom_name: "gr", last_hpp: 180, substitute: "Biji Kopi Robusta" },
    { product_id: 9002, product_code: "RM-SUSU", product_name: "Susu UHT", qty: 150, uom_name: "ml", last_hpp: 18 },
    { product_id: 9003, product_code: "RM-GULA", product_name: "Gula Aren Cair", qty: 20, uom_name: "ml", last_hpp: 25 },
    { product_id: 9004, product_code: "PK-CUP", product_name: "Cup Plastik 16oz", qty: 1, uom_name: "pcs", last_hpp: 900 },
  ] },
  P2: { bom_id: 502, lines: [
    { product_id: 9010, product_code: "RM-BERAS", product_name: "Beras", qty: 200, uom_name: "gr", last_hpp: 14 },
    { product_id: 9011, product_code: "RM-TELUR", product_name: "Telur Ayam", qty: 1, uom_name: "pcs", last_hpp: 2200 },
    { product_id: 9012, product_code: "RM-AYAM", product_name: "Daging Ayam", qty: 60, uom_name: "gr", last_hpp: 45 },
    { product_id: 9013, product_code: "RM-MINYAK", product_name: "Minyak Goreng", qty: 15, uom_name: "ml", last_hpp: 17 },
  ] },
  P3: { bom_id: 503, lines: [
    { product_id: 9012, product_code: "RM-AYAM", product_name: "Daging Ayam", qty: 150, uom_name: "gr", last_hpp: 45 },
    { product_id: 9013, product_code: "RM-MINYAK", product_name: "Minyak Goreng", qty: 40, uom_name: "ml", last_hpp: 17 },
    { product_id: 9014, product_code: "RM-CABAI", product_name: "Cabai Rawit", qty: 25, uom_name: "gr", last_hpp: 60 },
    { product_id: 9010, product_code: "RM-BERAS", product_name: "Beras", qty: 180, uom_name: "gr", last_hpp: 14 },
  ] },
  P4: { bom_id: 504, lines: [
    { product_id: 9020, product_code: "RM-COKLAT", product_name: "Dark Chocolate", qty: 40, uom_name: "gr", last_hpp: 120 },
    { product_id: 9021, product_code: "RM-TEPUNG", product_name: "Tepung Terigu", qty: 30, uom_name: "gr", last_hpp: 12 },
    { product_id: 9011, product_code: "RM-TELUR", product_name: "Telur Ayam", qty: 1, uom_name: "pcs", last_hpp: 2200 },
  ] },
  P6: { bom_id: 506, lines: [
    { product_id: 9030, product_code: "RM-KENTANG", product_name: "Kentang Beku", qty: 150, uom_name: "gr", last_hpp: 28 },
    { product_id: 9013, product_code: "RM-MINYAK", product_name: "Minyak Goreng", qty: 30, uom_name: "ml", last_hpp: 17 },
  ] },
  P7: { bom_id: 507, lines: [
    { product_id: 9031, product_code: "RM-TARO", product_name: "Bubuk Taro", qty: 25, uom_name: "gr", last_hpp: 95 },
    { product_id: 9002, product_code: "RM-SUSU", product_name: "Susu UHT", qty: 100, uom_name: "ml", last_hpp: 18 },
  ] },
  P8: { bom_id: 508, lines: [
    { product_id: 9040, product_code: "RM-BUAH", product_name: "Buah Campur", qty: 200, uom_name: "gr", last_hpp: 30 },
    { product_id: 9041, product_code: "RM-MAYO", product_name: "Mayones", qty: 30, uom_name: "gr", last_hpp: null },
  ] },
  P9: { bom_id: 509, lines: [
    { product_id: 9050, product_code: "RM-TEH", product_name: "Teh Hitam", qty: 8, uom_name: "gr", last_hpp: 110 },
    { product_id: 9051, product_code: "RM-SKM", product_name: "Susu Kental Manis", qty: 40, uom_name: "gr", last_hpp: 32 },
    { product_id: 9004, product_code: "PK-CUP", product_name: "Cup Plastik 16oz", qty: 1, uom_name: "pcs", last_hpp: 900 },
  ] },
  P10: { bom_id: 510, lines: [
    { product_id: 9012, product_code: "RM-AYAM", product_name: "Daging Ayam", qty: 120, uom_name: "gr", last_hpp: 45 },
    { product_id: 9052, product_code: "RM-KACANG", product_name: "Saus Kacang", qty: 50, uom_name: "gr", last_hpp: 40 },
  ] },
};
