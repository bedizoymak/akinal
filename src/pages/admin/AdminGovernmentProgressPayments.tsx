import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Search, Building2, FolderOpen, CalendarDays, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatTRY } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";
import {
  getGovernmentProgressPayments,
  createGovernmentProgressPayment,
  updateGovernmentProgressPayment,
  deleteGovernmentProgressPayment,
  updateGppBreakdown,
  createGppCollection,
  deleteGppCollection,
  getAdminProjects,
  getAdminCustomersData,
} from "@/lib/apiClient";
import type {
  GovernmentProgressPayment,
  GovernmentPaymentStage,
  GovernmentPaymentStatus,
  GovernmentProgressPaymentPayload,
  GppBreakdown,
  GppCollection,
} from "@/lib/apiTypes";

// ── Date helper ───────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [year, month, day] = String(d).slice(0, 10).split("-");
  if (year && month && day) return `${day}.${month}.${year}`;
  return String(d);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PARENT_STAGES: GovernmentPaymentStage[] = ["Su Basmanı", "Kaba İnşaat", "İnce İnşaat", "İskan", "Belirtilmemiş"];
const BREAKDOWN_STAGES = ["Su Basmanı", "Kaba İnşaat", "İnce İnşaat", "İskan"];

const STAGE_LABELS: Record<string, string> = {
  "Su Basmanı":    "Su Basmanı — %30",
  "Kaba İnşaat":  "Kaba İnşaat — %30",
  "İnce İnşaat":  "İnce İnşaat — %30",
  "İskan":         "İskan — %10",
  "Belirtilmemiş": "Belirtilmemiş",
};

const STATUSES: GovernmentPaymentStatus[] = ["planned", "partial", "paid", "cancelled"];

// Summary KPI totals — must always be computed from whichever row list is
// passed in (the active filtered set), never a separately-scoped "all rows"
// list, or the KPIs silently drift from the visible cards (P2-5).
export function computeGppKpi(rows: GovernmentProgressPayment[]) {
  const all = rows.filter((r) => r.status !== "cancelled");
  const planned = all.reduce((s, r) => s + (Number(r.planned_amount_try) || 0), 0);
  const paid    = all.reduce((s, r) => s + (Number(r.paid_amount_try) || 0), 0);
  const allBds  = all.flatMap((r) => r.breakdowns ?? []);
  const totalStages     = allBds.length || all.length;
  const completedStages = allBds.length > 0 ? allBds.filter((b) => b.status === "paid").length : all.filter((r) => r.status === "paid").length;
  return { planned, paid, pending: Math.max(0, planned - paid), completedStages, totalStages };
}

const STATUS_LABELS: Record<GovernmentPaymentStatus, string> = {
  planned:   "Planlandı",
  partial:   "Kısmi Ödendi",
  paid:      "Ödendi",
  cancelled: "İptal",
};

const STATUS_COLOR: Record<GovernmentPaymentStatus, string> = {
  planned:   "text-blue-700 bg-blue-50 border-blue-200",
  partial:   "text-amber-700 bg-amber-50 border-amber-200",
  paid:      "text-emerald-700 bg-emerald-50 border-emerald-200",
  cancelled: "text-gray-500 bg-gray-50 border-gray-200",
};

// ── Parent form ───────────────────────────────────────────────────────────────

type FormState = {
  customer_id: string;
  project_id: string;
  title: string;
  planned_amount_try: string;
  due_date: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  customer_id: "", project_id: "", title: "",
  planned_amount_try: "1750000", due_date: "", notes: "",
});

function formFromRecord(r: GovernmentProgressPayment): FormState {
  return {
    customer_id: r.customer_id ?? "", project_id: r.project_id ?? "", title: r.title,
    planned_amount_try: String(r.planned_amount_try), due_date: r.due_date ?? "", notes: r.notes ?? "",
  };
}

function formToPayload(form: FormState): GovernmentProgressPaymentPayload {
  return {
    customer_id: form.customer_id || null, project_id: form.project_id || null,
    title: form.title, stage: "Belirtilmemiş",
    planned_amount_try: parseFloat(form.planned_amount_try) || 0,
    paid_amount_try: 0, // server preserves existing paid amount on update
    due_date: form.due_date || null, paid_date: null,
    status: "planned", // server derives this
    notes: form.notes || null,
  };
}

// ── Parent dialog ─────────────────────────────────────────────────────────────

