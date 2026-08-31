"use client";

import { Download, Search } from "lucide-react";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import ShipTrackingModal from "@/components/dashboard/ShipTrackingModal";
import TransactionHistoryExport from "@/components/dashboard/TransactionHistoryExport";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import FetchErrorState, {
  getFetchErrorMessage,
} from "@/components/ui/FetchErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cancelEscrow, getVendorEscrows } from "@/lib/api";
import { type Escrow, EscrowStatusConst } from "@/types";
import { downloadCsv } from "@/utils/exportCsv";

import EmptyVendorState from "./EmptyVendorState";
import EscrowTableRow from "./EscrowTableRow";

const STATUS_TABS = [
  "ALL",
  EscrowStatusConst.PENDING,
  EscrowStatusConst.FUNDED,
  EscrowStatusConst.SHIPPED,
  EscrowStatusConst.COMPLETED,
  EscrowStatusConst.DISPUTED,
  EscrowStatusConst.RELEASED,
  EscrowStatusConst.REFUNDED,
  EscrowStatusConst.EXPIRED,
] as const;
const ITEMS_PER_PAGE = 10;

export default function VendorDashboardList({
  loading = false,
}: {
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const [escrows, setEscrows] = useState<Escrow[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [selectedEscrow, setSelectedEscrow] = useState<Escrow | null>(null);
  const [escrowToCancel, setEscrowToCancel] = useState<Escrow | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    startTransition(() => setCurrentPage(1));
  }, [searchQuery, statusFilter, fromDate, toDate]);

  const handleMarkShipped = useCallback((escrow: Escrow) => {
    setSelectedEscrow(escrow);
  }, []);

  const filteredEscrows = useMemo(() => {
    if (!escrows) return null;

    const start = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const end = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;

    return escrows.filter((escrow) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        escrow.id.toLowerCase().includes(query) ||
        (escrow.vendorId && escrow.vendorId.toLowerCase().includes(query)) ||
        (escrow.buyerId && escrow.buyerId.toLowerCase().includes(query)) ||
        (escrow.item && escrow.item.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "ALL" || escrow.status === statusFilter;

      const created = new Date(escrow.createdAt).getTime();
      const matchesDate =
        (start === null || created >= start) &&
        (end === null || created <= end);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [escrows, searchQuery, statusFilter, fromDate, toDate]);

  const clearDateFilter = () => {
    setFromDate("");
    setToDate("");
  };
  const totalPages = filteredEscrows
    ? Math.ceil(filteredEscrows.length / ITEMS_PER_PAGE)
    : 0;

  const paginatedEscrows = useMemo(() => {
    if (!filteredEscrows) return [];
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEscrows.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredEscrows, currentPage]);

  const loadItems = async () => {
    try {
      setError(null);
      const token = window.localStorage.getItem("wallet.jwt") || undefined;
      const data = await getVendorEscrows(token);
      setEscrows(data);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error(t("dashboard.loadEscrowsError"))
      );
    }
  };

  useEffect(() => {
    startTransition(() => loadItems());
  }, []);

  const handleShipmentSuccess = (escrowId: string) => {
    setEscrows(
      (current) =>
        current?.map((item) =>
          item.id === escrowId
            ? { ...item, status: EscrowStatusConst.SHIPPED }
            : item
        ) ?? current
    );
  };

  const handleCancelEscrow = useCallback((escrow: Escrow) => {
    setEscrowToCancel(escrow);
  }, []);

  const confirmCancelEscrow = async () => {
    if (!escrowToCancel) return;
    
    setIsCancelling(true);
    try {
      const token = window.localStorage.getItem("wallet.jwt") || undefined;
      await cancelEscrow(escrowToCancel.id, token);
      
      // Remove cancelled escrow from the list
      setEscrows((current) => 
        current?.filter((item) => item.id !== escrowToCancel.id) ?? current
      );
      
      toast.success(t("dashboard.cancelEscrowSuccess"));
      setEscrowToCancel(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("dashboard.cancelEscrowError");
      toast.error(message);
      setError(new Error(message));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleExportCsv = useCallback(() => {
    if (!filteredEscrows || filteredEscrows.length === 0) return;
    downloadCsv(
      filteredEscrows as unknown as Record<string, unknown>[],
      [
        { key: "id", header: t("dashboard.csvHeaders.escrowId") },
        { key: "item", header: t("dashboard.csvHeaders.item") },
        { key: "buyerId", header: t("dashboard.csvHeaders.buyer") },
        { key: "amount", header: t("dashboard.csvHeaders.amount") },
        { key: "status", header: t("dashboard.csvHeaders.status") },
        { key: "createdAt", header: t("dashboard.csvHeaders.createdAt") },
      ],
      `trustlink-escrows-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }, [filteredEscrows, t]);

  if (error) {
    return (
      <FetchErrorState
        title={t("dashboard.loadEscrowsTitle")}
        message={getFetchErrorMessage(error, t("dashboard.loadEscrowsError"))}
        onRetry={() => {
          setEscrows(null);
          void loadItems();
        }}
      />
    );
  }

  if (loading || !escrows) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, index) => (
          <div
            key={index}
            className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <Skeleton className="mb-4 h-5 w-1/3" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (escrows.length === 0) {
    return <EmptyVendorState />;
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder={t("dashboard.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-zinc-200 bg-white py-2 pl-10 pr-4 text-sm text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white dark:focus:ring-white dark:focus-visible:ring-zinc-300"
          />
        </div>
        <div className="flex items-center gap-3">
          <TransactionHistoryExport
            escrows={escrows}
            vendorId={escrows[0]?.vendorId || "vendor"}
          />
          <button
            id="export-csv-button"
            type="button"
            onClick={handleExportCsv}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleExportCsv();
              }
            }}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-300"
          >
            <Download className="h-4 w-4" />
            {t("dashboard.exportCsv")}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => {
          const count =
            s === "ALL"
              ? escrows.length
              : escrows.filter((e) => e.status === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setStatusFilter(s);
                }
              }}
              className={`rounded-full px-3 py-1 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-300 ${
                statusFilter === s
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {s === "ALL"
                ? t("dashboard.allFilter")
                : s.charAt(0) + s.slice(1).toLowerCase()}{" "}
              ({count})
            </button>
          );
        })}
      </div>
      {/* Date range filter */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label
            htmlFor="escrow-from-date"
            className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            {t("dashboard.fromLabel")}
          </label>
          <input
            id="escrow-from-date"
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-black focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-visible:ring-zinc-300"
          />
        </div>
        <div className="flex flex-col">
          <label
            htmlFor="escrow-to-date"
            className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            {t("dashboard.toLabel")}
          </label>
          <input
            id="escrow-to-date"
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-black focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-visible:ring-zinc-300"
          />
        </div>
        {(fromDate || toDate) && (
          <button
            type="button"
            onClick={clearDateFilter}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                clearDateFilter();
              }
            }}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-300"
          >
            {t("dashboard.clearDates")}
          </button>
        )}
      </div>

      {(filteredEscrows?.length ?? 0) === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 py-12 text-center dark:border-zinc-800">
          <p className="text-zinc-500 dark:text-zinc-400">
            {t("dashboard.noEscrowsFound")}
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("ALL");
              clearDateFilter();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSearchQuery("");
                setStatusFilter("ALL");
                clearDateFilter();
              }
            }}
            className="mt-4 text-sm font-medium text-black hover:underline dark:text-white"
          >
            {t("dashboard.clearFilters")}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedEscrows.map((escrow) => (
            <EscrowTableRow
              key={escrow.id}
              escrow={escrow}
              onMarkShipped={handleMarkShipped}
              onCancelEscrow={handleCancelEscrow}
            />
          ))}
        </div>
      )}

      {(filteredEscrows?.length ?? 0) > 0 && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("dashboard.showingPage")} {" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{currentPage}</span>{" "}
            {t("dashboard.ofPages")} {" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && currentPage > 1) {
                  e.preventDefault();
                  setCurrentPage((p) => Math.max(1, p - 1));
                }
              }}
              disabled={currentPage === 1}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {t("dashboard.previous")}
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              onKeyDown={(e) => {
                if (
                  (e.key === "Enter" || e.key === " ") &&
                  currentPage < totalPages
                ) {
                  e.preventDefault();
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                }
              }}
              disabled={currentPage === totalPages}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {t("dashboard.next")}
            </button>
          </div>
        </div>
      )}

      {selectedEscrow && (
        <ShipTrackingModal
          escrowId={selectedEscrow.id}
          vendorName={selectedEscrow.item}
          open={Boolean(selectedEscrow)}
          onClose={() => setSelectedEscrow(null)}
          onSuccess={(escrowId) => {
            handleShipmentSuccess(escrowId);
            loadItems();
          }}
        />
      )}

      <ConfirmationDialog
        open={Boolean(escrowToCancel)}
        title={t("dashboard.cancelEscrowTitle")}
        description={t("dashboard.cancelEscrowDescription", { item: escrowToCancel?.item })}
        confirmLabel={t("dashboard.cancelEscrowTitle")}
        cancelLabel={t("dashboard.keepEscrow")}
        onConfirm={confirmCancelEscrow}
        onCancel={() => setEscrowToCancel(null)}
        variant="danger"
        loading={isCancelling}
      />
    </>
  );
}
