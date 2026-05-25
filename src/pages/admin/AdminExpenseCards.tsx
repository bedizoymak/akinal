import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Edit, FileText, Layers, Plus, Search, Tags, Trash2 } from "lucide-react";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { financeSupabase, type ExpenseCardInsert, type ExpenseCardRow, type ExpenseCardUpdate } from "@/lib/financialTypes";
import { cn } from "@/lib/utils";

const EXPENSE_CARD_STATUSES = ["Aktif", "Pasif"] as const;
const DEFAULT_CATEGORIES = [
  "Malzeme",
  "Vergi",
  "Ruhsat",
  "Kamu İzni",
  "İnşaat İzni",
  "Arsa Gideri",
  "Tapu",
  "Harç",
  "Taşeron",
  "Nakliye",
  "Şantiye Gideri",
  "Diğer",
] as const;

type ExpenseCardForm = {
  id: string | null;
  name: string;
  category: string;
  description: string;
  status: string;
};

const emptyForm: ExpenseCardForm = {
  id: null,
  name: "",
  category: "",
  description: "",
  status: "Aktif",
};

function formFromCard(card: ExpenseCardRow): ExpenseCardForm {
  return {
    id: card.id,
    name: card.name,
    category: card.category ?? "",
    description: card.description ?? "",
    status: card.status,
  };
}

export default function AdminExpenseCards() {
  const { toast } = useToast();
  const [items, setItems] = useState<ExpenseCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ExpenseCardForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await financeSupabase.from("expense_cards").select("*").order("name", { ascending: true });
    if (error) {
      toast({ title: "Bir hata oluştu.", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setItems(data ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => items.filter((card) => {
    if (statusFilter !== "all" && card.status !== statusFilter) return false;
    if (search) {
      const haystack = `${card.name} ${card.category ?? ""}`.toLocaleLowerCase("tr-TR");
      if (!haystack.includes(search.toLocaleLowerCase("tr-TR"))) return false;
    }
    return true;
  }), [items, search, statusFilter]);

  const summary = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.status === "Aktif").length,
    categories: new Set(items.map((item) => item.category).filter(Boolean)).size,
  }), [items]);

  function openCreate() {
    setForm(emptyForm);
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(card: ExpenseCardRow) {
    setForm(formFromCard(card));
    setFormError("");
    setDialogOpen(true);
  }

  function updateForm<K extends keyof ExpenseCardForm>(key: K, value: ExpenseCardForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveCard() {
    if (!form.name.trim()) {
      setFormError("Gider Kartı Adı zorunludur.");
      return;
    }

    setSaving(true);
    setFormError("");

    const payload: ExpenseCardInsert = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      status: form.status,
    };

    const result = form.id
      ? await financeSupabase.from("expense_cards").update(payload as ExpenseCardUpdate).eq("id", form.id)
      : await financeSupabase.from("expense_cards").insert(payload);

    setSaving(false);

    if (result.error) {
      toast({ title: "Bir hata oluştu.", description: result.error.message, variant: "destructive" });
      return;
    }

    toast({ title: form.id ? "Gider kartı güncellendi." : "Gider kartı oluşturuldu." });
    setDialogOpen(false);
    await load();
  }

  async function deleteCard(card: ExpenseCardRow) {
    if (!confirm(`"${card.name}" gider kartını silmek istediğinize emin misiniz?`)) return;

    const { error } = await financeSupabase.from("expense_cards").delete().eq("id", card.id);
    if (error) {
      toast({ title: "Bir hata oluştu.", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Gider kartı silindi." });
    await load();
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Finans"
        title="Gider Kartları"
        description="Malzeme, vergi, ruhsat, tapu, taşeron ve benzeri tekrar kullanılabilir gider kartlarını yönetin."
        actions={<Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent-glow"><Plus className="h-4 w-4" /> Yeni Gider Kartı</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <AdminMetricCard label="Toplam Gider Kartı" value={summary.total} description="Kayıtlı gider kartı" icon={Layers} tone="accent" />
        <AdminMetricCard label="Aktif" value={summary.active} description="Kullanılabilir kartlar" icon={Tags} tone="success" />
        <AdminMetricCard label="Kategori" value={summary.categories} description="Farklı kategori sayısı" icon={Tags} tone="default" />
      </div>

      <div className="mb-5 grid gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Gider kartı veya kategori ara..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            {EXPENSE_CARD_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title={items.length === 0 ? "Henüz gider kartı oluşturulmamış." : "Gider kartı bulunamadı"}
          description="Yeni gider kartı oluşturarak proje maliyetlerini standart kartlar üzerinden takip edebilirsiniz."
          icon={Layers}
          action={<Button onClick={openCreate}>Yeni Gider Kartı Ekle</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Gider Kartı</th>
                <th className="p-3">Kategori</th>
                <th className="p-3">Açıklama</th>
                <th className="p-3">Durum</th>
                <th className="p-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((card) => (
                <tr key={card.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 font-semibold">{card.name}</td>
                  <td className="p-3">{card.category || <span className="text-muted-foreground">—</span>}</td>
                  <td className="max-w-md truncate p-3 text-muted-foreground">{card.description || "—"}</td>
                  <td className="p-3">
                    <span className={cn("rounded-md border px-2 py-0.5 text-xs", card.status === "Aktif" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-zinc-50 text-zinc-600")}>
                      {card.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="sm" variant="outline"><Link to={`/admin/gider-kartlari/${card.id}/finans`}><FileText className="h-4 w-4" /> Ekstre</Link></Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(card)} title="Düzenle"><Edit className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteCard(card)} title="Sil"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Gider Kartını Düzenle" : "Yeni Gider Kartı"}</DialogTitle>
          </DialogHeader>
          {formError && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Gider Kartı Adı *</Label>
              <Input value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
            </div>
            <div>
              <Label>Kategori</Label>
              <Input list="expense-card-categories" value={form.category} onChange={(event) => updateForm("category", event.target.value)} />
              <datalist id="expense-card-categories">
                {DEFAULT_CATEGORIES.map((category) => <option key={category} value={category} />)}
              </datalist>
            </div>
            <div>
              <Label>Durum</Label>
              <Select value={form.status} onValueChange={(value) => updateForm("status", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CARD_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Açıklama</Label>
              <Textarea rows={3} value={form.description} onChange={(event) => updateForm("description", event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Vazgeç</Button>
            <Button onClick={saveCard} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
