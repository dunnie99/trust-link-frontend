"use client";

import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useCurrency } from "@/components/providers/CurrencyProvider";
import type { VendorAnalyticsPoint } from "@/lib/api";

function formatRate(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatAxisLabel(value: string, compact: boolean, locale: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(locale, compact
    ? { month: "numeric", day: "numeric" }
    : { month: "short", day: "numeric" }
  );
}

function formatCompactVolume(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function normalizeRate(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return value <= 1 ? value * 100 : value;
}

function AnalyticsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: VendorAnalyticsPoint }>;
  label?: string;
}) {
  const { formatAmount } = useCurrency();
  const { i18n, t } = useTranslation();
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/95 p-4 text-sm shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <p className="font-semibold text-zinc-950 dark:text-white">
        {label ? formatAxisLabel(label, false, i18n.language) : t("dashboard.analyticsPage.dailySnapshot")}
      </p>
      <div className="mt-3 space-y-1 text-zinc-600 dark:text-zinc-300">
        <p>{t("dashboard.analyticsPage.tooltipTransactionVolume", { amount: formatAmount(point.transactionVolume) })}</p>
        <p>{t("dashboard.analyticsPage.tooltipAverageOrder", { amount: formatAmount(point.averageOrderValue) })}</p>
        <p>{t("dashboard.analyticsPage.tooltipCompletionRate", { rate: formatRate(normalizeRate(point.completionRate)) })}</p>
        <p>{t("dashboard.analyticsPage.tooltipDisputeRate", { rate: formatRate(normalizeRate(point.disputeRate)) })}</p>
      </div>
    </div>
  );
}

interface VendorAnalyticsChartProps {
  dataPoints: VendorAnalyticsPoint[];
  isMobile: boolean;
}

export default function VendorAnalyticsChart({
  dataPoints,
  isMobile,
}: VendorAnalyticsChartProps) {
  const { i18n } = useTranslation();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={dataPoints} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="volumeStroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.8} />
          </linearGradient>
          <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(120,120,120,0.18)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
          interval={isMobile ? 5 : 2}
          minTickGap={isMobile ? 24 : 16}
          tickFormatter={(value: string | number) => formatAxisLabel(String(value), isMobile, i18n.language)}
          tick={{ fill: "#71717a", fontSize: isMobile ? 11 : 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          width={isMobile ? 44 : 64}
          tickFormatter={(value: string | number) => formatCompactVolume(Number(value), i18n.language)}
          tick={{ fill: "#71717a", fontSize: isMobile ? 11 : 12 }}
        />
        <Tooltip content={<AnalyticsTooltip />} />
        <Area
          type="monotone"
          dataKey="transactionVolume"
          stroke="url(#volumeStroke)"
          strokeWidth={3}
          fill="url(#volumeFill)"
          fillOpacity={1}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
