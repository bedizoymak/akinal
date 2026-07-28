import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingUp, Clock, AlertTriangle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { EntryStatusBadge } from "@/components/admin/finance/EntryStatusBadge";
import { getGelenler } from "@/lib/apiClient";
import type { GelenlerEntry } from "@/lib/apiTypes";
import { LIST_SORT_OPTIONS, applyParam, parseSortOrder, sortListEntries } from "@/lib/adminListFilters";

const STATUSES = ["Planlanan", "Gecikmiş", "Kısmi Ödendi", "Gerçekleşti", "Fazla Ödendi"];

function fmtTRY(v: number | string) {
  return "₺" + Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [year, month, day] = String(d).slice(0, 10).split("-");
  if (year && month && day) return `${day}.${month}.${year}`;
  return String(d);
}

export default function AdminGelenler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const statusFilter = searchParams.get("status") || "all";
  const projectFilter = searchParams.get("project_id") || "all";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";
  const sort = parseSortOrder(searchParams.get("sort"));
  const [qInput, setQInput] = useState(q);

  useEffect(() => { setQInput(q); }, [q]);

  const hasActiveFilters = q !== "" || statusFilter !== "all" || projectFilter !== "all" || dateFrom !== "" || dateTo !== "" || sort !== "date_asc";

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

  const { data, isLoading } = useQuery({
    queryKey: ["gelenler", q, statusFilter, projectFilter, dateFrom, dateTo],
    queryFn: () => getGelenler({
      q: q || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      project_id: projectFilter === "all" ? undefined : projectFilter,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
  });

  const entries = useMemo(() => sortListEntries(data?.entries ?? [], sort), [data?.entries, sort]);
  const summary = data?.summary;
  const projects = data?.projects ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Gelenler" description="Tüm müşteri tahsilatları ve devlet hakediş ödemeleri" />

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Planlanan Toplam", value: fmtTRY(summary.total_planned), icon: TrendingUp, color: "text-foreground" },
            { label: "Tahsil Edilen", value: fmtTRY(summary.total_paid), icon: TrendingUp, color: "text-emerald-600" },
            { label: "Kalan Alacak", value: fmtTRY(summary.total_remaining), icon: Clock, color: "text-amber-600" },
            { label: "Gecikmiş", value: String(summary.overdue_count), icon: AlertTriangle, color: "text-red-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-card-soft">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className={`mt-1 text-2xl font-extrabold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Başlık veya müşteri ara..." value={qInput} onChange={(e) => updateQ(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => updateParam("status", v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Durum" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={(v) => updateParam("project_id", v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Proje" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Projeler</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="w-40" value={dateFrom} onChange={(e) => updateParam("date_from", e.target.value, "")} aria-label="Başlangıç tarihi" />
        <Input type="date" className="w-40" value={dateTo} onChange={(e) => updateParam("date_to", e.target.value, "")} aria-label="Bitiş tarihi" />
        <Select value={sort} onValueChange={(v) => updateParam("sort", v, "date_asc")}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Sırala" /></SelectTrigger>
          <SelectContent>
            {LIST_SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" /> Filtreleri Temizle</Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</p>
      ) : entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tarih</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Müşteri / Başlık</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Proje</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Planlanan</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tahsil</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(entries as GelenlerEntry[]).map((e) => (
                <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 tabular-nums">{fmtDate(e.entry_date)}</td>
                  <td className="px-4 py-3">
                    {e.source_type === "government" && (
                      <div className="mb-0.5 inline-block rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] font-semibold text-blue-700">Devlet Hakedişi</div>
                    )}
                    <div className="font-medium">{e.owner_name || "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{e.title}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.project_title || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtTRY(e.amount_try)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{fmtTRY(e.paid_amount_try)}</td>
                  <td className="px-4 py-3">
                    <EntryStatusBadge status={e.status} isOverdue={Number(e.is_overdue) === 1} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
