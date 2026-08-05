import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  createEmployeeAllocation,
  deleteEmployeeAllocation,
  getAdminProjects,
  getEmployeeAllocations,
  updateEmployeeAllocation,
} from "@/lib/apiClient";
import type { AkEmployeeProjectAllocation, PublicProject } from "@/lib/apiTypes";

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function formatTRY(v: string | number): string {
  return Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export default function AdminEmployeeAllocations() {
  const { id: employeeId } = useParams();
  const { toast } = useToast();
  const [allocations, setAllocations] = useState<AkEmployeeProjectAllocation[]>([]);
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AkEmployeeProjectAllocation | null>(null);
  const [editDays, setEditDays] = useState("");
  const [editBase, setEditBase] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [form, setForm] = useState({
    project_id: "",
    allocation_year: String(currentYear),
    allocation_month: String(new Date().getMonth() + 1),
    days_worked: "",
    working_days_base: "22",
    notes: "",
  });

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setLoadError(false);
    // Independent settlement so a failing allocations call never wipes out an
    // otherwise-successful project list (the same getAdminProjects() call
    // that already works in the generic financial-movement dialog) — P1-1.
    const [allocsResult, projsResult] = await Promise.allSettled([
      getEmployeeAllocations(employeeId),
      getAdminProjects(),
    ]);
    if (allocsResult.status === "fulfilled") setAllocations(allocsResult.value);
    if (projsResult.status === "fulfilled") setProjects(projsResult.value);
    if (allocsResult.status === "rejected" || projsResult.status === "rejected") {
      setLoadError(true);
      toast({ title: "Tahsisat verileri yüklenemedi.", variant: "destructive" });
    }
    setLoading(false);
  }, [employeeId, toast]);

  useEffect(() => { load(); }, [load]);

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate() {
    if (!form.project_id) {
      toast({ title: "Proje seçilmesi zorunludur.", variant: "destructive" });
      return;
    }
    if (!form.days_worked || Number(form.days_worked) <= 0) {
      toast({ title: "Çalışma günü 0'dan büyük olmalıdır.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await createEmployeeAllocation({
        employee_id: employeeId!,
        project_id: form.project_id,
        allocation_year: Number(form.allocation_year),
        allocation_month: Number(form.allocation_month),
        days_worked: Number(form.days_worked),
        working_days_base: Number(form.working_days_base),
        notes: form.notes.trim() || null,
      });
      toast({ title: "Tahsisat oluşturuldu." });
      setDialogOpen(false);
      setForm({
        project_id: "",
        allocation_year: String(currentYear),
        allocation_month: String(new Date().getMonth() + 1),
        days_worked: "",
        working_days_base: "22",
        notes: "",
      });
      await load();
    } catch (error: any) {
      toast({ title: "Tahsisat oluşturulamadı.", description: error?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function openEdit(a: AkEmployeeProjectAllocation) {
    setEditTarget(a);
    setEditDays(String(a.days_worked));
    setEditBase(String(a.working_days_base));
    setEditNotes(a.notes ?? "");
    setEditDialogOpen(true);
  }

  async function handleEdit() {
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateEmployeeAllocation({
        id: editTarget.id,
        days_worked: Number(editDays),
        working_days_base: Number(editBase),
        notes: editNotes.trim() || null,
      });
      toast({ title: "Tahsisat güncellendi." });
      setEditDialogOpen(false);
      setEditTarget(null);
      await load();
    } catch (error: any) {
      toast({ title: "Güncellenemedi.", description: error?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu tahsisat kaydını silmek istediğinize emin misiniz?")) return;
    try {
      await deleteEmployeeAllocation(id);
      toast({ title: "Tahsisat silindi." });
      await load();
    } catch (error: any) {
      toast({ title: "Silinemedi.", description: error?.message, variant: "destructive" });
    }
  }

  if (!employeeId) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Personel bulunamadı.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/admin/personeller`}><ChevronLeft className="h-4 w-4" /> Personeller</Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Proje Tahsisatları</h1>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent-glow">
            <Plus className="h-4 w-4 mr-1" /> Tahsisat Ekle
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</div>
      ) : loadError ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-destructive/40 px-4 py-8 text-center text-sm text-destructive">
          <span>Tahsisat verileri yüklenemedi.</span>
          <Button size="sm" variant="outline" onClick={() => load()}>Tekrar Dene</Button>
        </div>
      ) : allocations.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Henüz tahsisat kaydı yok. "Tahsisat Ekle" ile başlayın.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Dönem</th>
                <th className="p-3">Proje</th>
                <th className="p-3 text-right">Çalışma Günü</th>
                <th className="p-3 text-right">Gün Bazı</th>
                <th className="p-3 text-right">Hesaplanan Maliyet</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3 font-medium whitespace-nowrap">
                    {MONTHS[a.allocation_month - 1]} {a.allocation_year}
                  </td>
                  <td className="p-3">{a.project_title ?? a.project_id}</td>
                  <td className="p-3 text-right tabular-nums">{Number(a.days_worked).toFixed(1)}</td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground">{a.working_days_base}</td>
                  <td className="p-3 text-right font-semibold tabular-nums">{formatTRY(a.calculated_cost)}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Tahsisat Ekle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Proje *</Label>
              <Select value={form.project_id} onValueChange={(v) => setField("project_id", v)}>
                <SelectTrigger><SelectValue placeholder="Proje seçin..." /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Yıl *</Label>
                <Select value={form.allocation_year} onValueChange={(v) => setField("allocation_year", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ay *</Label>
                <Select value={form.allocation_month} onValueChange={(v) => setField("allocation_month", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Çalışma Günü *</Label>
                <Input type="number" min="0.5" step="0.5" placeholder="ör. 10" value={form.days_worked} onChange={(e) => setField("days_worked", e.target.value)} />
              </div>
              <div>
                <Label>Gün Bazı *</Label>
                <Input type="number" min="1" max="31" step="1" placeholder="22" value={form.working_days_base} onChange={(e) => setField("working_days_base", e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Bu ayın toplam çalışma günü sayısı</p>
              </div>
            </div>
            <div>
              <Label>Notlar</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Vazgeç</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Tahsisat Düzenle</DialogTitle></DialogHeader>
          {editTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {MONTHS[editTarget.allocation_month - 1]} {editTarget.allocation_year} — {editTarget.project_title}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Çalışma Günü *</Label>
                  <Input type="number" min="0.5" step="0.5" value={editDays} onChange={(e) => setEditDays(e.target.value)} />
                </div>
                <div>
                  <Label>Gün Bazı *</Label>
                  <Input type="number" min="1" max="31" step="1" value={editBase} onChange={(e) => setEditBase(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Notlar</Label>
                <Textarea rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <p>Maliyet anlık görüntüsü: {formatTRY(editTarget.monthly_cost_snapshot)}</p>
                <p>Yeni hesaplanan maliyet: {formatTRY((Number(editDays) / (Number(editBase) || 1)) * Number(editTarget.monthly_cost_snapshot))}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>Vazgeç</Button>
            <Button onClick={handleEdit} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              {saving ? "Kaydediliyor..." : "Güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
