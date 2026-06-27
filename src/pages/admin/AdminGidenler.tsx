import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingDown, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { EntryStatusBadge } from "@/components/admin/finance/EntryStatusBadge";
import { getGidenler } from "@/lib/apiClient";

const STATUSES = ["Planlanan", "Gecikmiş", "Kısmi Ödendi", "Gerçekleşti", "Fazla Ödendi"];

const SOURCE_LABELS: Record<string, string> = {
  employee: "Personel",
  supplier: "Tedarikçi",
  expense_card: "Masraf Kartı",
};

function fmtTRY(v: number | string) {
  return "₺" + Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("tr-TR"); } catch { return d; }
}

export default function AdminGidenler() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["gidenler", q, statusFilter, projectFilter, sourceFilter],
    queryFn: () => getGidenler({
      q: q || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      project_id: projectFilter === "all" ? undefined : projectFilter,
      source_type: sourceFilter === "all" ? undefined : sourceFilter,
    }),
  });

  const entries = data?.entries ?? [];
  const summary = data?.summary;
  const projects = data?.projects ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Gidenler" description="Tüm personel, tedarikçi ve masraf kartı ödeme kalemleri" />

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Planlanan Toplam", value: fmtTRY(summary.total_planned), color: "text-foreground" },
            { label: "Ödenen", value: fmtTRY(summary.total_paid), color: "text-emerald-600" },
            { label: "Kalan Borç", value: fmtTRY(summary.total_remaining), color: "text-amber-600" },
            { label: "Gecikmiş", value: String(summary.overdue_count), color: "text-red-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-card-soft">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className={`mt-1 text-2xl font-extrabold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Başlık veya kart sahibi ara..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Kaynak" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Kaynaklar</SelectItem>
            <SelectItem value="employee">Personel</SelectItem>
            <SelectItem value="supplier">Tedarikçi</SelectItem>
            <SelectItem value="expense_card">Masraf Kartı</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Durum" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Proje" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Projeler</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
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
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kaynak / Başlık</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tür</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Proje</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Planlanan</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ödenen</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 tabular-nums">{fmtDate(e.entry_date)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.owner_name}</div>
                    <div className="text-[11px] text-muted-foreground">{e.title}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium">
                      {SOURCE_LABELS[e.source_type] ?? e.source_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.project_title}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtTRY(e.amount_try)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{fmtTRY(e.paid_amount_try)}</td>
                  <td className="px-4 py-3">
                    <EntryStatusBadge status={e.status} isOverdue={e.is_overdue} />
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
