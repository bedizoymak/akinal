import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Plus, Trash2, TrendingUp, X } from "lucide-react";
import { EntryStatusBadge } from "./EntryStatusBadge";
import { CurrencyAmount } from "./CurrencyAmount";
import { CardEntryForm, type CardEntryFormValues } from "./CardEntryForm";
import type { CardFinancialEntry, CardEntryAccountType } from "@/lib/apiTypes";

interface Project {
  id: string;
  title: string;
}

interface Props {
  entries: CardFinancialEntry[];
  projects: Project[];
  direction?: "income" | "expense";
  onAdd: (values: CardEntryFormValues) => Promise<void>;
  onEdit: (id: string, values: CardEntryFormValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onInflationSave?: (id: string, enabled: boolean, startDate: string | null) => Promise<void>;
  loading?: boolean;
  title?: string;
  showInflation?: boolean;
  // Account classification to preselect when adding a NEW entry from this
  // table (e.g. the Resmi/Gayri Resmi tab it's rendered under). See P1-3.
  defaultAccountType?: CardEntryAccountType;
}

function fmtDate(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("tr-TR"); } catch { return d; }
}

function fmtTRY(v: number | string) {
  return "₺" + Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number) {
  return "%" + v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function CardStatementTable({
  entries, projects, direction, onAdd, onEdit, onDelete, onInflationSave,
  loading, title, showInflation, defaultAccountType,
}: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<CardFinancialEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Inflation panel per-row state
  const [inflationOpenId, setInflationOpenId] = useState<string | null>(null);
  const [inflationEnabled, setInflationEnabled] = useState(false);
  const [inflationStartDate, setInflationStartDate] = useState("");
  const [inflationSaving, setInflationSaving] = useState(false);

  const totalPlanned = entries.reduce((s, e) => s + Number(e.amount_try), 0);
  const totalPaid = entries.reduce((s, e) => s + Number(e.paid_amount_try), 0);

  async function handleDelete(id: string) {
    if (!confirm("Bu kayıt silinsin mi?")) return;
    setDeletingId(id);
    try { await onDelete(id); } finally { setDeletingId(null); }
  }

  function openInflationPanel(e: CardFinancialEntry) {
    if (inflationOpenId === e.id) {
      setInflationOpenId(null);
      return;
    }
    setInflationEnabled(Boolean(e.inflation_enabled));
    setInflationStartDate(e.inflation_start_date ?? "");
    setInflationOpenId(e.id);
  }

  async function handleInflationSave(entryId: string) {
    if (!onInflationSave) return;
    setInflationSaving(true);
    try {
      await onInflationSave(entryId, inflationEnabled, inflationStartDate || null);
      setInflationOpenId(null);
    } finally {
      setInflationSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold">{title ?? "Mali Hareketler"}</span>
          {entries.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              Planlanan: {fmtTRY(totalPlanned)} · Ödenen: {fmtTRY(totalPaid)}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => { setEditEntry(null); setFormOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Ekle
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {loading ? "Yükleniyor..." : "Henüz kayıt yok."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tarih</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Başlık</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Planlanan</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ödenen</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Durum</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Proje</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => {
                const preview = showInflation ? e.inflation_preview : null;
                const inflationActive = Boolean(e.inflation_enabled);
                const panelOpen = inflationOpenId === e.id;

                return (
                  <>
                    <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 tabular-nums">{fmtDate(e.entry_date)}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{e.title}</div>
                        {e.notes && <div className="text-[11px] text-muted-foreground">{e.notes}</div>}
                        {inflationActive && preview?.enabled && !preview.warning && (
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-accent">
                            <TrendingUp className="h-3 w-3" />
                            <span>TÜFE: {fmtPct(preview.rate_percent ?? 0)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <CurrencyAmount amount={e.amount} currency={e.currency} amountTry={e.amount_try} showTry={e.currency !== "TRY"} />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <CurrencyAmount amount={e.paid_amount} currency={e.currency} amountTry={e.paid_amount_try} showTry={e.currency !== "TRY"} />
                      </td>
                      <td className="px-3 py-2">
                        <EntryStatusBadge status={e.status} isOverdue={e.is_overdue} />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {e.project_title ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          {showInflation && onInflationSave && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className={`h-7 w-7 ${inflationActive ? "text-accent" : "text-muted-foreground"} ${panelOpen ? "bg-accent/10" : ""}`}
                              title="Vade Farkı / TÜFE"
                              onClick={() => openInflationPanel(e)}
                            >
                              <TrendingUp className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => { setEditEntry(e); setFormOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            disabled={deletingId === e.id}
                            onClick={() => handleDelete(e.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Vade Farkı inline panel — opens when TrendingUp button is clicked */}
                    {showInflation && panelOpen && (
                      <tr key={`${e.id}-inflation-panel`} className="bg-muted/20">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 text-sm font-semibold">
                                <TrendingUp className="h-4 w-4 text-accent" />
                                Vade Farkı / TÜFE Güncellemesi
                              </span>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setInflationOpenId(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {/* Controls */}
                            <div className="flex flex-wrap items-end gap-4">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`inf-enabled-${e.id}`}
                                  checked={inflationEnabled}
                                  onCheckedChange={(v) => setInflationEnabled(Boolean(v))}
                                />
                                <Label htmlFor={`inf-enabled-${e.id}`} className="cursor-pointer text-sm">
                                  Vade farkı hesaplamasını etkinleştir
                                </Label>
                              </div>

                              {inflationEnabled && (
                                <div className="flex items-end gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">
                                      Baz Tarih <span className="font-normal">(boş = kayıt tarihi: {fmtDate(e.entry_date)})</span>
                                    </Label>
                                    <Input
                                      type="date"
                                      className="h-8 w-44 text-sm"
                                      value={inflationStartDate}
                                      onChange={(ev) => setInflationStartDate(ev.target.value)}
                                    />
                                  </div>
                                </div>
                              )}

                              <Button
                                size="sm"
                                className="bg-accent text-accent-foreground hover:bg-accent-glow"
                                disabled={inflationSaving}
                                onClick={() => handleInflationSave(e.id)}
                              >
                                {inflationSaving ? "Kaydediliyor..." : "Kaydet"}
                              </Button>
                            </div>

                            {/* Preview result — shown from the already-loaded preview on this entry */}
                            {inflationEnabled && preview?.enabled && (
                              <div className="space-y-2">
                                {preview.warning ? (
                                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{preview.warning}</p>
                                ) : (
                                  <>
                                    {/* Forecast warning banner */}
                                    {preview.used_forecast && (
                                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800 space-y-1">
                                        <p className="font-semibold">Tahmini Veri İçeriyor</p>
                                        <p>Bu hesapta ileri tarihli dönemler için tahmini TÜFE kullanılmıştır. Bu değerler yalnızca bilgi amaçlıdır. Resmi TCMB verileri açıklandığında tutarlar otomatik olarak güncellenecektir.</p>
                                        {preview.forecast_method && (
                                          <p>Tahmin Metodu: <span className="font-medium">{preview.forecast_method}</span></p>
                                        )}
                                      </div>
                                    )}

                                    {/* Result grid */}
                                    <div className="rounded-md border border-accent/30 bg-accent/5 p-3">
                                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                                        <div>
                                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ana Para</div>
                                          <div className="tabular-nums font-medium">{fmtTRY(preview.principal_amount ?? 0)}</div>
                                        </div>
                                        <div>
                                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hesaplanan Dönem</div>
                                          <div className="tabular-nums font-medium">
                                            {preview.base_period} → {preview.target_period}
                                            <span className="ml-1 text-muted-foreground">({preview.months_used?.length ?? 0} ay)</span>
                                          </div>
                                        </div>
                                        {preview.used_forecast ? (
                                          <>
                                            <div>
                                              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Resmi Oran <span className="text-emerald-600">({preview.official_months_count} ay)</span>
                                              </div>
                                              <div className="tabular-nums font-medium text-emerald-700">{fmtPct(preview.official_compound_rate_percent ?? 0)}</div>
                                            </div>
                                            <div>
                                              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Tahmini Oran <span className="text-amber-600">({preview.forecast_months_count} ay)</span>
                                              </div>
                                              <div className="tabular-nums font-medium text-amber-700">{fmtPct(preview.forecast_compound_rate_percent ?? 0)}</div>
                                            </div>
                                          </>
                                        ) : (
                                          <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">TÜFE Bileşik Oran</div>
                                            <div className="tabular-nums font-medium text-accent">{fmtPct(preview.total_compound_rate_percent ?? preview.rate_percent ?? 0)}</div>
                                          </div>
                                        )}
                                        <div>
                                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Enflasyon Farkı</div>
                                          <div className="tabular-nums font-medium">{fmtTRY(preview.inflation_difference ?? 0)}</div>
                                        </div>
                                        <div className="col-span-2 sm:col-span-4 border-t border-accent/20 pt-2">
                                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            Güncel Tahsil Edilebilir Tutar
                                            {preview.used_forecast && <span className="ml-1 text-amber-600">(Tahmini içerir)</span>}
                                          </div>
                                          <div className={`tabular-nums text-lg font-bold ${preview.used_forecast ? "text-amber-700" : "text-accent"}`}>
                                            {fmtTRY(preview.current_collectible_amount ?? preview.adjusted_amount ?? 0)}
                                          </div>
                                          {preview.used_forecast && (
                                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                                              Toplam Oran: {fmtPct(preview.total_compound_rate_percent ?? 0)}
                                              {" · "}Resmi: {preview.official_months_count} ay · Tahmini: {preview.forecast_months_count} ay
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            {inflationEnabled && !preview?.enabled && (
                              <p className="text-xs text-muted-foreground">
                                Kaydettikten sonra TÜFE önizlemesi burada görünecek.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CardEntryForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditEntry(null); }}
        onSave={async (values) => {
          if (editEntry) {
            await onEdit(editEntry.id, values);
          } else {
            await onAdd(values);
          }
        }}
        initial={editEntry ?? undefined}
        defaultAccountType={defaultAccountType}
        projects={projects}
        direction={direction}
        showInflation={showInflation}
      />
    </div>
  );
}
