import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { CardStatementTable } from "@/components/admin/finance/CardStatementTable";
import type { CardEntryFormValues } from "@/components/admin/finance/CardEntryForm";
import { useToast } from "@/hooks/use-toast";
import {
  getExpenseCardFinancialEntries,
  createExpenseCardFinancialEntry,
  updateExpenseCardFinancialEntry,
  deleteExpenseCardFinancialEntry,
  getAdminProjects,
  getAdminExpenseItems,
} from "@/lib/apiClient";

export default function AdminExpenseCardFinance() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: cards = [] } = useQuery({
    queryKey: ["admin-expense-cards"],
    queryFn: getAdminExpenseItems,
  });
  const card = cards.find((c) => c.id === id);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["expense-card-financial-entries", id],
    queryFn: () => getExpenseCardFinancialEntries({ expense_card_id: id }),
    enabled: !!id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: getAdminProjects,
  });

  if (!id) return <div className="py-12 text-center text-sm text-muted-foreground">Gider kartı bulunamadı.</div>;

  const totalPlanned = entries.reduce((s, e) => s + Number(e.amount_try), 0);
  const totalPaid = entries.reduce((s, e) => s + Number(e.paid_amount_try), 0);

  function fmtTRY(v: number) {
    return "₺" + v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function handleAdd(values: CardEntryFormValues) {
    await createExpenseCardFinancialEntry({ expense_card_id: id!, project_id: values.project_id, entry_date: values.entry_date, title: values.title, notes: values.notes || null, amount: values.amount, paid_amount: values.paid_amount, currency: values.currency, exchange_rate_to_try: values.exchange_rate_to_try, is_exchange_rate_manual: values.is_exchange_rate_manual, account_type: values.account_type, payment_method: values.payment_method });
    await qc.invalidateQueries({ queryKey: ["expense-card-financial-entries", id] });
    toast({ title: "Kayıt eklendi." });
  }
  async function handleEdit(entryId: string, values: CardEntryFormValues) {
    await updateExpenseCardFinancialEntry({ id: entryId, expense_card_id: id!, project_id: values.project_id, entry_date: values.entry_date, title: values.title, notes: values.notes || null, amount: values.amount, paid_amount: values.paid_amount, currency: values.currency, exchange_rate_to_try: values.exchange_rate_to_try, is_exchange_rate_manual: values.is_exchange_rate_manual, account_type: values.account_type, payment_method: values.payment_method });
    await qc.invalidateQueries({ queryKey: ["expense-card-financial-entries", id] });
    toast({ title: "Kayıt güncellendi." });
  }
  async function handleDelete(entryId: string) {
    await deleteExpenseCardFinancialEntry(entryId);
    await qc.invalidateQueries({ queryKey: ["expense-card-financial-entries", id] });
    toast({ title: "Kayıt silindi." });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={card?.name ?? "Masraf Kartı"}
        description="Masraf kartı finansal hareketleri"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/gider-kartlari"><ArrowLeft className="mr-1 h-4 w-4" /> Masraf Kartları</Link>
          </Button>
        }
      />

      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Toplam", value: fmtTRY(totalPlanned), color: "text-foreground" },
            { label: "Ödenen", value: fmtTRY(totalPaid), color: "text-emerald-600" },
            { label: "Kalan", value: fmtTRY(totalPlanned - totalPaid), color: totalPlanned - totalPaid > 0 ? "text-amber-600" : "text-emerald-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-card-soft">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className={`mt-1 text-2xl font-extrabold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5 shadow-card-soft">
        <CardStatementTable
          entries={entries as any}
          projects={projects.map((p) => ({ id: p.id, title: p.title }))}
          direction="expense"
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
          loading={isLoading}
          title="Gider Kalemleri"
        />
      </div>
    </div>
  );
}
