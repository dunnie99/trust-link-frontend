"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo,useState } from "react";
import { useTranslation } from "react-i18next";

import { getVendorAnalytics, type VendorAnalyticsResponse } from "@/lib/api";

const VendorAnalyticsChart = dynamic(
  () => import("./VendorAnalyticsChart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[250px] w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900/50" />
    ),
  }
);

export default function DashboardAnalyticsSummary() {
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState<VendorAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const syncBreakpoint = () => setIsMobile(mediaQuery.matches);
    syncBreakpoint();
    mediaQuery.addEventListener("change", syncBreakpoint);
    return () => mediaQuery.removeEventListener("change", syncBreakpoint);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function fetchAnalytics() {
      const token = window.localStorage.getItem("wallet.jwt");
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const data = await getVendorAnalytics(token);
        if (mounted) setAnalytics(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    fetchAnalytics();
    return () => {
      mounted = false;
    };
  }, []);

  const chartData = useMemo(() => {
    return analytics?.dataPoints ?? [];
  }, [analytics]);

  if (isLoading) {
    return <div className="h-[250px] w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900/50" />;
  }

  if (chartData.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        {t("dashboard.analyticsPage.noData")}
      </div>
    );
  }

  return (
    <div className="h-[250px] w-full">
      <VendorAnalyticsChart dataPoints={chartData} isMobile={isMobile} />
    </div>
  );
}
