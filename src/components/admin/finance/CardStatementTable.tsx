import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { EntryStatusBadge } from "./EntryStatusBadge";
import { CurrencyAmount } from "./CurrencyAmount";
import { CardEntryForm, type CardEntryFormValues } from "./CardEntryForm";
import type { CardFinancialEntry } from "@/lib/apiTypes";

interface Project {
  id: string;
  title: string;
}

interface Props {
  entries: CardFinancialEntry[];
  projects: Project[];
  direction?: "income" | "expense";
  onAdd: (values: CardEntryFormValues) => Promise<void>;
  onEdit: (id: string, values: CardEntryFormValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  loading?: boolean;
  title?: string;
}

function fmtDate(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("tr-TR"); } catch { return d; }
}

function fmtTRY(v: number | string) {
  return "₺" + Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CardStatementTable({ entries, projects, direction, onAdd, onEdit, onDelete, loading, title }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<CardFinancialEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalPlanned = entries.reduce((s, e) => s + Number(e.amount_try), 0);
  const totalPaid = entries.reduce((s, e) => s + Number(e.paid_amount_try), 0);

  async function handleDelete(id: string) {
    if (!confirm("Bu kayıt silinsin mi?")) return;
    setDeletingId(id);
    try { await onDelete(id); } finally { setDeletingId(null); }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold">{title ?? "Mali Hareketler"}</span>
          {entries.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              Planlanan: {fmtTRY(totalPlanned)} · Ödenen: {fmtTRY(totalPaid)}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => { setEditEntry(null); setFormOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Ekle
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {loading ? "Yükleniyor..." : "Henüz kayıt yok."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tarih</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Başlık</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Planlanan</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ödenen</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Durum</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Proje</th>
                <th className="w-16 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 tabular-nums">{fmtDate(e.entry_date)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{e.title}</div>
                    {e.notes && <div className="text-[11px] text-muted-foreground">{e.notes}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <CurrencyAmount amount={e.amount} currency={e.currency} amountTry={e.amount_try} showTry={e.currency !== "TRY"} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <CurrencyAmount amount={e.paid_amount} currency={e.currency} amountTry={e.paid_amount_try} showTry={e.currency !== "TRY"} />
                  </td>
                  <td className="px-3 py-2">
                    <EntryStatusBadge status={e.status} isOverdue={e.is_overdue} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {e.project_title ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => { setEditEntry(e); setFormOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        disabled={deletingId === e.id}
                        onClick={() => handleDelete(e.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CardEntryForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditEntry(null); }}
        onSave={async (values) => {
          if (editEntry) {
            await onEdit(editEntry.id, values);
          } else {
            await onAdd(values);
          }
        }}
        initial={editEntry ?? undefined}
        projects={projects}
        direction={direction}
      />
    </div>
  );
}
