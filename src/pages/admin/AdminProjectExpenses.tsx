import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Edit, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { EXPENSE_CURRENCIES } from "@/lib/finance";
import {
  createAdminExpenseItem,
  createProjectExpenseTransaction,
  deleteProjectExpenseTransaction,
  getAdminExpenseItems,
  getProjectExpenseTransactions,
  updateProjectExpenseTransaction,
} from "@/lib/apiClient";
import type { AdminExpenseCard, AkExpenseTransaction, AkExpenseProfitability } from "@/lib/apiTypes";

type TxForm = {
  id: string | null;
  expense_item_id: string;
  expense_item_name_snapshot: string;
  amount: string;
  currency: string;
  exchange_rate_snapshot: string;
  exchange_rate_overridden: boolean;
  expense_date: string;
};

const today = new Date().toISOString().slice(0, 10);

const emptyForm: TxForm = {
  id: null,
  expense_item_id: "",
  expense_item_name_snapshot: "",
  amount: "",
  currency: "TRY",
  exchange_rate_snapshot: "",
  exchange_rate_overridden: false,
  expense_date: today,
};

const CURRENCY_LABELS: Record<string, string> = {
  TRY: "₺ TRY",
  USD: "$ USD",
  EUR: "€ EUR",
  XAU_GRAM: "Au XAU/gr",
};

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

