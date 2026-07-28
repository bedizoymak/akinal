import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getProjectExpenseTransactions } from "@/lib/apiClient";
import type { AkExpenseTransaction, AkExpenseProfitability } from "@/lib/apiTypes";

function formatMoney(value: string | number, currency: string): string {
  const num = parseFloat(String(value));
  if (isNaN(num)) return "—";
  if (currency === "XAU_GRAM") return `${num.toFixed(4)} gr Au`;
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₺";
  return `${sym}${num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

const CURRENCY_LABELS: Record<string, string> = {
  TRY: "₺ TRY",
  USD: "$ USD",
  EUR: "€ EUR",
  XAU_GRAM: "Au XAU/gr",
};

function ProfitabilityPanel({ profitability }: { profitability: Record<string, string | number> }) {
  const entries = Object.entries(profitability).filter(([, v]) => parseFloat(String(v)) !== 0);
  if (entries.length === 0) return <div className="text-sm text-muted-foreground">—</div>;
  return (
    <div className="space-y-1">
      {entries.map(([currency, total]) => (
        <div key={currency} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{currency}</span>
          <span className="font-semibold text-destructive">{formatMoney(total, currency)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Read-only view. ak_project_expense_transactions is a deprecated write path — entries here
 * are never read by project-statement.php, Genel Bakış, or Gidenler (see
 * FULL_SIDEBAR_SYSTEM_AUDIT_REPORT.md P0 item E). Creating/editing/deleting is disabled both
 * here and at the backend; existing historical rows remain visible for reference only.
 */
export default function AdminProjectExpenses() {
  const { id: projectId } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<AkExpenseTransaction[]>([]);
  const [profitability, setProfitability] = useState<AkExpenseProfitability>({ realized: {}, planned: {}, today: "" });
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await getProjectExpenseTransactions(projectId);
      setTransactions(data.transactions);
      setProfitability(data.profitability);
      setProjectTitle(data.project?.title ?? "");
    } catch {
      toast({ title: "Gider kayıtları alınamadı.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const byCurrency: Record<string, { count: number; total: number }> = {};
    for (const tx of transactions) {
      if (!byCurrency[tx.currency]) byCurrency[tx.currency] = { count: 0, total: 0 };
      byCurrency[tx.currency].count++;
      byCurrency[tx.currency].total += parseFloat(String(tx.amount));
    }
    return byCurrency;
  }, [transactions]);

  if (!projectId) return <div className="py-12 text-center text-sm text-muted-foreground">Proje bulunamadı.</div>;

  return (
    <div>
      <AdminPageHeader
        eyebrow={projectTitle || "Proje"}
        title="Proje Giderleri (Kullanım Dışı)"
        description="Bu modül artık kullanılmamaktadır. Aşağıdaki kayıtlar yalnızca geçmiş referans amaçlıdır."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to={`/admin/projeler/${projectId}/finans`}><ArrowLeft className="h-4 w-4" /> Finans</Link>
          </Button>
        }
      />

      <div className="mb-5 flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold">Bu sayfa devre dışı bırakıldı (deprecated).</p>
          <p className="mt-1">
            Buradaki kayıtlar (<code>ak_project_expense_transactions</code>) hiçbir güncel raporda
            (Genel Bakış, Gidenler, Proje Finansı) görünmez. Yeni gider ekleme, düzenleme ve silme
            işlemleri devre dışıdır. Yeni giderleri <Link to="/admin/gidenler" className="font-medium underline">Gidenler</Link> veya{" "}
            <Link to="/admin/gider-kartlari" className="font-medium underline">Masraf Kartları</Link> üzerinden kart
            tabanlı finansal hareket olarak girin.
          </p>
        </div>
      </div>

      {/* Profitability summary (historical reference only) */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingDown className="h-4 w-4 text-destructive" /> Gerçekleşen Gider
            <span className="ml-auto text-xs text-muted-foreground">({profitability.today} tarihine kadar)</span>
          </div>
          <ProfitabilityPanel profitability={profitability.realized} />
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-amber-500" /> Planlanan Gider (Toplam)
            <span className="ml-auto text-xs text-muted-foreground">Gelecek dahil</span>
          </div>
          <ProfitabilityPanel profitability={profitability.planned} />
        </div>
      </div>

      {/* Summary by currency */}
      {Object.keys(summary).length > 0 && (
        <div className="mb-5 rounded-md border border-border bg-card p-4">
          <div className="mb-3 text-sm font-semibold text-muted-foreground">Özet</div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            {Object.entries(summary).map(([currency, { count, total }]) => (
              <div key={currency} className="rounded-md bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">{CURRENCY_LABELS[currency] ?? currency}</div>
                <div className="text-lg font-bold">{formatMoney(total, currency)}</div>
                <div className="text-xs text-muted-foreground">{count} kayıt</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction list — read-only */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</div>
      ) : transactions.length === 0 ? (
        <AdminEmptyState
          title="Bu projede kayıtlı gider yok."
          description="Bu modül kullanım dışı olduğundan yeni kayıt eklenemez."
          icon={TrendingDown}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Tarih</th>
                <th className="p-3">Gider Kalemi</th>
                <th className="p-3 text-right">Tutar</th>
                <th className="p-3">Para Birimi</th>
                <th className="p-3 text-right">Kur</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-border">
                  <td className="p-3 text-muted-foreground">{formatDate(tx.expense_date)}</td>
                  <td className="p-3 font-medium">{tx.expense_item_name_snapshot}</td>
                  <td className="p-3 text-right font-semibold text-destructive">{formatMoney(tx.amount, tx.currency)}</td>
                  <td className="p-3 text-muted-foreground">{tx.currency}</td>
                  <td className="p-3 text-right text-muted-foreground">
                    {tx.exchange_rate_snapshot != null
                      ? <>{parseFloat(String(tx.exchange_rate_snapshot)).toFixed(4)}{Boolean(tx.exchange_rate_overridden) && <span className="ml-1 text-xs text-amber-500">*</span>}</>
                      : "—"}
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
