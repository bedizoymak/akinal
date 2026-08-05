import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingUp, TrendingDown, Scale, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { AccountTypeBadge } from "@/components/admin/finance/AccountTypeBadge";
import { getGelenler, getGidenler } from "@/lib/apiClient";
import { applyParam } from "@/lib/adminListFilters";
import { cn } from "@/lib/utils";

// Bank-statement-style ledger for the dashboard's "Net Durum" card: every realized (paid)
// income and expense item, merged from Gelenler (customer + GPP income) and Gidenler
// (employee/supplier/expense-card costs), dated today or earlier, with a running balance.
// Amounts shown are paid_amount_try — the same realized figures that make up the Net Durum
// card's value (dashboard.php: realized_profit = total_income_paid - total_expense_paid).

type Direction = "gelir" | "gider";

interface Movement {
  id: string;
  entry_date: string;
  title: string;
  owner_name: string | null;
  project_title: string | null;
  source_label: string;
  account_type: "resmi" | "gayri_resmi" | string | null;
  direction: Direction;
  amount_try: number;
}

/**
 * QA-B OBS-01: KPI totals must be computed from whatever row set is passed in — the caller is
 * responsible for passing the currently filtered/searched rows (not the full unfiltered list),
 * so a "QA DEMO" search narrows these totals the same way Gelenler/Gidenler's own summary cards
 * already do. Pure function so the contract is independently testable (see
 * src/test/net-durum-filtered-kpi.test.ts).
 */
export function computeNetDurumTotals(rows: Pick<Movement, "direction" | "amount_try">[]) {
  const income = rows.filter((m) => m.direction === "gelir").reduce((s, m) => s + m.amount_try, 0);
  const expense = rows.filter((m) => m.direction === "gider").reduce((s, m) => s + m.amount_try, 0);
  return { income, expense, net: income - expense };
}

function todayLocalISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function fmtTRY(v: number) {
  const sign = v < 0 ? "-" : "";
  return sign + "₺" + Math.abs(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [year, month, day] = String(d).slice(0, 10).split("-");
  if (year && month && day) return `${day}.${month}.${year}`;
  return String(d);
}

export default function AdminNetDurum() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const directionFilter = searchParams.get("yon") || "all";
  const accountTypeFilter = searchParams.get("account_type") || "all";
  const dateFrom = searchParams.get("date_from") || "";
  const sortDesc = searchParams.get("sort") !== "date_asc";
  const [qInput, setQInput] = useState(q);
  const today = todayLocalISO();

  useEffect(() => { setQInput(q); }, [q]);

  const hasActiveFilters = q !== "" || directionFilter !== "all" || accountTypeFilter !== "all" || dateFrom !== "" || !sortDesc;

  function updateParam(key: string, value: string, defaultValue = "all") {
    const next = new URLSearchParams(searchParams);
    applyParam(next, key, value, defaultValue);
    setSearchParams(next, { replace: true });
  }

  function updateQ(value: string) {
    setQInput(value);
    updateParam("q", value, "");
  }

  function clearFilters() {
    setQInput("");
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  const { data: gelenlerData, isLoading: gelenlerLoading } = useQuery({
    queryKey: ["net-durum-gelenler"],
    queryFn: () => getGelenler({}),
  });
  const { data: gidenlerData, isLoading: gidenlerLoading } = useQuery({
    queryKey: ["net-durum-gidenler"],
    queryFn: () => getGidenler({}),
  });
  const isLoading = gelenlerLoading || gidenlerLoading;

  // Merge, clamp to <= today (never show future-dated rows regardless of URL tampering),
  // sort ascending by date then id for a stable running balance, then apply display filters.
  const { movements } = useMemo(() => {
    const income: Movement[] = (gelenlerData?.entries ?? []).map((e) => ({
      id: e.id,
      entry_date: String(e.entry_date || "").slice(0, 10),
      title: e.title,
      owner_name: e.owner_name,
      project_title: e.project_title,
      source_label: e.source_type === "government" ? "Devlet Hakedişi" : "Müşteri",
      account_type: e.account_type,
      direction: "gelir" as const,
      amount_try: Number(e.paid_amount_try) || 0,
    }));
    const expense: Movement[] = (gidenlerData?.entries ?? []).map((e) => ({
      id: e.id,
      entry_date: String(e.entry_date || "").slice(0, 10),
      title: e.title,
      owner_name: e.owner_name,
      project_title: e.project_title,
      source_label: e.source_label,
      account_type: e.account_type,
      direction: "gider" as const,
      amount_try: Number(e.paid_amount_try) || 0,
    }));

    const all = [...income, ...expense]
      .filter((m) => m.amount_try !== 0 && m.entry_date !== "" && m.entry_date <= today)
      .sort((a, b) => {
        const cmp = a.entry_date.localeCompare(b.entry_date);
        return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
      });

    return { movements: all };
  }, [gelenlerData?.entries, gidenlerData?.entries, today]);

  // The running "Bakiye" balance is always computed against the full, unfiltered movement
  // history — a bank-statement balance must stay continuous regardless of which rows are
  // currently displayed. The KPI cards, however, summarize whatever is actually filtered/
  // searched into view (`filtered`, below) — matching how Gelenler/Gidenler's own summary
  // cards already reconcile with their active filters, so a "QA DEMO" search here shows KPI
  // totals for just those matching rows instead of silently staying at the global total.
  const { rows, totals } = useMemo(() => {
    let balance = 0;
    const withBalance = movements.map((m) => {
      balance += m.direction === "gelir" ? m.amount_try : -m.amount_try;
      return { ...m, balance };
    });

    const filtered = withBalance.filter((m) => {
      if (directionFilter !== "all" && m.direction !== directionFilter) return false;
      if (accountTypeFilter !== "all" && m.account_type !== accountTypeFilter) return false;
      if (dateFrom && m.entry_date < dateFrom) return false;
      if (q) {
        const needle = q.toLocaleLowerCase("tr-TR");
        const haystack = `${m.title} ${m.owner_name ?? ""}`.toLocaleLowerCase("tr-TR");
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    return {
      rows: sortDesc ? [...filtered].reverse() : filtered,
      totals: computeNetDurumTotals(filtered),
    };
  }, [movements, directionFilter, accountTypeFilter, dateFrom, q, sortDesc]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Net Durum" description={`Bugüne (${fmtDate(today)}) kadar gerçekleşen tüm gelir ve gider kalemleri — banka hesap özeti gibi`} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card-soft">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Toplam Gelir{hasActiveFilters && " (Filtrelenmiş)"}</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-600">{fmtTRY(totals.income)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card-soft">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><TrendingDown className="h-3.5 w-3.5 text-red-600" /> Toplam Gider{hasActiveFilters && " (Filtrelenmiş)"}</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-red-600">{fmtTRY(totals.expense)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card-soft">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Scale className="h-3.5 w-3.5" /> Net Bakiye{hasActiveFilters && " (Filtrelenmiş)"}</div>
          <div className={cn("mt-1 text-2xl font-extrabold tabular-nums", totals.net >= 0 ? "text-emerald-600" : "text-red-600")}>{fmtTRY(totals.net)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Başlık veya cari ara..." value={qInput} onChange={(e) => updateQ(e.target.value)} />
        </div>
        <Select value={directionFilter} onValueChange={(v) => updateParam("yon", v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Yön" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Gelir ve Gider</SelectItem>
            <SelectItem value="gelir">Yalnız Gelir</SelectItem>
            <SelectItem value="gider">Yalnız Gider</SelectItem>
          </SelectContent>
        </Select>
        <Select value={accountTypeFilter} onValueChange={(v) => updateParam("account_type", v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Kayıt Türü" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Kayıt Türleri</SelectItem>
            <SelectItem value="resmi">Resmi</SelectItem>
            <SelectItem value="gayri_resmi">Gayri Resmi</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" className="w-40" value={dateFrom} max={today} onChange={(e) => updateParam("date_from", e.target.value, "")} aria-label="Başlangıç tarihi" />
        <Select value={sortDesc ? "date_desc" : "date_asc"} onValueChange={(v) => updateParam("sort", v, "date_desc")}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Sırala" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date_asc">Tarih (Eskiden Yeniye)</SelectItem>
            <SelectItem value="date_desc">Tarih (Yeniden Eskiye)</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" /> Filtreleri Temizle</Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</p>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tarih</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Açıklama</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Proje</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kayıt Türü</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tutar</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bakiye</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((m) => (
                <tr key={`${m.direction}-${m.id}`} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 tabular-nums">{fmtDate(m.entry_date)}</td>
                  <td className="px-4 py-3">
                    <div className="mb-0.5 inline-flex rounded-full border border-border bg-muted px-1.5 py-0 text-[10px] font-semibold text-muted-foreground">{m.source_label}</div>
                    <div className="font-medium">{m.owner_name || "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{m.title}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.project_title || "—"}</td>
                  <td className="px-4 py-3"><AccountTypeBadge accountType={m.account_type} /></td>
                  <td className={cn("px-4 py-3 text-right tabular-nums font-medium", m.direction === "gelir" ? "text-emerald-600" : "text-red-600")}>
                    {m.direction === "gelir" ? "+" : "-"}{fmtTRY(m.amount_try)}
                  </td>
                  <td className={cn("px-4 py-3 text-right tabular-nums font-semibold", m.balance >= 0 ? "text-foreground" : "text-red-600")}>{fmtTRY(m.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
