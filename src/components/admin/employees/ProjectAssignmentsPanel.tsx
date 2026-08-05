import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { createEmployeeAssignment, deleteEmployeeAssignment, getEmployeeAssignments, updateEmployeeAssignment } from "@/lib/apiClient";
import { getAdminProjects } from "@/lib/apiClient";
import type { AkEmployeeProjectAssignment, PublicProject } from "@/lib/apiTypes";

interface Props {
  employeeId: string;
}

export function ProjectAssignmentsPanel({ employeeId }: Props) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<AkEmployeeProjectAssignment[]>([]);
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ project_id: "", start_date: new Date().toISOString().slice(0, 10), notes: "" });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AkEmployeeProjectAssignment | null>(null);
  const [editEnd, setEditEnd] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    // Independent settlement so a failing assignments call never wipes out an
    // otherwise-successful project list, and vice versa — see P1-1.
    const [assgnsResult, projsResult] = await Promise.allSettled([
      getEmployeeAssignments(employeeId),
      getAdminProjects(),
    ]);
    if (assgnsResult.status === "fulfilled") setAssignments(assgnsResult.value);
    if (projsResult.status === "fulfilled") setProjects(projsResult.value);
    if (assgnsResult.status === "rejected" || projsResult.status === "rejected") {
      setLoadError(true);
      toast({ title: "Proje atamaları yüklenemedi.", variant: "destructive" });
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
    setSaving(true);
    try {
      await createEmployeeAssignment({
        employee_id: employeeId,
        project_id: form.project_id,
        start_date: form.start_date,
        notes: form.notes.trim() || null,
      });
      toast({ title: "Proje ataması oluşturuldu." });
      setDialogOpen(false);
      setForm({ project_id: "", start_date: new Date().toISOString().slice(0, 10), notes: "" });
      await load();
    } catch (error: any) {
      toast({ title: "Atama oluşturulamadı.", description: error?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateEnd() {
    if (!editing) return;
    setSaving(true);
    try {
      await updateEmployeeAssignment({ id: editing.id, end_date: editEnd || null });
      toast({ title: "Bitiş tarihi güncellendi." });
      setEditDialogOpen(false);
      setEditing(null);
      await load();
    } catch (error: any) {
      toast({ title: "Güncellenemedi.", description: error?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu proje atamasını silmek istediğinize emin misiniz?")) return;
    try {
      await deleteEmployeeAssignment(id);
      toast({ title: "Atama silindi." });
      await load();
    } catch (error: any) {
      toast({ title: "Atama silinemedi.", description: error?.message, variant: "destructive" });
    }
  }

  if (loading) return <div className="py-4 text-sm text-muted-foreground">Yükleniyor...</div>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Proje Atamaları</h3>
        <Button size="sm" variant="outline" onClick={() => { setForm({ project_id: "", start_date: new Date().toISOString().slice(0, 10), notes: "" }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Atama Ekle
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-md border border-dashed border-destructive/40 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>Proje atamaları yüklenemedi.</span>
          <Button size="sm" variant="outline" onClick={() => load()}>Tekrar Dene</Button>
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Henüz proje ataması yok.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-2">Proje</th>
                <th className="p-2">Başlangıç</th>
                <th className="p-2">Bitiş</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-2 font-medium">{a.project_title ?? a.project_id}</td>
                  <td className="p-2">{a.start_date}</td>
                  <td className="p-2 text-muted-foreground">
                    {a.end_date ? a.end_date : (
                      <button
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                        onClick={() => { setEditing(a); setEditEnd(""); setEditDialogOpen(true); }}
                      >
                        Açık
                      </button>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)}>
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Proje Ataması Ekle</DialogTitle></DialogHeader>
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
            <div>
              <Label>Başlangıç Tarihi *</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Bitiş Tarihi Ayarla</DialogTitle></DialogHeader>
          <div>
            <Label>Bitiş Tarihi (boş bırakılırsa açık kalır)</Label>
            <Input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>Vazgeç</Button>
            <Button onClick={handleUpdateEnd} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
