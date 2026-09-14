"use client";

import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { FilterBar } from "@/components/layout/filter-bar";
import { useDashboardFilters } from "@/lib/use-dashboard-filters";
import { OverviewTab } from "@/components/tabs/overview-tab";
import { SalesTab } from "@/components/tabs/sales-tab";
import { OpsTab } from "@/components/tabs/ops-tab";
import { MembershipTab } from "@/components/tabs/membership-tab";
import { MarketingTab } from "@/components/tabs/marketing-tab";

function DashboardContent() {
  const { tab } = useDashboardFilters();

  return (
    <>
      <Header />
      <FilterBar />
      {tab === "overview" && <OverviewTab />}
      {tab === "sales" && <SalesTab />}
      {tab === "ops" && <OpsTab />}
      {tab === "membership" && <MembershipTab />}
      {tab === "marketing" && <MarketingTab />}
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
