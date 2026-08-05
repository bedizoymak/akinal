import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { createEmployeeCostPeriod, deleteEmployeeCostPeriod, getEmployeeCostPeriods } from "@/lib/apiClient";
import type { AkEmployeeCostPeriod } from "@/lib/apiTypes";

interface Props {
  employeeId: string;
}

const COST_FIELDS: { key: keyof AkEmployeeCostPeriod; label: string }[] = [
  { key: "salary", label: "Maaş" },
  { key: "sgk", label: "SGK" },
  { key: "meal", label: "Yemek" },
  { key: "transportation", label: "Ulaşım" },
  { key: "bonus", label: "İkramiye" },
  { key: "accommodation", label: "Konaklama" },
  { key: "other", label: "Diğer" },
];

function monthlyTotal(p: AkEmployeeCostPeriod): number {
  return ["salary", "sgk", "meal", "transportation", "bonus", "accommodation", "other"]
    .reduce((sum, k) => sum + Number(p[k as keyof AkEmployeeCostPeriod] ?? 0), 0);
}

function formatTRY(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

type FormValues = {
  effective_from: string;
  salary: string;
  sgk: string;
  meal: string;
  transportation: string;
  bonus: string;
  accommodation: string;
  other: string;
  notes: string;
};

const emptyForm: FormValues = {
  effective_from: new Date().toISOString().slice(0, 10),
  salary: "",
  sgk: "",
  meal: "",
  transportation: "",
  bonus: "",
  accommodation: "",
  other: "",
  notes: "",
};

export function CostPeriodsPanel({ employeeId }: Props) {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<AkEmployeeCostPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormValues>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setPeriods(await getEmployeeCostPeriods(employeeId));
    } catch {
      setLoadError(true);
      toast({ title: "Maliyet dönemleri yüklenemedi.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [employeeId, toast]);

  useEffect(() => { load(); }, [load]);

  function setField(key: keyof FormValues, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.effective_from) {
      toast({ title: "Geçerlilik tarihi zorunludur.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await createEmployeeCostPeriod({
        employee_id: employeeId,
        effective_from: form.effective_from,
        salary: Number(form.salary) || 0,
        sgk: Number(form.sgk) || 0,
        meal: Number(form.meal) || 0,
        transportation: Number(form.transportation) || 0,
        bonus: Number(form.bonus) || 0,
        accommodation: Number(form.accommodation) || 0,
        other: Number(form.other) || 0,
        notes: form.notes.trim() || null,
      });
      toast({ title: "Maliyet dönemi oluşturuldu." });
      setDialogOpen(false);
      setForm(emptyForm);
      await load();
    } catch (error: any) {
      toast({ title: "Maliyet dönemi oluşturulamadı.", description: error?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu maliyet dönemini silmek istediğinize emin misiniz?")) return;
    try {
      await deleteEmployeeCostPeriod(id);
      toast({ title: "Maliyet dönemi silindi." });
      await load();
    } catch (error: any) {
      toast({ title: "Silinemedi.", description: error?.message, variant: "destructive" });
    }
  }

  const bonusWarning = Number(form.bonus) > 0;

  if (loading) return <div className="py-4 text-sm text-muted-foreground">Yükleniyor...</div>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Maliyet Dönemleri</h3>
        <Button size="sm" variant="outline" onClick={() => { setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Yeni Dönem
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-md border border-dashed border-destructive/40 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>Maliyet dönemleri yüklenemedi.</span>
          <Button size="sm" variant="outline" onClick={() => load()}>Tekrar Dene</Button>
        </div>
      ) : periods.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Henüz maliyet dönemi girilmemiş.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-2">Başlangıç</th>
                <th className="p-2">Bitiş</th>
                <th className="p-2 text-right">Aylık Toplam</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-2 font-medium">{p.effective_from}</td>
                  <td className="p-2 text-muted-foreground">{p.effective_to ?? <span className="text-emerald-600 font-medium">Açık</span>}</td>
                  <td className="p-2 text-right font-semibold tabular-nums">{formatTRY(monthlyTotal(p))}</td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Yeni Maliyet Dönemi</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Geçerlilik Başlangıcı *</Label>
              <Input type="date" value={form.effective_from} onChange={(e) => setField("effective_from", e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Varsa önceki açık dönem bu tarihten bir gün önce otomatik kapatılır.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {COST_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <Label>{label} (₺)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={form[key as keyof FormValues]}
                    onChange={(e) => setField(key as keyof FormValues, e.target.value)}
                  />
                </div>
              ))}
            </div>
            {bonusWarning && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                İkramiye her ay tekrar eden bir tutar olarak ayarlandı. Tek seferlik bir ödemeyse, ödeme sonrası yeni bir dönem oluşturun (ikramiye = 0).
              </div>
            )}
            <div>
              <Label>Notlar</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Vazgeç</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
