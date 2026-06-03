import { useEffect, useState } from "react";
import { getAdminMarketRates } from "@/lib/apiClient";
import type { AdminMarketRatesResponse } from "@/lib/apiTypes";
import { cn } from "@/lib/utils";

const FALLBACK_RATES = [
  { code: "eur" as const, label: "EURO", value: null, change_percent: null },
  { code: "usd" as const, label: "DOLAR", value: null, change_percent: null },
  { code: "gold" as const, label: "GRAM ALTIN", value: null, change_percent: null },
];

const VISIBLE_REFRESH_MS = 5000;
const HIDDEN_REFRESH_MS = 30000;

const formatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatRate(value: number | null) {
  return typeof value === "number" ? formatter.format(value) : "--";
}

function formatChange(value: number | null) {
  if (typeof value !== "number") return "--";
  return `${value > 0 ? "+" : ""}${formatter.format(value)}%`;
}

export default function AdminMarketTicker() {
  const [rates, setRates] = useState<AdminMarketRatesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;

    function loadRates() {
      getAdminMarketRates()
        .then((data) => {
          if (!cancelled) {
            setRates(data);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRates({
              rates: FALLBACK_RATES,
              source: "",
              stale: true,
              fetched_at: new Date().toISOString(),
            });
          }
        });
    }

    function scheduleRefresh() {
      if (interval !== undefined) {
        window.clearInterval(interval);
      }

      interval = window.setInterval(loadRates, document.hidden ? HIDDEN_REFRESH_MS : VISIBLE_REFRESH_MS);
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        loadRates();
      }
      scheduleRefresh();
    }

    loadRates();
    scheduleRefresh();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
    };
  }, []);

  const items = rates?.rates ?? FALLBACK_RATES;

  return (
    <div
      className="hidden max-w-[58vw] items-center gap-1 overflow-hidden rounded-md border border-sky-300/15 bg-[#071d3a] px-2 py-1 text-white shadow-sm sm:flex xl:max-w-none"
      title={rates?.stale ? "Piyasa verisi önbellekten veya güvenli yedekten gösteriliyor" : "Güncel piyasa verisi"}
    >
      {items.map((rate) => {
        const change = rate.change_percent;
        const isPositive = typeof change === "number" && change > 0;
        const isNegative = typeof change === "number" && change < 0;

        return (
          <div key={rate.code} className="flex min-w-0 items-center gap-1.5 border-sky-300/10 px-1.5 text-[10px] first:pl-0 last:pr-0 md:border-l md:first:border-l-0">
            <span className="hidden whitespace-nowrap font-semibold text-sky-100/70 lg:inline">{rate.label}</span>
            <span className="whitespace-nowrap font-bold tabular-nums text-white">{formatRate(rate.value)}</span>
            <span
              className={cn(
                "hidden rounded px-1 py-0.5 font-semibold tabular-nums md:inline",
                isPositive && "bg-emerald-400/15 text-emerald-200",
                isNegative && "bg-rose-400/15 text-rose-200",
                !isPositive && !isNegative && "bg-white/10 text-sky-100/70",
              )}
            >
              {formatChange(change)}
            </span>
          </div>
        );
      })}
      {rates?.stale && <span className="ml-1 hidden rounded bg-amber-300/15 px-1 py-0.5 text-[10px] font-semibold text-amber-100 xl:inline">STALE</span>}
    </div>
  );
}
