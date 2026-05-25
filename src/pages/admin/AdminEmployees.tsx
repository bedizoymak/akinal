import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Edit, FileText, Plus, Search, Trash2, UserRound, Users } from "lucide-react";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { financeSupabase, type EmployeeInsert, type EmployeeRow, type EmployeeUpdate } from "@/lib/financialTypes";
import { cn } from "@/lib/utils";

const EMPLOYEE_STATUSES = ["Aktif", "Pasif"] as const;

type EmployeeForm = {
  id: string | null;
  full_name: string;
  phone: string;
  role: string;
  notes: string;
  status: string;
};

const emptyForm: EmployeeForm = {
  id: null,
  full_name: "",
  phone: "",
  role: "",
  notes: "",
  status: "Aktif",
};

function formFromEmployee(employee: EmployeeRow): EmployeeForm {
  return {
    id: employee.id,
    full_name: employee.full_name,
    phone: employee.phone ?? "",
    role: employee.role ?? "",
    notes: employee.notes ?? "",
    status: employee.status,
  };
}

export default function AdminEmployees() {
  const { toast } = useToast();
  const [items, setItems] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await financeSupabase.from("employees").select("*").order("full_name", { ascending: true });
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

  const filtered = useMemo(() => items.filter((employee) => {
    if (statusFilter !== "all" && employee.status !== statusFilter) return false;
    if (search) {
      const haystack = `${employee.full_name} ${employee.phone ?? ""} ${employee.role ?? ""}`.toLocaleLowerCase("tr-TR");
      if (!haystack.includes(search.toLocaleLowerCase("tr-TR"))) return false;
    }
    return true;
  }), [items, search, statusFilter]);

  const summary = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.status === "Aktif").length,
    passive: items.filter((item) => item.status === "Pasif").length,
  }), [items]);

  function openCreate() {
    setForm(emptyForm);
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(employee: EmployeeRow) {
    setForm(formFromEmployee(employee));
    setFormError("");
    setDialogOpen(true);
  }

  function updateForm<K extends keyof EmployeeForm>(key: K, value: EmployeeForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveEmployee() {
    if (!form.full_name.trim()) {
      setFormError("Ad Soyad zorunludur.");
      return;
    }

    setSaving(true);
    setFormError("");

    const payload: EmployeeInsert = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      role: form.role.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
    };

    const result = form.id
      ? await financeSupabase.from("employees").update(payload as EmployeeUpdate).eq("id", form.id)
      : await financeSupabase.from("employees").insert(payload);

    setSaving(false);

    if (result.error) {
      toast({ title: "Bir hata oluştu.", description: result.error.message, variant: "destructive" });
      return;
    }

    toast({ title: form.id ? "Personel güncellendi." : "Personel oluşturuldu." });
    setDialogOpen(false);
    await load();
  }

  async function deleteEmployee(employee: EmployeeRow) {
    if (!confirm(`"${employee.full_name}" personel kartını silmek istediğinize emin misiniz?`)) return;

    const { error } = await financeSupabase.from("employees").delete().eq("id", employee.id);
    if (error) {
      toast({ title: "Bir hata oluştu.", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Personel silindi." });
    await load();
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Personel"
        title="Personeller"
        description="Personel, usta, kalfa, taşeron ve şantiye çalışanı kartlarını yönetin."
        actions={<Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent-glow"><Plus className="h-4 w-4" /> Yeni Personel</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <AdminMetricCard label="Toplam Personel" value={summary.total} description="Kayıtlı personel kartı" icon={Users} tone="accent" />
        <AdminMetricCard label="Aktif" value={summary.active} description="Aktif çalışan/kart" icon={UserRound} tone="success" />
        <AdminMetricCard label="Pasif" value={summary.passive} description="Pasif kayıtlar" icon={UserRound} tone="default" />
      </div>

      <div className="mb-5 grid gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ad, telefon veya görev ara..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            {EMPLOYEE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title={items.length === 0 ? "Henüz personel kartı oluşturulmamış." : "Personel bulunamadı"}
          description="Yeni personel kartı oluşturarak ödeme ve proje ekstrelerini takip edebilirsiniz."
          icon={Users}
          action={<Button onClick={openCreate}>Yeni Personel Ekle</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Personel</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Görev</th>
                <th className="p-3">Durum</th>
                <th className="p-3">Notlar</th>
                <th className="p-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((employee) => (
                <tr key={employee.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 font-semibold">{employee.full_name}</td>
                  <td className="p-3">{employee.phone || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3">{employee.role || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3">
                    <span className={cn("rounded-md border px-2 py-0.5 text-xs", employee.status === "Aktif" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-zinc-50 text-zinc-600")}>
                      {employee.status}
                    </span>
                  </td>
                  <td className="max-w-xs truncate p-3 text-muted-foreground">{employee.notes || "—"}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="sm" variant="outline"><Link to={`/admin/personeller/${employee.id}/finans`}><FileText className="h-4 w-4" /> Ekstre</Link></Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(employee)} title="Düzenle"><Edit className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteEmployee(employee)} title="Sil"><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
            <DialogTitle>{form.id ? "Personeli Düzenle" : "Yeni Personel"}</DialogTitle>
          </DialogHeader>
          {formError && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Ad Soyad *</Label>
              <Input value={form.full_name} onChange={(event) => updateForm("full_name", event.target.value)} />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} />
            </div>
            <div>
              <Label>Görev</Label>
              <Input value={form.role} onChange={(event) => updateForm("role", event.target.value)} placeholder="Usta, taşeron, personel..." />
            </div>
            <div>
              <Label>Durum</Label>
              <Select value={form.status} onValueChange={(value) => updateForm("status", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMPLOYEE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Notlar</Label>
              <Textarea rows={3} value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Vazgeç</Button>
            <Button onClick={saveEmployee} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
