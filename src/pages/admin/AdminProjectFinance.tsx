import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { EntryStatusBadge } from "@/components/admin/finance/EntryStatusBadge";
import { getProjectStatement } from "@/lib/apiClient";
import type { ProjectStatementRow } from "@/lib/apiTypes";

function fmtTRY(v: number | string | null | undefined) {
  return "₺" + Number(v ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("tr-TR"); } catch { return d; }
}

const SOURCE_LABEL: Record<string, string> = {
  customer: "Müşteri",
  employee: "Personel",
  supplier: "Tedarikçi",
  expense_card: "Masraf Kartı",
};

function StatementTable({ rows }: { rows: ProjectStatementRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-semibold">Tarih</th>
            <th className="px-3 py-2 font-semibold">Başlık</th>
            <th className="px-3 py-2 font-semibold">Kaynak</th>
            <th className="px-3 py-2 font-semibold">Taraf</th>
            <th className="px-3 py-2 text-right font-semibold">Tutar (TL)</th>
            <th className="px-3 py-2 text-right font-semibold">Ödenen</th>
            <th className="px-3 py-2 text-right font-semibold">Kalan</th>
            <th className="px-3 py-2 font-semibold">Durum</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/20">
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fmtDate(row.entry_date)}</td>
              <td className="max-w-[160px] truncate px-3 py-2 font-medium" title={row.title}>{row.title}</td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{SOURCE_LABEL[row.source_type] ?? row.source_type}</td>
              <td className="max-w-[120px] truncate px-3 py-2 text-muted-foreground" title={row.owner_name}>{row.owner_name}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                {fmtTRY(row.amount_try)}
                {row.currency !== "TRY" && <span className="ml-1 text-xs text-muted-foreground">({row.currency})</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-700">{fmtTRY(row.paid_amount_try)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-amber-600">{fmtTRY(row.remaining_amount_try)}</td>
              <td className="px-3 py-2"><EntryStatusBadge status={row.status} isOverdue={!!row.is_overdue} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminProjectFinance() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["project-statement", id],
    queryFn: () => getProjectStatement(id!),
    enabled: !!id,
  });

  if (!id) return <div className="py-12 text-center text-sm text-muted-foreground">Proje bulunamadı.</div>;

  const project = data?.project;
  const rows = data?.rows ?? [];
  const summary = data?.summary;
  const contractTotal = project?.contract_total_try != null ? Number(project.contract_total_try) : null;
  const incomeRows = rows.filter((r) => r.direction === "income");
  const expenseRows = rows.filter((r) => r.direction === "expense");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={project?.title ?? "Proje Ekstresi"}
        description="Proje bazlı tüm gelir ve gider kalemleri"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={`/admin/projeler/${id}`}><ArrowLeft className="mr-1 h-4 w-4" /> Projeye Dön</Link>
          </Button>
        }
      />

      {contractTotal != null && (
        <div className="rounded-md border border-border bg-card p-4 shadow-card-soft max-w-xs">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sözleşme Bedeli</div>
          <div className="mt-2 break-words text-xl font-extrabold leading-tight tabular-nums text-foreground">{fmtTRY(contractTotal)}</div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {([
            ["Planlanan Gelir", summary.total_income_planned, "text-emerald-700"],
            ["Gerçekleşen Gelir", summary.total_income_paid, "text-emerald-700"],
            ["Kalan Alacak", summary.total_income_remaining, "text-amber-600"],
            ["Planlanan Gider", summary.total_expense_planned, "text-destructive"],
            ["Gerçekleşen Gider", summary.total_expense_paid, "text-destructive"],
            ["Gerçekleşen Kâr", summary.realized_profit, Number(summary.realized_profit) >= 0 ? "text-emerald-700" : "text-destructive"],
          ] as const).map(([label, value, color]) => (
            <div key={label} className="rounded-md border border-border bg-card p-4 shadow-card-soft">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
              <div className={`mt-2 break-words text-xl font-extrabold leading-tight tabular-nums ${color}`}>{fmtTRY(value)}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading && <div className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</div>}
      {error && <div className="py-8 text-center text-sm text-destructive">Proje ekstresi alınamadı.</div>}

      {!isLoading && !error && (
        <>
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <TrendingUp className="h-4 w-4" /> Gelirler ({incomeRows.length})
            </div>
            {incomeRows.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">Bu proje için gelir kaydı bulunmuyor.</div>
            ) : (
              <StatementTable rows={incomeRows} />
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-destructive">
              <TrendingDown className="h-4 w-4" /> Giderler ({expenseRows.length})
            </div>
            {expenseRows.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">Bu proje için gider kaydı bulunmuyor.</div>
            ) : (
              <StatementTable rows={expenseRows} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