function ProfitabilityPanel({ profitability, label }: { profitability: Record<string, string | number>; label: string }) {
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

export default function AdminProjectExpenses() {
  const { id: projectId } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<AkExpenseTransaction[]>([]);
  const [profitability, setProfitability] = useState<AkExpenseProfitability>({ realized: {}, planned: {}, today: "" });
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TxForm>(emptyForm);
  const [formError, setFormError] = useState("");

  // Autocomplete state
  const [itemSearch, setItemSearch] = useState("");
  const [itemSuggestions, setItemSuggestions] = useState<AdminExpenseCard[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Autocomplete search with debounce
  useEffect(() => {
    if (!dialogOpen) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!itemSearch.trim()) { setItemSuggestions([]); setShowSuggestions(false); return; }
    searchTimer.current = setTimeout(async () => {
      setLoadingItems(true);
      try {
        const results = await getAdminExpenseItems(itemSearch.trim());
        setItemSuggestions(results);
        setShowSuggestions(true);
      } catch {
        // silent
      } finally {
        setLoadingItems(false);
      }
    }, 250);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [itemSearch, dialogOpen]);

  function openCreate() {
    setForm(emptyForm);
    setFormError("");
    setItemSearch("");
    setItemSuggestions([]);
    setShowSuggestions(false);
    setDialogOpen(true);
  }

  function openEdit(tx: AkExpenseTransaction) {
    setForm({
      id: tx.id,
      expense_item_id: tx.expense_item_id ?? "",
      expense_item_name_snapshot: tx.expense_item_name_snapshot,
      amount: String(tx.amount),
      currency: tx.currency,
      exchange_rate_snapshot: tx.exchange_rate_snapshot != null ? String(tx.exchange_rate_snapshot) : "",
      exchange_rate_overridden: Boolean(tx.exchange_rate_overridden),
      expense_date: tx.expense_date,
    });
    setItemSearch(tx.expense_item_name_snapshot);
    setItemSuggestions([]);
    setShowSuggestions(false);
    setFormError("");
    setDialogOpen(true);
  }

  function selectItem(item: AdminExpenseCard) {
    setForm((f) => ({ ...f, expense_item_id: item.id, expense_item_name_snapshot: item.name }));
    setItemSearch(item.name);
    setShowSuggestions(false);
  }

  async function createAndSelectItem(name: string) {
    try {
      const newItem = await createAdminExpenseItem({ name: name.trim() });
      selectItem(newItem);
      toast({ title: `"${newItem.name}" gider kalemi oluşturuldu.` });
    } catch {
      toast({ title: "Gider kalemi oluşturulamadı.", variant: "destructive" });
    }
  }

  async function save() {
    if (!projectId) return;
    const name = form.expense_item_name_snapshot.trim() || itemSearch.trim();
    if (!name) { setFormError("Gider kalemi adı zorunludur."); return; }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { setFormError("Tutar 0'dan büyük olmalıdır."); return; }
    if (!form.expense_date) { setFormError("Tarih zorunludur."); return; }

    let itemId = form.expense_item_id || null;
    let itemName = name;

    // If the user typed a name but no item is selected, check if it matches a suggestion
    if (!itemId) {
      const match = itemSuggestions.find((s) => s.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"));
      if (match) {
        itemId = match.id;
        itemName = match.name;
      }
      // Otherwise create a new item silently
    }

    const rate = form.exchange_rate_snapshot !== "" ? parseFloat(form.exchange_rate_snapshot) : null;
    if (rate !== null && (isNaN(rate) || rate <= 0)) { setFormError("Kur değeri 0'dan büyük olmalıdır."); return; }

    setSaving(true);
    setFormError("");

    try {
      // If no item id yet, create the item first
      if (!itemId) {
        const newItem = await createAdminExpenseItem({ name: itemName });
        itemId = newItem.id;
        itemName = newItem.name;
      }

      const payload = {
        project_id: projectId,
        expense_item_id: itemId,
        expense_item_name_snapshot: itemName,
        amount,
        currency: form.currency,
        exchange_rate_snapshot: rate,
        exchange_rate_overridden: form.exchange_rate_overridden,
        expense_date: form.expense_date,
      };

      if (form.id) await updateProjectExpenseTransaction({ ...payload, id: form.id });
      else await createProjectExpenseTransaction(payload);
    } catch (err) {
      setSaving(false);
      const msg = err instanceof Error ? err.message : "Gider kaydedilemedi.";
      toast({ title: msg, variant: "destructive" });
      return;
    }

    setSaving(false);
    toast({ title: form.id ? "Gider güncellendi." : "Gider eklendi." });
    setDialogOpen(false);
    await load();
  }

  async function remove(tx: AkExpenseTransaction) {
    if (!confirm(`"${tx.expense_item_name_snapshot}" gider kaydını silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.`)) return;
    try {
      await deleteProjectExpenseTransaction(tx.id);
      toast({ title: "Gider kaydı silindi." });
      await load();
    } catch {
      toast({ title: "Gider kaydı silinemedi.", variant: "destructive" });
    }
  }

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
        title="Proje Giderleri"
        description="Proje gider kayıtlarını yönetin. Her kayıt ayrı bir muhasebe olayıdır."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/projeler/${projectId}/finans`}><ArrowLeft className="h-4 w-4" /> Finans</Link>
            </Button>
            <Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              <Plus className="h-4 w-4" /> Gider Ekle
            </Button>
          </div>
        }
      />

      {/* Profitability summary */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingDown className="h-4 w-4 text-destructive" /> Gerçekleşen Gider
            <span className="ml-auto text-xs text-muted-foreground">({profitability.today} tarihine kadar)</span>
          </div>
          <ProfitabilityPanel profitability={profitability.realized} label="Gerçekleşen" />
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-amber-500" /> Planlanan Gider (Toplam)
            <span className="ml-auto text-xs text-muted-foreground">Gelecek dahil</span>
          </div>
          <ProfitabilityPanel profitability={profitability.planned} label="Planlanan" />
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

      {/* Transaction list */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</div>
      ) : transactions.length === 0 ? (
        <AdminEmptyState
          title="Henüz gider kaydı eklenmemiş."
          description="Projeye gider ekleyerek proje maliyetlerini ve kârlılığını takip edebilirsiniz."
          icon={TrendingDown}
          action={<Button onClick={openCreate}>Gider Ekle</Button>}
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
                <th className="p-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-border transition-colors hover:bg-emerald-50/60">
                  <td className="p-3 text-muted-foreground">{formatDate(tx.expense_date)}</td>
                  <td className="p-3 font-medium">{tx.expense_item_name_snapshot}</td>
                  <td className="p-3 text-right font-semibold text-destructive">{formatMoney(tx.amount, tx.currency)}</td>
                  <td className="p-3 text-muted-foreground">{tx.currency}</td>
                  <td className="p-3 text-right text-muted-foreground">
                    {tx.exchange_rate_snapshot != null
                      ? <>{parseFloat(String(tx.exchange_rate_snapshot)).toFixed(4)}{Boolean(tx.exchange_rate_overridden) && <span className="ml-1 text-xs text-amber-500">*</span>}</>
                      : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(tx)} title="Düzenle">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(tx)} title="Sil">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Gider Kaydını Düzenle" : "Yeni Gider Ekle"}</DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>
          )}

          <div className="grid gap-4">
            {/* Expense item autocomplete */}
            <div>
              <Label>Gider Kalemi *</Label>
              <div className="relative">
                <Input
                  value={itemSearch}
                  onChange={(e) => {
                    setItemSearch(e.target.value);
                    setForm((f) => ({ ...f, expense_item_id: "", expense_item_name_snapshot: e.target.value }));
                  }}
                  placeholder="Gider kalemi ara veya yeni oluştur..."
                  autoComplete="off"
                  onFocus={() => { if (itemSuggestions.length > 0) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                />
                {showSuggestions && (itemSuggestions.length > 0 || (itemSearch.trim() && !loadingItems)) && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
                    <div className="max-h-52 overflow-y-auto py-1">
                      {itemSuggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={() => selectItem(item)}
                        >
                          {item.name}
                        </button>
                      ))}
                      {itemSearch.trim() && !itemSuggestions.find((s) => s.name.toLocaleLowerCase("tr-TR") === itemSearch.trim().toLocaleLowerCase("tr-TR")) && (
                        <button
                          type="button"
                          className="w-full border-t border-border px-3 py-2 text-left text-sm text-accent hover:bg-accent/10"
                          onMouseDown={() => createAndSelectItem(itemSearch)}
                        >
                          + "{itemSearch.trim()}" yeni kalemi oluştur
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {form.expense_item_id && (
                <p className="mt-1 text-xs text-emerald-600">Seçildi: {form.expense_item_name_snapshot}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tutar *</Label>
                <Input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Para Birimi *</Label>
                <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{CURRENCY_LABELS[c] ?? c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kur Değeri <span className="text-xs text-muted-foreground">(opsiyonel)</span></Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.exchange_rate_snapshot}
                  onChange={(e) => setForm((f) => ({ ...f, exchange_rate_snapshot: e.target.value, exchange_rate_overridden: e.target.value !== "" }))}
                  placeholder="örn. 32.50"
                />
                {form.exchange_rate_overridden && (
                  <p className="mt-1 text-xs text-amber-600">Manuel kur (piyasa kurunu geçersiz kılar)</p>
                )}
              </div>
              <div>
                <Label>Gider Tarihi *</Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Vazgeç</Button>
            <Button onClick={save} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
