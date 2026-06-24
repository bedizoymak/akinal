import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { assignEmployeeRole, deleteEmployeeRole, endEmployeeRole, getAdminRoles, getEmployeeRoles } from "@/lib/apiClient";
import type { AkEmployeeRole, AkRole } from "@/lib/apiTypes";
import { cn } from "@/lib/utils";

interface Props {
  employeeId: string;
}

export function EmployeeRolesPanel({ employeeId }: Props) {
  const { toast } = useToast();
  const [roles, setRoles] = useState<AkRole[]>([]);
  const [employeeRoles, setEmployeeRoles] = useState<AkEmployeeRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [assignedAt, setAssignedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endingRole, setEndingRole] = useState<AkEmployeeRole | null>(null);
  const [endedAt, setEndedAt] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allRoles, empRoles] = await Promise.all([
        getAdminRoles(true),
        getEmployeeRoles(employeeId),
      ]);
      setRoles(allRoles);
      setEmployeeRoles(empRoles);
    } catch {
      toast({ title: "Roller yüklenemedi.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [employeeId, toast]);

  useEffect(() => { load(); }, [load]);

  const activeRoles = employeeRoles.filter((r) => !r.ended_at);
  const historicRoles = employeeRoles.filter((r) => r.ended_at);

  async function handleAssign() {
    if (!selectedRoleId) {
      toast({ title: "Lütfen bir rol seçin.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await assignEmployeeRole({ employee_id: employeeId, role_id: selectedRoleId, assigned_at: assignedAt });
      toast({ title: "Rol atandı." });
      setDialogOpen(false);
      setSelectedRoleId("");
      await load();
    } catch (error: any) {
      toast({ title: "Rol atanamadı.", description: error?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleEndRole() {
    if (!endingRole) return;
    setSaving(true);
    try {
      await endEmployeeRole({
        employee_id: endingRole.employee_id,
        role_id: endingRole.role_id,
        assigned_at: endingRole.assigned_at,
        ended_at: endedAt,
      });
      toast({ title: "Rol bitirildi." });
      setEndDialogOpen(false);
      setEndingRole(null);
      await load();
    } catch (error: any) {
      toast({ title: "Rol bitirilemedi.", description: error?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(er: AkEmployeeRole) {
    if (!confirm(`"${er.role_name}" rolünü silmek istediğinize emin misiniz?`)) return;
    try {
      await deleteEmployeeRole({ employee_id: er.employee_id, role_id: er.role_id, assigned_at: er.assigned_at });
      toast({ title: "Rol silindi." });
      await load();
    } catch (error: any) {
      toast({ title: "Rol silinemedi.", description: error?.message, variant: "destructive" });
    }
  }

  function openEndDialog(er: AkEmployeeRole) {
    setEndingRole(er);
    setEndedAt(new Date().toISOString().slice(0, 10));
    setEndDialogOpen(true);
  }

  if (loading) return <div className="py-4 text-sm text-muted-foreground">Yükleniyor...</div>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Roller</h3>
        <Button size="sm" variant="outline" onClick={() => { setSelectedRoleId(""); setAssignedAt(new Date().toISOString().slice(0, 10)); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Rol Ekle
        </Button>
      </div>

      {activeRoles.length === 0 && historicRoles.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Henüz rol atanmamış.
        </div>
      ) : (
        <div className="space-y-1">
          {activeRoles.map((er) => (
            <div key={`${er.role_id}-${er.assigned_at}`} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{er.role_name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{er.assigned_at} tarihinden itibaren</span>
                <span className={cn("ml-2 rounded px-1.5 py-0.5 text-xs", "bg-emerald-50 text-emerald-700 border border-emerald-200")}>Aktif</span>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEndDialog(er)} className="text-xs text-muted-foreground">Bitir</Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(er)}><X className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {historicRoles.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Eski roller ({historicRoles.length})</summary>
              <div className="mt-1 space-y-1">
                {historicRoles.map((er) => (
                  <div key={`${er.role_id}-${er.assigned_at}`} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm opacity-70">
                    <div>
                      <span className="font-medium">{er.role_name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{er.assigned_at} – {er.ended_at}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(er)}><X className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Rol Ekle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rol *</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger><SelectValue placeholder="Rol seçin..." /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Atanma Tarihi *</Label>
              <Input type="date" value={assignedAt} onChange={(e) => setAssignedAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Vazgeç</Button>
            <Button onClick={handleAssign} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Rolü Bitir — {endingRole?.role_name}</DialogTitle></DialogHeader>
          <div>
            <Label>Bitiş Tarihi *</Label>
            <Input type="date" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndDialogOpen(false)} disabled={saving}>Vazgeç</Button>
            <Button onClick={handleEndRole} disabled={saving} variant="destructive">
              {saving ? "Kaydediliyor..." : "Rolü Bitir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
