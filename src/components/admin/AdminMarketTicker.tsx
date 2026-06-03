import { useEffect, useRef, useState } from "react";
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
const FLASH_DURATION_MS = 700;

type FlashDirection = "up" | "down";

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
  const [flashes, setFlashes] = useState<Record<string, FlashDirection | undefined>>({});
  const previousValues = useRef<Record<string, number | null>>({});
  const flashTimeouts = useRef<Record<string, number | undefined>>({});

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;

    function loadRates() {
      getAdminMarketRates()
        .then((data) => {
          if (!cancelled) {
            const nextFlashes: Record<string, FlashDirection> = {};

            data.rates.forEach((rate) => {
              const previous = previousValues.current[rate.code];
              if (typeof previous === "number" && typeof rate.value === "number" && previous !== rate.value) {
                nextFlashes[rate.code] = rate.value > previous ? "up" : "down";
              }
              previousValues.current[rate.code] = rate.value;
            });

            setRates(data);

            Object.entries(nextFlashes).forEach(([code, direction]) => {
              if (flashTimeouts.current[code] !== undefined) {
                window.clearTimeout(flashTimeouts.current[code]);
              }

              setFlashes((current) => ({ ...current, [code]: direction }));
              flashTimeouts.current[code] = window.setTimeout(() => {
                setFlashes((current) => ({ ...current, [code]: undefined }));
              }, FLASH_DURATION_MS);
            });
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
      Object.values(flashTimeouts.current).forEach((timeout) => {
        if (timeout !== undefined) {
          window.clearTimeout(timeout);
        }
      });
    };
  }, []);

  const items = rates?.rates ?? FALLBACK_RATES;

  return (
    <div
      className="hidden max-w-[58vw] items-center gap-1 overflow-hidden rounded-md border border-[hsl(142_45%_34%)] bg-[linear-gradient(135deg,hsl(142_48%_28%),hsl(142_45%_22%))] px-2 py-1.5 text-white shadow-sm ring-1 ring-[hsl(142_48%_42%/0.22)] sm:flex xl:max-w-none"
      title={rates?.stale ? "Piyasa verisi önbellekten veya güvenli yedekten gösteriliyor" : "Güncel piyasa verisi"}
    >
      {items.map((rate) => {
        const change = rate.change_percent;
        const isPositive = typeof change === "number" && change > 0;
        const isNegative = typeof change === "number" && change < 0;
        const flash = flashes[rate.code];

        return (
          <div key={rate.code} className="grid min-w-0 grid-cols-[auto_auto] items-start gap-x-1.5 border-white/15 px-1.5 text-[10px] leading-none first:pl-0 last:pr-0 md:border-l md:first:border-l-0">
            <span className="hidden whitespace-nowrap pt-1 font-semibold text-white/70 lg:inline">{rate.label}</span>
            <div className="flex min-w-0 flex-col items-center gap-0.5">
              <span
                className={cn(
                  "rounded px-1 py-0.5 font-bold tabular-nums text-white transition-colors duration-700",
                  flash === "up" && "bg-accent/35 text-white shadow-[0_0_14px_hsl(var(--accent)/0.45)]",
                  flash === "down" && "bg-red-900/35 text-red-100 shadow-[0_0_14px_rgba(185,28,28,0.28)]",
                  !flash && "bg-transparent",
                )}
              >
                {formatRate(rate.value)}
              </span>
              <span
                className={cn(
                  "hidden w-fit rounded px-1 py-0.5 font-semibold tabular-nums md:inline",
                  isPositive && "bg-accent/20 text-green-100 shadow-[0_0_10px_hsl(var(--accent)/0.28)]",
                  isNegative && "bg-red-950/30 text-red-100",
                  !isPositive && !isNegative && "bg-white/5 text-white/65",
                )}
              >
                {formatChange(change)}
              </span>
            </div>
          </div>
        );
      })}
      {rates?.stale && <span className="ml-1 hidden rounded bg-white/10 px-1 py-0.5 text-[10px] font-semibold text-white/70 xl:inline">STALE</span>}
    </div>
  );
}
