"use client";

import { useQuery } from "@tanstack/react-query";
import { ALL_CATEGORIES, ALL_CATEGORY_DETAILS, useDashboardFilters } from "@/lib/use-dashboard-filters";
import { getMenuPerformance, getProductAggregates, getSalesHourlyOutlet } from "@/lib/queries/sales";
import { getPromoPerformance } from "@/lib/queries/marketing";
import { groupByHour } from "@/lib/aggregate";
import { fmtNum } from "@/lib/format";
import { buildActionRecommendations, buildMenuRecommendations } from "@/lib/recommendations";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard } from "@/components/ui/chart-card";
import { Badge } from "@/components/ui/badge";

const MARKETING_THRESHOLD = 300;

export function MarketingTab() {
  const { outlet, dateStart, dateEnd } = useDashboardFilters();

  const promoQuery = useQuery({
    queryKey: ["promo-performance", outlet, dateStart, dateEnd],
    queryFn: () => getPromoPerformance(dateStart, dateEnd, outlet),
  });
  const productsQuery = useQuery({
    queryKey: ["product-aggregates", outlet, ALL_CATEGORIES, ALL_CATEGORY_DETAILS, dateStart, dateEnd],
    queryFn: () => getProductAggregates(dateStart, dateEnd, outlet, ALL_CATEGORIES, ALL_CATEGORY_DETAILS),
  });
  const menuPerfQuery = useQuery({
    queryKey: ["menu-performance", outlet, ALL_CATEGORIES, ALL_CATEGORY_DETAILS, dateStart, dateEnd, MARKETING_THRESHOLD],
    queryFn: () => getMenuPerformance(dateStart, dateEnd, outlet, ALL_CATEGORIES, ALL_CATEGORY_DETAILS, MARKETING_THRESHOLD),
  });
  const hourlyQuery = useQuery({
    queryKey: ["sales-hourly", outlet, dateStart, dateEnd],
    queryFn: () => getSalesHourlyOutlet(dateStart, dateEnd, outlet),
  });

  if (!promoQuery.data || !productsQuery.data || !menuPerfQuery.data || !hourlyQuery.data) {
    return <div className="text-sm text-text-secondary">Memuat data...</div>;
  }

  const promos = promoQuery.data;
  const totalRedemption = promos.reduce((a, p) => a + p.redemptions, 0);
  const bestPromo = [...promos].sort((a, b) => (b.lift_pct ?? 0) - (a.lift_pct ?? 0))[0];
  const worstRedemptionPromo = [...promos].sort((a, b) => a.redemptions - b.redemptions)[0];
  const topUpsellPromos = [...promos].sort((a, b) => (b.lift_pct ?? 0) - (a.lift_pct ?? 0)).slice(0, 3);
  const leastUsedPromos = [...promos].sort((a, b) => a.redemptions - b.redemptions).slice(0, 3);

  const bestSeller = [...productsQuery.data].sort((a, b) => b.revenue - a.revenue)[0];
  const worstMenu = menuPerfQuery.data[0];
  const quietestHours = [...groupByHour(hourlyQuery.data)]
    .sort((a, b) => a.revenue - b.revenue)
    .slice(0, 2)
    .map((h) => `${h.hour}:00`);

  const actionRecommendations = buildActionRecommendations({
    bestSeller,
    worstMenu,
    promoPerformance: promos,
    quietestHours,
  });
  const menuRecommendations = buildMenuRecommendations(menuPerfQuery.data);

  return (
    <>
      <div className="bg-surface border border-dashed border-[oklch(85%_0.005_260)] rounded-[14px] px-6 py-5 text-center mb-5">
        <div className="text-[13px] text-text-secondary max-w-[560px] mx-auto">
          Campaign reach &amp; CTR dari ad platform belum terhubung ke API ESB. Analisa promo &amp; menu di bawah dihitung dari
          data redemption transaksi yang sudah tercatat.
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 lg:gap-5 mb-5">
        <KpiCard label="Total Redemption" value={fmtNum(totalRedemption)} delta="seluruh promo aktif" deltaColor="#2563eb" />
        <KpiCard
          label="Promo Terbaik"
          value={bestPromo?.promotion_name ?? "-"}
          delta={bestPromo ? `+${bestPromo.lift_pct ?? 0}% upsell` : undefined}
          deltaColor="#16a34a"
        />
        <KpiCard
          label="Promo Perlu Ditinjau"
          value={worstRedemptionPromo?.promotion_name ?? "-"}
          delta="redemption terendah"
          deltaColor="#dc2626"
        />
      </div>

      <div className="bg-surface border border-border rounded-[14px] p-5 mb-4 overflow-x-auto">
        <div className="text-sm font-bold text-text mb-3.5">Efektivitas Promo (Lift vs Baseline &amp; ROI)</div>
        <div className="min-w-[520px]">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] text-[11px] font-semibold text-text-secondary pb-2.5 px-1 border-b border-border-subtle">
            <div>Promo</div>
            <div>Redemption</div>
            <div>Lift</div>
            <div>ROI</div>
            <div>Status</div>
          </div>
          {promos.map((p) => (
            <div
              key={p.promotion_id}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] text-[13px] py-2.5 px-1 border-b border-border-hairline items-center"
            >
              <div className="font-semibold text-text">{p.promotion_name}</div>
              <div>{fmtNum(p.redemptions)}</div>
              <div>
                {(p.lift_pct ?? 0) >= 0 ? "+" : ""}
                {p.lift_pct ?? 0}%
              </div>
              <div>{p.roi ?? 0}x</div>
              <div>
                {p.status === "Efektif" ? (
                  <Badge bg="oklch(93% 0.05 150)" color="#16a34a">
                    Efektif
                  </Badge>
                ) : (
                  <Badge bg="oklch(93% 0.04 25)" color="#dc2626">
                    Kurang Efektif
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4 lg:gap-5 mb-4">
        <ChartCard title="Promo Paling Banyak Upsell">
          <div>
            {topUpsellPromos.map((p) => (
              <div key={p.promotion_id} className="flex justify-between items-center py-2.5 border-b border-border-faint last:border-b-0">
                <div>
                  <div className="text-[13px] font-semibold text-text">{p.promotion_name}</div>
                  <div className="text-[11px] text-text-tertiary">{fmtNum(p.redemptions)} redemption</div>
                </div>
                <div className="text-[13px] font-bold text-positive">
                  {(p.lift_pct ?? 0) >= 0 ? "+" : ""}
                  {p.lift_pct ?? 0}%
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Promo Jarang Dipakai">
          <div>
            {leastUsedPromos.map((p) => (
              <div key={p.promotion_id} className="flex justify-between items-center py-2.5 border-b border-border-faint last:border-b-0">
                <div>
                  <div className="text-[13px] font-semibold text-text">{p.promotion_name}</div>
                  <div className="text-[11px] text-text-tertiary">
                    {(p.lift_pct ?? 0) >= 0 ? "+" : ""}
                    {p.lift_pct ?? 0}% upsell
                  </div>
                </div>
                <div className="text-[13px] font-bold text-negative">{fmtNum(p.redemptions)} redemption</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="bg-surface border border-border rounded-[14px] p-5 mb-4">
        <div className="text-sm font-bold text-text mb-1">Rekomendasi Promo Ke Depan</div>
        <div className="text-xs text-text-secondary mb-3.5">Rule-based dari pola data historis (bukan prediksi ML)</div>
        {actionRecommendations.map((r, i) => (
          <div key={i} className="flex gap-3 items-start py-3 border-b border-border-faint last:border-b-0">
            <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-accent-soft-strong text-accent whitespace-nowrap">
              {r.type}
            </span>
            <div className="text-[13px] text-[oklch(30%_0.01_260)]">{r.text}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-[14px] p-5">
        <div className="text-sm font-bold text-text mb-1">Rekomendasi Menu &amp; Promo</div>
        <div className="text-xs text-text-secondary mb-3.5">Berdasarkan volume penjualan menu terendah (slow moving)</div>
        {menuRecommendations.map((r) => (
          <div key={r.menu_id} className="flex flex-wrap justify-between gap-2.5 items-center py-3 border-b border-border-faint last:border-b-0">
            <div>
              <div className="text-[13px] font-semibold text-text">{r.name}</div>
              <div className="text-[11px] text-text-tertiary">
                {r.category} · {fmtNum(r.qty)} terjual/periode
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md"
                style={
                  r.action === "Pertimbangkan Takeout"
                    ? { background: "oklch(93% 0.04 25)", color: "#dc2626" }
                    : { background: "oklch(93% 0.04 255)", color: "#2563eb" }
                }
              >
                {r.action}
              </span>
              <div className="text-xs text-[oklch(40%_0.01_260)]">{r.suggestedPromo}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
