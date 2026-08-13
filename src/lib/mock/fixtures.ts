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

export const PRODUCTS = [
  { menu_id: "P1", menu_name: "Iced Kopi Susu", category: "Minuman", basePrice: 15000, baseQty: 95 },
  { menu_id: "P2", menu_name: "Nasi Goreng Spesial", category: "Makanan", basePrice: 30000, baseQty: 64 },
  { menu_id: "P3", menu_name: "Ayam Geprek", category: "Makanan", basePrice: 25000, baseQty: 74 },
  { menu_id: "P4", menu_name: "Choco Lava Cake", category: "Dessert", basePrice: 20000, baseQty: 45 },
  { menu_id: "P5", menu_name: "Mineral Water", category: "Minuman", basePrice: 3000, baseQty: 103 },
  { menu_id: "P6", menu_name: "Kentang Goreng", category: "Snack", basePrice: 10000, baseQty: 14 },
  { menu_id: "P7", menu_name: "Puding Taro", category: "Dessert", basePrice: 15000, baseQty: 9 },
  { menu_id: "P8", menu_name: "Salad Buah", category: "Snack", basePrice: 15000, baseQty: 6 },
  { menu_id: "P9", menu_name: "Teh Tarik", category: "Minuman", basePrice: 8000, baseQty: 83 },
  { menu_id: "P10", menu_name: "Sate Ayam", category: "Makanan", basePrice: 25000, baseQty: 52 },
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
