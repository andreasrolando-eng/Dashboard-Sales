// FR-30-32: rule-based recommendations (explicitly not ML) derived from
// already-fetched query results -- no extra SQL needed, mirrors the design
// reference's actionRecommendations/menuRecommendations logic almost 1:1.

import type { ProductAgg } from "@/lib/queries/sales";
import type { Database } from "@/types/database.types";

type MenuPerfRow = Database["public"]["Functions"]["fn_menu_performance"]["Returns"][number];
type PromoPerfRow = Database["public"]["Functions"]["fn_promo_performance"]["Returns"][number];

export interface ActionRecommendation {
  type: string;
  text: string;
}

const PROMO_SUGGESTION_BY_CATEGORY: Record<string, string> = {
  Minuman: "Bundling dengan menu utama",
  Makanan: "Paket combo diskon jam sepi",
  Dessert: "Diskon dessert after 8PM",
  Snack: "Cross-sell add-on saat checkout",
};

const DEFAULT_PROMO_SUGGESTION = "Bundling lintas kategori";

export function buildActionRecommendations(params: {
  bestSeller: ProductAgg | undefined;
  worstMenu: MenuPerfRow | undefined;
  promoPerformance: PromoPerfRow[];
  quietestHours: string[];
}): ActionRecommendation[] {
  const { bestSeller, worstMenu, promoPerformance, quietestHours } = params;
  const recommendations: ActionRecommendation[] = [];

  if (bestSeller && worstMenu) {
    recommendations.push({
      type: "Bundling",
      text: `Bundling "${bestSeller.menu_name}" (laris) dengan "${worstMenu.menu_name}" (slow moving) untuk mendorong penjualan menu yang jarang dibeli.`,
    });
  }

  const worstPromo = [...promoPerformance]
    .filter((p) => p.status === "Kurang Efektif")
    .sort((a, b) => (a.roi ?? 0) - (b.roi ?? 0))[0];
  if (worstPromo) {
    recommendations.push({
      type: "Hentikan/Revisi Promo",
      text: `Promo "${worstPromo.promotion_name}" punya ROI terendah (${worstPromo.roi ?? 0}x) dan lift hanya ${
        (worstPromo.lift_pct ?? 0) >= 0 ? "+" : ""
      }${worstPromo.lift_pct ?? 0}% -- pertimbangkan hentikan atau revisi mekanismenya.`,
    });
  }

  if (quietestHours.length > 0) {
    recommendations.push({
      type: "Waktu Promosi",
      text: `Buat promo flash sale pada jam sepi (${quietestHours.join(" & ")}) untuk mendorong transaksi di luar jam ramai.`,
    });
  }

  return recommendations;
}

export interface MenuRecommendation {
  menu_id: string;
  name: string;
  category: string;
  qty: number;
  action: "Pertimbangkan Takeout" | "Pertahankan + Promo";
  suggestedPromo: string;
}

const LOW_VOLUME_THRESHOLD = 300;

/** Bottom 4 menus by qty (menuPerformance already sorted ascending by qty). */
export function buildMenuRecommendations(menuPerformance: MenuPerfRow[]): MenuRecommendation[] {
  return menuPerformance.slice(0, 4).map((m) => {
    const takeout = m.qty < LOW_VOLUME_THRESHOLD;
    return {
      menu_id: m.menu_id,
      name: m.menu_name ?? m.menu_id,
      category: m.category ?? "-",
      qty: m.qty,
      action: takeout ? "Pertimbangkan Takeout" : "Pertahankan + Promo",
      suggestedPromo: (m.category && PROMO_SUGGESTION_BY_CATEGORY[m.category]) || DEFAULT_PROMO_SUGGESTION,
    };
  });
}
