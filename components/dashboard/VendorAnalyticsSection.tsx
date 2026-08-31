"use client";

import {
  ArrowLeft,
  BarChart3,
  Clock3,
  ShieldAlert,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getVendorAnalytics, type VendorAnalyticsPoint, type VendorAnalyticsResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatUSDC } from "@/utils/currency";

import VendorAnalyticsSkeleton from "./VendorAnalyticsSkeleton";

const VendorAnalyticsChart = dynamic(
  () => import("./VendorAnalyticsChart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse rounded-[1.75rem] bg-zinc-100 dark:bg-zinc-900/50" />
    ),
  }
);

function formatRate(value: number): string {
  return `${value.toFixed(1)}%`;
}

function normalizeRate(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return value <= 1 ? value * 100 : value;
}

function pickMetrics(source: VendorAnalyticsResponse | null, points: VendorAnalyticsPoint[]) {
  const latestPoint = points.at(-1);
  const pointAverage = points.length > 0
    ? points.reduce((sum, point) => sum + point.averageOrderValue, 0) / points.length
    : 0;
  const pointVolume = points.reduce((sum, point) => sum + point.transactionVolume, 0);

  return {
    totalTransactionVolume: source?.totalTransactionVolume ?? pointVolume,
    averageOrderValue: source?.averageOrderValue ?? latestPoint?.averageOrderValue ?? pointAverage,
    completionRate: normalizeRate(source?.completionRate ?? latestPoint?.completionRate),
    disputeRate: normalizeRate(source?.disputeRate ?? latestPoint?.disputeRate),
  };
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">{value}</p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{hint}</p>
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", tone)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function VendorAnalyticsSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<VendorAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

    async function loadAnalytics() {
      const token = window.localStorage.getItem("wallet.jwt");
      if (!token) {
        router.push("/");
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const data = await getVendorAnalytics(token);
        if (mounted) {
          setAnalytics(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : t("dashboard.analyticsPage.loadError"));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      mounted = false;
    };
  }, [router, t]);

  const chartData = useMemo(() => {
    return analytics?.dataPoints ?? [];
  }, [analytics]);

  const metrics = pickMetrics(analytics, chartData);
  const periodLabel = analytics?.periodLabel ?? t("dashboard.analyticsPage.defaultPeriod");
  const generatedAt = analytics?.generatedAt
    ? new Date(analytics.generatedAt).toLocaleString()
    : null;

  if (isLoading) {
    return <VendorAnalyticsSkeleton />;
  }

  if (error) {
    return (
      <main className="analytics-page-background min-h-screen p-4 pb-24 sm:p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <Link
            href="/dashboard"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
            <p className="text-lg font-semibold">{t("dashboard.analyticsPage.loadErrorTitle")}</p>
            <p className="mt-2 text-sm text-rose-700 dark:text-rose-200">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              {t("dashboard.analyticsPage.retry")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="analytics-page-background min-h-screen p-4 pb-24 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Link
              href="/dashboard"
              className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                <BarChart3 className="h-3.5 w-3.5" />
                {t("dashboard.analyticsPage.badge")}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
                {t("dashboard.analyticsPage.title")}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400 sm:text-base">
                {t("dashboard.analyticsPage.description", { period: periodLabel.toLowerCase() })}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <div className="flex items-center gap-2 font-medium text-zinc-950 dark:text-white">
              <Clock3 className="h-4 w-4 text-[var(--accent)]" />
              {periodLabel}
            </div>
            {generatedAt ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("dashboard.analyticsPage.updated", { date: generatedAt })}</p> : null}
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t("dashboard.analyticsPage.totalTransactionVolume")}
            value={formatUSDC(metrics.totalTransactionVolume)}
            hint={t("dashboard.analyticsPage.totalTransactionVolumeHint")}
            icon={<TrendingUp className="h-5 w-5 text-brand-primary dark:text-brand-primary-dark" />}
            tone="bg-blue-50 dark:bg-blue-500/10"
          />
          <MetricCard
            label={t("dashboard.analyticsPage.averageOrderValue")}
            value={formatUSDC(metrics.averageOrderValue)}
            hint={t("dashboard.analyticsPage.averageOrderValueHint")}
            icon={<ShoppingBag className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
            tone="bg-emerald-50 dark:bg-emerald-500/10"
          />
          <MetricCard
            label={t("dashboard.analyticsPage.completionRate")}
            value={formatRate(metrics.completionRate)}
            hint={t("dashboard.analyticsPage.completionRateHint")}
            icon={<BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
            tone="bg-amber-50 dark:bg-amber-500/10"
          />
          <MetricCard
            label={t("dashboard.analyticsPage.disputeRate")}
            value={formatRate(metrics.disputeRate)}
            hint={t("dashboard.analyticsPage.disputeRateHint")}
            icon={<ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
            tone="bg-rose-50 dark:bg-rose-500/10"
          />
        </section>

        <section className="rounded-[2rem] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">{t("dashboard.analyticsPage.trendTitle")}</h2>
              <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                {t("dashboard.analyticsPage.trendDescription")}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-brand-primary" />
              {t("dashboard.analyticsPage.trendLegend")}
            </div>
          </div>

          <div className="mt-6 h-[320px] w-full sm:h-[360px]">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-[1.75rem] border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                {t("dashboard.analyticsPage.noPoints")}
              </div>
            ) : (
              <VendorAnalyticsChart dataPoints={chartData} isMobile={isMobile} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
