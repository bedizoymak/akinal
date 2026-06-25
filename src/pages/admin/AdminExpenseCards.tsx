import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit, Layers, Plus, Search, Trash2 } from "lucide-react";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createAdminExpenseItem, deleteAdminExpenseItem, getAdminExpenseItems, updateAdminExpenseItem } from "@/lib/apiClient";
import type { AdminExpenseCard } from "@/lib/apiTypes";

type ItemForm = { id: string | null; name: string };
const emptyForm: ItemForm = { id: null, name: "" };

export default function AdminExpenseCards() {
  const { toast } = useToast();
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
      toast({ title: "Gider kalemleri alınamadı.", variant: "destructive" });
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
    if (!form.name.trim()) { setFormError("Gider kalemi adı zorunludur."); return; }
    setSaving(true);
    setFormError("");
    try {
      if (form.id) await updateAdminExpenseItem({ id: form.id, name: form.name.trim() });
      else await createAdminExpenseItem({ name: form.name.trim() });
    } catch {
      setSaving(false);
      toast({ title: "Gider kalemi kaydedilemedi.", variant: "destructive" });
      return;
    }
    setSaving(false);
    toast({ title: form.id ? "Gider kalemi güncellendi." : "Gider kalemi oluşturuldu." });
    setDialogOpen(false);
    await load();
  }

  async function remove(item: AdminExpenseCard) {
    if (!confirm(`"${item.name}" gider kalemini silmek istediğinize emin misiniz?\n\nBu kalem geçmiş gider kayıtlarından bağlantısı kaldırılır; isim kopyaları korunur.`)) return;
    try {
      await deleteAdminExpenseItem(item.id);
      toast({ title: "Gider kalemi silindi." });
      await load();
    } catch {
      toast({ title: "Gider kalemi silinemedi.", variant: "destructive" });
    }
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Finans"
        title="Gider Kalemleri"
        description="Projeler genelinde tekrar kullanılabilir gider kalemlerini yönetin. Demir, Çimento, Nakliye, Ruhsat gibi kalemler buradan tanımlanır."
        actions={<Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent-glow"><Plus className="h-4 w-4" /> Yeni Gider Kalemi</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <AdminMetricCard label="Toplam Gider Kalemi" value={items.length} description="Kayıtlı kalem sayısı" icon={Layers} tone="accent" />
        <AdminMetricCard label="Filtre Sonucu" value={filtered.length} description="Arama sonucu" icon={Search} tone="default" />
      </div>

      <div className="mb-5 rounded-md border border-border bg-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Gider kalemi ara..." className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title={items.length === 0 ? "Henüz gider kalemi oluşturulmamış." : "Gider kalemi bulunamadı."}
          description="Yeni gider kalemi oluşturarak proje giderlerini standart kalemler üzerinden takip edebilirsiniz."
          icon={Layers}
          action={<Button onClick={openCreate}>Yeni Gider Kalemi Ekle</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Gider Kalemi</th>
                <th className="p-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-border transition-colors hover:bg-emerald-50/60">
                  <td className="p-3 font-semibold">{item.name}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(item)} title="Düzenle">
                        <Edit className="h-4 w-4" /><span className="sr-only xl:not-sr-only xl:ml-1">Düzenle</span>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(item)} title="Sil">
                        <Trash2 className="h-4 w-4 text-destructive" /><span className="sr-only xl:not-sr-only xl:ml-1">Sil</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Gider Kalemini Düzenle" : "Yeni Gider Kalemi"}</DialogTitle>
          </DialogHeader>
          {formError && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>}
          <div>
            <Label>Gider Kalemi Adı *</Label>
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
