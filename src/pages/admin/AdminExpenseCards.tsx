import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, Edit, Layers, Plus, Search, Trash2 } from "lucide-react";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createAdminExpenseItem, deleteAdminExpenseItem, getAdminExpenseItems, updateAdminExpenseItem } from "@/lib/apiClient";
import type { AdminExpenseCard } from "@/lib/apiTypes";

function fmtTRY(v: number | string | null | undefined) {
  return "₺" + Number(v ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ItemForm = { id: string | null; name: string };
const emptyForm: ItemForm = { id: null, name: "" };

export default function AdminExpenseCards() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminExpenseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getAdminExpenseItems());
    } catch {
      toast({ title: "Masraf kartları alınamadı.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLocaleLowerCase("tr-TR");
    return items.filter((item) => item.name.toLocaleLowerCase("tr-TR").includes(q));
  }, [items, search]);

  function openCreate() { setForm(emptyForm); setFormError(""); setDialogOpen(true); }
  function openEdit(item: AdminExpenseCard) { setForm({ id: item.id, name: item.name }); setFormError(""); setDialogOpen(true); }

  async function save() {
    if (!form.name.trim()) { setFormError("Masraf kartı adı zorunludur."); return; }
    setSaving(true);
    setFormError("");
    try {
      if (form.id) await updateAdminExpenseItem({ id: form.id, name: form.name.trim() });
      else await createAdminExpenseItem({ name: form.name.trim() });
    } catch {
      setSaving(false);
      toast({ title: "Masraf kartı kaydedilemedi.", variant: "destructive" });
      return;
    }
    setSaving(false);
    toast({ title: form.id ? "Masraf kartı güncellendi." : "Masraf kartı oluşturuldu." });
    setDialogOpen(false);
    await load();
  }

  async function remove(item: AdminExpenseCard) {
    if (!confirm(`"${item.name}" masraf kartını silmek istediğinize emin misiniz?\n\nSilme işlemi yalnızca bu karta bağlı hiçbir finansal hareket yoksa yapılabilir. Bağlı kayıt varsa işlem reddedilecektir.`)) return;
    try {
      await deleteAdminExpenseItem(item.id);
      toast({ title: "Masraf kartı silindi." });
      await load();
    } catch (error) {
      toast({
        title: "Masraf kartı silinemedi.",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Tedarik ve Giderler"
        title="Masraf Kartları"
        description="Her kart bağlı proje giderlerini ve mali hareketleri takip eder."
        actions={<Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent-glow"><Plus className="h-4 w-4" /> Yeni Masraf Kartı</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <AdminMetricCard label="Toplam Masraf Kartı" value={items.length} description="Kayıtlı kart sayısı" icon={Layers} tone="accent" />
        <AdminMetricCard label="Filtre Sonucu" value={filtered.length} description="Arama sonucu" icon={Search} tone="default" />
      </div>

      <div className="mb-5 rounded-md border border-border bg-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Masraf kartı ara..." className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title={items.length === 0 ? "Henüz masraf kartı oluşturulmamış." : "Masraf kartı bulunamadı."}
          description="Yeni masraf kartı oluşturarak proje giderlerini takip edebilirsiniz."
          icon={Layers}
          action={<Button onClick={openCreate}>Yeni Masraf Kartı Ekle</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Masraf Kartı</th>
                <th className="p-3 text-right">Kayıt</th>
                <th className="p-3 text-right">Planlanan</th>
                <th className="p-3 text-right">Ödenen</th>
                <th className="p-3 text-right">Kalan</th>
                <th className="p-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const remaining = Number(item.remaining_total ?? 0);
                return (
                  <tr key={item.id} className="border-t border-border transition-colors hover:bg-muted/20 cursor-pointer" onClick={() => navigate(`/admin/gider-kartlari/${item.id}/finans`)}>
                    <td className="p-3 font-semibold">{item.name}</td>
                    <td className="p-3 text-right tabular-nums text-muted-foreground">{item.entry_count ?? 0}</td>
                    <td className="p-3 text-right tabular-nums">{fmtTRY(item.planned_total)}</td>
                    <td className="p-3 text-right tabular-nums text-emerald-700">{fmtTRY(item.paid_total)}</td>
                    <td className={`p-3 text-right tabular-nums font-medium ${remaining > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{fmtTRY(remaining)}</td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" asChild title="Ekstre">
                          <Link to={`/admin/gider-kartlari/${item.id}/finans`}>
                            <BarChart3 className="h-4 w-4" /><span className="sr-only xl:not-sr-only xl:ml-1">Ekstre</span>
                          </Link>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(item)} title="Düzenle">
                          <Edit className="h-4 w-4" /><span className="sr-only xl:not-sr-only xl:ml-1">Düzenle</span>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(item)} title="Sil">
                          <Trash2 className="h-4 w-4 text-destructive" /><span className="sr-only xl:not-sr-only xl:ml-1">Sil</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Masraf Kartını Düzenle" : "Yeni Masraf Kartı"}</DialogTitle>
          </DialogHeader>
          {formError && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>}
          <div>
            <Label>Kart Adı *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="örn. Demir, Çimento, Nakliye, Ruhsat..."
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
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