function GppDialog({ open, onClose, onSave, initial, editing, customers, projects }: {
  open: boolean; onClose: () => void;
  onSave: (f: FormState) => Promise<void>; initial: FormState;
  editing: GovernmentProgressPayment | null;
  customers: { id: string; display: string }[];
  projects: { id: string; title: string }[];
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [titleEdited, setTitleEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setForm(initial); setTitleEdited(!!editing); } }, [open, initial, editing]);

  const hasBreakdowns = editing != null && (editing.breakdowns ?? []).length > 0;

  function set(k: keyof FormState, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function handleCustomerChange(customerId: string) {
    set("customer_id", customerId === "__none" ? "" : customerId);
    if (!titleEdited && customerId !== "__none") {
      const c = customers.find((x) => x.id === customerId);
      if (c) set("title", `Hakediş / ${c.display}`);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Hakediş Düzenle" : "Hakediş Ekle"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Müşteri</Label>
              <Select value={form.customer_id || "__none"} onValueChange={handleCustomerChange}>
                <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.display}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Proje</Label>
              <Select value={form.project_id || "__none"} onValueChange={(v) => set("project_id", v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Proje (opsiyonel)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Başlık *</Label>
            <Input
              value={form.title}
              onChange={(e) => { set("title", e.target.value); setTitleEdited(true); }}
              required
              placeholder="Hakediş / Müşteri Adı"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tutar (TL) *</Label>
              <Input
                type="number" min="0" step="0.01"
                value={form.planned_amount_try}
                onChange={(e) => set("planned_amount_try", e.target.value)}
                required
                disabled={hasBreakdowns}
              />
              {hasBreakdowns && (
                <p className="text-[11px] text-muted-foreground">Alt aşamalar oluşturulduktan sonra ana tutar değiştirilemez.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Vade Tarihi</Label>
              <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notlar</Label>
            <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>İptal</Button>
            <Button type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Breakdown edit dialog ─────────────────────────────────────────────────────

type BdForm = { planned_amount_try: string; paid_amount_try: string; due_date: string; paid_date: string; status: GovernmentPaymentStatus; notes: string };
function bdFromRecord(b: GppBreakdown): BdForm {
  return { planned_amount_try: String(b.planned_amount_try), paid_amount_try: String(b.paid_amount_try), due_date: b.due_date ?? "", paid_date: b.paid_date ?? "", status: b.status, notes: b.notes ?? "" };
}

function BreakdownDialog({ open, onClose, onSave, breakdown }: {
  open: boolean; onClose: () => void;
  onSave: (b: GppBreakdown, f: BdForm) => Promise<void>; breakdown: GppBreakdown | null;
}) {
  const [form, setForm] = useState<BdForm>({ planned_amount_try: "", paid_amount_try: "0", due_date: "", paid_date: "", status: "planned", notes: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open && breakdown) setForm(bdFromRecord(breakdown)); }, [open, breakdown]);
  const set = (k: keyof BdForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!breakdown) return;
    if (parseFloat(form.paid_amount_try) > parseFloat(form.planned_amount_try)) { alert("Ödenen tutar planlanan tutarı aşamaz."); return; }
    setSaving(true);
    try { await onSave(breakdown, form); onClose(); } finally { setSaving(false); }
  }

  if (!breakdown) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Aşama Düzenle — {breakdown.stage}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Aşama:</span> <span className="font-medium">{breakdown.stage}</span>
            <span className="ml-3 text-muted-foreground">Oran:</span> <span className="font-medium">%{breakdown.stage_percentage}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Planlanan Tutar (TL)</Label><Input type="number" min="0" step="0.01" value={form.planned_amount_try} onChange={(e) => set("planned_amount_try", e.target.value)} /></div>
            <div className="space-y-1"><Label>Ödenen Tutar (TL)</Label><Input type="number" min="0" step="0.01" value={form.paid_amount_try} onChange={(e) => set("paid_amount_try", e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label>Durum</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as GovernmentPaymentStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Vade Tarihi</Label><Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} /></div>
            <div className="space-y-1"><Label>Ödeme Tarihi</Label><Input type="date" value={form.paid_date} onChange={(e) => set("paid_date", e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Notlar</Label><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>İptal</Button>
            <Button type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Collection dialog ─────────────────────────────────────────────────────────

type ColForm = { breakdown_id: string; title: string; collection_date: string; notes: string };
const emptyColForm = (): ColForm => ({
  breakdown_id: "",
  title: "",
  collection_date: new Date().toISOString().slice(0, 10),
  notes: "",
});

function CollectionDialog({ open, onClose, onSave, gpp }: {
  open: boolean; onClose: () => void;
  onSave: (gppId: string, f: ColForm) => Promise<void>;
  gpp: GovernmentProgressPayment | null;
}) {
  const [form, setForm] = useState<ColForm>(emptyColForm());
  const [titleEdited, setTitleEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm(emptyColForm()); setTitleEdited(false); }
  }, [open]);

  if (!gpp) return null;
  const breakdowns = gpp.breakdowns ?? [];
  const selectedBd = breakdowns.find((b) => b.id === form.breakdown_id) ?? null;
  const remaining  = selectedBd
    ? Math.max(0, Number(selectedBd.planned_amount_try) - Number(selectedBd.paid_amount_try))
    : null;
  const alreadyFull = remaining !== null && remaining <= 0;
  const canSave = form.breakdown_id !== "" && !alreadyFull && !saving;

  const set = (k: keyof ColForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function handleBreakdownChange(val: string) {
    const bd = breakdowns.find((b) => b.id === val) ?? null;
    set("breakdown_id", val);
    if (!titleEdited) set("title", bd ? `Hakediş Tahsilatı / ${bd.stage}` : "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try { await onSave(gpp.id, form); onClose(); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Hakediş Tahsilatı Ekle</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {gpp.title}
          </div>

          {/* Required breakdown selection */}
          <div className="space-y-1">
            <Label>Aşama <span className="text-destructive">*</span></Label>
            {breakdowns.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                Aşama kayıtları henüz oluşturulmamış. Önce Bakım Konsolu&apos;ndan migration çalıştırın.
              </div>
            ) : (
              <Select
                value={form.breakdown_id || "__none"}
                onValueChange={(v) => v !== "__none" && handleBreakdownChange(v)}
              >
                <SelectTrigger><SelectValue placeholder="Aşama seçin" /></SelectTrigger>
                <SelectContent>
                  {breakdowns.map((b, idx) => {
                    const rem = Math.max(0, Number(b.planned_amount_try) - Number(b.paid_amount_try));
                    const alreadyPaid = rem <= 0;
                    const prevUnpaid = breakdowns
                      .slice(0, idx)
                      .some((prev) => Number(prev.paid_amount_try) < Number(prev.planned_amount_try));
                    const disabled = alreadyPaid || prevUnpaid;
                    const suffix = alreadyPaid
                      ? " (tahsil edildi)"
                      : prevUnpaid
                        ? " — Önceki aşama tamamlanmalı"
                        : "";
                    return (
                      <SelectItem key={b.id} value={b.id} disabled={disabled}>
                        {b.stage} — {formatTRY(b.planned_amount_try)}{suffix}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Read-only amount display */}
          {selectedBd && (
            <div className={cn(
              "rounded-md border px-3 py-2.5",
              alreadyFull ? "border-destructive/40 bg-destructive/5" : "border-emerald-200 bg-emerald-50"
            )}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Tahsil edilecek tutar</div>
              {alreadyFull ? (
                <div className="text-sm font-semibold text-destructive">Bu aşama zaten tamamen tahsil edilmiş.</div>
              ) : (
                <div className="text-base font-bold text-emerald-700 tabular-nums">
                  {selectedBd.stage} — {formatTRY(remaining!)}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label>Başlık *</Label>
            <Input
              value={form.title}
              onChange={(e) => { set("title", e.target.value); setTitleEdited(true); }}
              required
              placeholder="Hakediş Tahsilatı / Aşama"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tarih *</Label>
              <Input type="date" value={form.collection_date} onChange={(e) => set("collection_date", e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Notlar</Label>
              <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Opsiyonel" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>İptal</Button>
            <Button type="submit" disabled={!canSave}>
              {saving ? "Kaydediliyor..." : "Tahsilatı Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Breakdown mini card ───────────────────────────────────────────────────────

function BreakdownMiniCard({ b, onEdit }: { b: GppBreakdown; onEdit: (b: GppBreakdown) => void }) {
  const planned = b.planned_amount_try, paid = b.paid_amount_try;
  const remaining = Math.max(0, planned - paid);
  const pct = planned > 0 ? Math.min(100, (paid / planned) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-1">
        <div>
          <div className="text-xs font-semibold text-foreground">{b.stage}</div>
          <div className="text-[10px] text-muted-foreground">%{b.stage_percentage}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={cn("inline-block rounded border px-1.5 py-0 text-[10px] font-semibold", STATUS_COLOR[b.status])}>{STATUS_LABELS[b.status] ?? b.status}</span>
          <button type="button" onClick={() => onEdit(b)} className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Düzenle"><Edit className="h-3 w-3" /></button>
        </div>
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Planlanan</span><span className="font-medium tabular-nums">{formatTRY(planned)}</span></div>
        <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Ödenen</span><span className="font-medium tabular-nums text-emerald-700">{formatTRY(paid)}</span></div>
        {remaining > 0 && <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Kalan</span><span className="font-medium tabular-nums text-amber-600">{formatTRY(remaining)}</span></div>}
      </div>
      {pct > 0 && <div className="h-1 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>}
      {b.due_date && <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarDays className="h-2.5 w-2.5" />{fmtDate(b.due_date)}</div>}
    </div>
  );
}

// ── Hakediş card ──────────────────────────────────────────────────────────────

function GppCard({ r, onEdit, onDelete, onEditBreakdown, onAddCollection, onDeleteCollection }: {
  r: GovernmentProgressPayment;
  onEdit: (r: GovernmentProgressPayment) => void;
  onDelete: (r: GovernmentProgressPayment) => void;
  onEditBreakdown: (b: GppBreakdown) => void;
  onAddCollection: (r: GovernmentProgressPayment) => void;
  onDeleteCollection: (c: GppCollection) => void;
}) {
  const planned   = Number(r.planned_amount_try) || 0;
  const paid      = Number(r.paid_amount_try) || 0;
  const remaining = Math.max(0, planned - paid);
  const pct       = planned > 0 ? Math.min(100, (paid / planned) * 100) : 0;
  const collections = r.collections ?? [];

  // Pre-compute which collections are safe to delete (no later breakdown with paid > 0).
  const bdBySortOrder = (r.breakdowns ?? []).reduce<Record<string, number>>((acc, b) => {
    acc[b.id] = b.sort_order;
    return acc;
  }, {});
  function canDeleteCollection(c: GppCollection): boolean {
    if (!c.breakdown_id) return true; // general collection, always deletable
    const sortOrder = bdBySortOrder[c.breakdown_id];
    if (sortOrder === undefined) return true;
    return !(r.breakdowns ?? []).some(
      (b) => b.sort_order > sortOrder && Number(b.paid_amount_try) > 0
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card-soft flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate" title={r.title}>{r.title}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {r.customer_name && <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{r.customer_name}</span></div>}
            {r.project_title && <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><FolderOpen className="h-3 w-3 shrink-0" /><span className="truncate max-w-[180px]" title={r.project_title}>{r.project_title}</span></div>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn("inline-block rounded border px-2 py-0.5 text-[11px] font-semibold", STATUS_COLOR[r.status])}>{STATUS_LABELS[r.status] ?? r.status}</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Düzenle" onClick={() => onEdit(r)}><Edit className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Sil" onClick={() => onDelete(r)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </div>
      </div>

      {/* Hesap Özeti */}
      <div className="px-4 pb-3 border-b border-border/60">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Hesap Özeti</div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {[
            { label: "Planlanan",      value: formatTRY(planned),           color: "" },
            { label: "Tahsil Edilen",  value: formatTRY(paid),              color: "text-emerald-700" },
            { label: "Kalan",          value: formatTRY(remaining),          color: remaining > 0 ? "text-amber-600" : "text-emerald-700" },
            { label: "Tahsilat Sayısı", value: String(collections.length),  color: "" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground leading-tight">{label}</div>
              <div className={cn("text-xs font-bold tabular-nums mt-0.5", color)}>{value}</div>
            </div>
          ))}
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">%{pct.toFixed(0)} tamamlandı</span>
          {r.due_date && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarDays className="h-3 w-3" />{fmtDate(r.due_date)}</span>}
        </div>
      </div>

      {/* Breakdown grid */}
      <div className="px-4 py-3 border-b border-border/60">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Aşama Kırılımı</div>
        {r.breakdowns && r.breakdowns.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {r.breakdowns.map((b) => <BreakdownMiniCard key={b.id} b={b} onEdit={onEditBreakdown} />)}
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground italic py-1">Aşama kayıtları henüz oluşturulmamış.</div>
        )}
      </div>

      {/* Collections */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tahsilat Hareketleri {collections.length > 0 && `(${collections.length})`}
          </div>
          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 gap-1" onClick={() => onAddCollection(r)}>
            <PlusCircle className="h-3 w-3" /> Hakediş Tahsilatı Ekle
          </Button>
        </div>

        {collections.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic py-2">Henüz tahsilat hareketi yok.</div>
        ) : (
          <div className="space-y-1">
            {collections.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[11px]">
                <span className="text-muted-foreground tabular-nums whitespace-nowrap">{fmtDate(c.collection_date)}</span>
                <span className="flex-1 truncate font-medium" title={c.title}>{c.title}</span>
                {c.breakdown_stage && (
                  <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0 text-[10px] text-blue-700 font-semibold whitespace-nowrap">{c.breakdown_stage}</span>
                )}
                <span className="font-semibold tabular-nums text-emerald-700 whitespace-nowrap">{formatTRY(c.amount_try)}</span>
                {canDeleteCollection(c) ? (
                  <button
                    type="button"
                    onClick={() => onDeleteCollection(c)}
                    className="ml-1 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    title="Sil"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : (
                  <span
                    className="ml-1 shrink-0 text-muted-foreground/30 cursor-not-allowed"
                    title="Sonraki aşamalar tahsil edildiği için silinemez."
                  >
                    <Trash2 className="h-3 w-3" />
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminGovernmentProgressPayments() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GovernmentProgressPayment | null>(null);

  const [bdDialogOpen, setBdDialogOpen] = useState(false);
  const [editingBd, setEditingBd] = useState<GppBreakdown | null>(null);

  const [colDialogOpen, setColDialogOpen] = useState(false);
  const [colTarget, setColTarget] = useState<GovernmentProgressPayment | null>(null);

  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ["government-progress-payments"],
    queryFn: () => getGovernmentProgressPayments(),
    retry: false,
  });

  const { data: projectsRaw = [] } = useQuery({ queryKey: ["admin-projects"], queryFn: getAdminProjects });
  const { data: customersData } = useQuery({ queryKey: ["admin-customers"], queryFn: getAdminCustomersData, retry: false });

  const customers = useMemo(
    () => (customersData?.customers ?? []).map((c) => ({ id: c.id, display: c.company_name || c.full_name || c.id })),
    [customersData]
  );
  const projects = useMemo(
    () => (projectsRaw as any[]).map((p: any) => ({ id: p.id as string, title: p.title as string })),
    [projectsRaw]
  );

  const filtered = useMemo(() => {
    const lq = q.toLowerCase();
    return (payments as GovernmentProgressPayment[]).filter((r) => {
      if (q && !r.title.toLowerCase().includes(lq) && !(r.customer_name ?? "").toLowerCase().includes(lq) && !(r.project_title ?? "").toLowerCase().includes(lq)) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (projectFilter !== "all" && r.project_id !== projectFilter) return false;
      if (stageFilter !== "all") {
        const hasBd = (r.breakdowns ?? []).some((b) => b.stage === stageFilter);
        if (!hasBd && r.stage !== stageFilter) return false;
      }
      return true;
    });
  }, [payments, q, stageFilter, statusFilter, projectFilter]);

  // Summary KPIs must reflect the same active search/project/stage/status
  // filters as the visible card list — previously this used the full
  // unfiltered `payments` list, so filtering down to one project still
  // showed the global totals (P2-5).
  const kpi = useMemo(() => computeGppKpi(filtered), [filtered]);

  const initial = useMemo(() => editing ? formFromRecord(editing) : emptyForm(), [editing]);

  function errMsg(err: unknown): string {
    return err instanceof Error ? err.message : "Beklenmedik bir hata oluştu.";
  }

  async function handleSave(form: FormState) {
    const payload = formToPayload(form);
    try {
      if (editing) { await updateGovernmentProgressPayment({ id: editing.id, ...payload }); toast({ title: "Hakediş güncellendi." }); }
      else { await createGovernmentProgressPayment(payload); toast({ title: "Hakediş eklendi." }); }
      await qc.invalidateQueries({ queryKey: ["government-progress-payments"] });
    } catch (err) {
      toast({ title: "Kayıt hatası", description: errMsg(err), variant: "destructive" });
      throw err;
    }
  }

  async function handleDelete(r: GovernmentProgressPayment) {
    if (!confirm(`"${r.title}" hakediş kaydını silmek istiyor musunuz?`)) return;
    try {
      await deleteGovernmentProgressPayment(r.id);
      toast({ title: "Hakediş silindi." });
      await qc.invalidateQueries({ queryKey: ["government-progress-payments"] });
    } catch (err) {
      toast({ title: "Silme hatası", description: errMsg(err), variant: "destructive" });
    }
  }

  async function handleSaveBreakdown(b: GppBreakdown, form: BdForm) {
    try {
      await updateGppBreakdown({
        breakdown_id: b.id,
        planned_amount_try: parseFloat(form.planned_amount_try) || 0,
        paid_amount_try: parseFloat(form.paid_amount_try) || 0,
        due_date: form.due_date || null, paid_date: form.paid_date || null,
        status: form.status, notes: form.notes || null,
      });
      toast({ title: "Aşama güncellendi." });
      await qc.invalidateQueries({ queryKey: ["government-progress-payments"] });
      await qc.invalidateQueries({ queryKey: ["gelenler"] });
    } catch (err) {
      toast({ title: "Aşama güncelleme hatası", description: errMsg(err), variant: "destructive" });
      throw err;
    }
  }

  async function handleSaveCollection(gppId: string, form: ColForm) {
    try {
      await createGppCollection({
        government_progress_payment_id: gppId,
        breakdown_id: form.breakdown_id || null,
        title: form.title,
        collection_date: form.collection_date,
        amount_try: 0, // server ignores this and computes remaining amount
        notes: form.notes || null,
      });
      toast({ title: "Tahsilat eklendi." });
      await qc.invalidateQueries({ queryKey: ["government-progress-payments"] });
      await qc.invalidateQueries({ queryKey: ["gelenler"] });
    } catch (err) {
      toast({ title: "Tahsilat hatası", description: errMsg(err), variant: "destructive" });
      throw err;
    }
  }

  async function handleDeleteCollection(c: GppCollection) {
    if (!confirm(`"${c.title}" tahsilat kaydını silmek istiyor musunuz?`)) return;
    try {
      await deleteGppCollection(c.id);
      toast({ title: "Tahsilat silindi." });
      await qc.invalidateQueries({ queryKey: ["government-progress-payments"] });
      await qc.invalidateQueries({ queryKey: ["gelenler"] });
    } catch (err) {
      toast({ title: "Silme hatası", description: errMsg(err), variant: "destructive" });
    }
  }

  const tableNotReady = error != null;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Devlet Hakedişleri"
        description="Kentsel dönüşüm teşvik ve hakediş ödemelerini aşama kırılımı ve tahsilat hareketleriyle takip edin."
        actions={
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Hakediş Ekle
          </Button>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminMetricCard label="Toplam Hakediş"    value={formatTRY(kpi.planned)} />
        <AdminMetricCard label="Tahsil Edilen"      value={formatTRY(kpi.paid)}    tone="success" />
        <AdminMetricCard label="Bekleyen Hakediş"   value={formatTRY(kpi.pending)} tone={kpi.pending > 0 ? "warning" : "success"} />
        <AdminMetricCard label="Tamamlanan Aşama"   value={`${kpi.completedStages} / ${kpi.totalStages}`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input className="pl-8" placeholder="Ara: başlık, müşteri, proje..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Proje" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Projeler</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Aşama" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Aşamalar</SelectItem>
            {PARENT_STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Durum" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Yükleniyor...</div>
      ) : tableNotReady ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
          Hakediş tablosu henüz oluşturulmamış.
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {(payments as GovernmentProgressPayment[]).length === 0 ? "Henüz devlet hakedişi kaydı yok." : "Filtreye uyan kayıt bulunamadı."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <GppCard
              key={r.id}
              r={r}
              onEdit={(rec) => { setEditing(rec); setDialogOpen(true); }}
              onDelete={handleDelete}
              onEditBreakdown={(b) => { setEditingBd(b); setBdDialogOpen(true); }}
              onAddCollection={(rec) => { setColTarget(rec); setColDialogOpen(true); }}
              onDeleteCollection={handleDeleteCollection}
            />
          ))}
        </div>
      )}

      <GppDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(null); }} onSave={handleSave} initial={initial} editing={editing} customers={customers} projects={projects} />
      <BreakdownDialog open={bdDialogOpen} onClose={() => { setBdDialogOpen(false); setEditingBd(null); }} onSave={handleSaveBreakdown} breakdown={editingBd} />
      <CollectionDialog open={colDialogOpen} onClose={() => { setColDialogOpen(false); setColTarget(null); }} onSave={handleSaveCollection} gpp={colTarget} />
    </div>
  );
}
