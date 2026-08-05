import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { useToast } from "@/hooks/use-toast";
import { Copy, CheckCircle2, XCircle, Loader2, Play, Clock, Server, ShieldCheck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionResult {
  id: number;
  timestamp: string;
  endpoint: string;
  method: string;
  httpStatus: number | null;
  ok: boolean;
  data: unknown;
  errorMessage: string | null;
}

interface MaintenanceAction {
  id: string;
  title: string;
  description: string;
  warning: string;
  endpoint: string;
  method: "POST" | "GET";
  confirmMessage: string;
  renderResult?: (data: unknown) => React.ReactNode;
}

// ── Predefined actions ────────────────────────────────────────────────────────

const ACTIONS: MaintenanceAction[] = [
  {
    id: "gpp-collections-apply",
    title: "Hakediş Tahsilat Tablosunu Oluştur",
    description:
      "ak_government_progress_payment_collections tablosunu oluşturur. Mevcut veri etkilenmez.",
    warning:
      "İdempotent: tablo zaten varsa güvenle tekrar çalıştırılabilir.",
    endpoint: "/api/admin/migrations/gpp-collections-apply.php",
    method: "POST",
    confirmMessage:
      "Production veritabanında hakediş tahsilat tablosu oluşturulacak. Devam edilsin mi?",
    renderResult: (data) => {
      const d = data as { table_created?: boolean } | null;
      if (!d) return null;
      return (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm mt-2">
          Tablo Durumu: <span className="font-semibold">{d.table_created ? "Oluşturuldu / Zaten Vardı" : "—"}</span>
        </div>
      );
    },
  },
  {
    id: "gpp-breakdowns-apply",
    title: "Devlet Hakedişi Aşama Kayıtlarını Oluştur",
    description:
      "Mevcut devlet hakedişi kayıtları için Su Basmanı, Kaba İnşaat, İnce İnşaat ve İskan alt aşamalarını oluşturur.",
    warning:
      "Bu işlem idempotent çalışır. Daha önce oluşturulmuş aşamaları tekrar oluşturmaz.",
    endpoint: "/api/admin/migrations/gpp-breakdowns-apply.php",
    method: "POST",
    confirmMessage:
      "Bu işlem production veritabanında eksik hakediş aşamalarını oluşturacak. Devam edilsin mi?",
    renderResult: (data) => {
      const d = data as { table_created?: boolean; parents_seeded?: number; breakdowns_inserted?: number } | null;
      if (!d) return null;
      return (
        <div className="grid grid-cols-3 gap-3 mt-2">
          {[
            { label: "Tablo Oluşturuldu", value: d.table_created ? "Evet" : "Zaten Vardı" },
            { label: "Hakediş İşlendi",   value: String(d.parents_seeded ?? 0) },
            { label: "Aşama Eklendi",     value: String(d.breakdowns_inserted ?? 0) },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</div>
              <div className="mt-0.5 text-base font-bold">{item.value}</div>
            </div>
          ))}
        </div>
      );
    },
  },
];

// ── Utilities ─────────────────────────────────────────────────────────────────

function nowISO(): string {
  return new Date().toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

let resultCounter = 0;

// ── Result panel ──────────────────────────────────────────────────────────────

function ResultPanel({ result }: { result: ActionResult }) {
  const [copied, setCopied] = useState(false);

  function copyJSON() {
    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={cn(
      "rounded-lg border p-4 mt-3 space-y-3",
      result.ok ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"
    )}>
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />{result.timestamp}
        </span>
        <span className="font-mono">{result.method} {result.endpoint}</span>
        {result.httpStatus !== null && (
          <span className={cn(
            "rounded border px-1.5 py-0 font-semibold",
            result.ok ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"
          )}>
            HTTP {result.httpStatus}
          </span>
        )}
        <span className={cn(
          "flex items-center gap-1 font-semibold",
          result.ok ? "text-emerald-700" : "text-red-700"
        )}>
          {result.ok
            ? <><CheckCircle2 className="h-3.5 w-3.5" /> Başarılı</>
            : <><XCircle className="h-3.5 w-3.5" /> Hata</>
          }
        </span>
      </div>

      {/* Error message */}
      {result.errorMessage && (
        <div className="text-sm text-red-700 font-medium">{result.errorMessage}</div>
      )}

      {/* JSON output */}
      <div className="relative">
        <pre className="rounded-md border border-border bg-background/80 p-3 text-[11px] font-mono overflow-x-auto max-h-64 overflow-y-auto leading-relaxed">
          {JSON.stringify(result.data, null, 2)}
        </pre>
        <button
          onClick={copyJSON}
          className="absolute top-2 right-2 flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Kopyalandı" : "Kopyala"}
        </button>
      </div>
    </div>
  );
}

// ── Action card ───────────────────────────────────────────────────────────────

function ActionCard({
  action,
  results,
  onRun,
}: {
  action: MaintenanceAction;
  results: ActionResult[];
  onRun: (action: MaintenanceAction) => void;
}) {
  const latest = results[0] ?? null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-card-soft p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="font-semibold text-sm">{action.title}</div>
          <div className="mt-1 text-[12px] text-muted-foreground leading-relaxed">{action.description}</div>
        </div>
        <Button size="sm" onClick={() => onRun(action)} className="shrink-0 gap-1.5" aria-label={`Çalıştır: ${action.title}`} title={`Çalıştır: ${action.title}`}>
          <Play className="h-3.5 w-3.5" />
          Çalıştır
        </Button>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 leading-relaxed">
        ⚠ {action.warning}
      </div>

      <div className="text-[11px] text-muted-foreground font-mono bg-muted/40 rounded px-2 py-1">
        {action.method} {action.endpoint}
      </div>

      {latest && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Son Sonuç</div>
          <ResultPanel result={latest} />
          {latest.ok && action.renderResult && action.renderResult((latest.data as { data?: unknown })?.data ?? latest.data)}
        </div>
      )}

      {results.length > 1 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Önceki {results.length - 1} sonuç
          </summary>
          <div className="mt-2 space-y-2">
            {results.slice(1).map((r) => <ResultPanel key={r.id} result={r} />)}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminMaintenanceConsole() {
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<MaintenanceAction | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, ActionResult[]>>({});

  function openConfirm(action: MaintenanceAction) {
    setConfirmAction(action);
  }

  async function executeAction(action: MaintenanceAction) {
    setConfirmAction(null);
    setRunning(action.id);

    let httpStatus: number | null = null;
    let ok = false;
    let data: unknown = null;
    let errorMessage: string | null = null;

    try {
      const res = await fetch(action.endpoint, {
        method: action.method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      httpStatus = res.status;

      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      const parsed = data as { success?: boolean; message?: string } | null;
      ok = res.ok && (parsed?.success !== false);

      if (ok) {
        toast({ title: `${action.title} — başarılı.` });
      } else {
        errorMessage = parsed?.message ?? `HTTP ${httpStatus}`;
        toast({ title: "İşlem hatası", description: errorMessage ?? undefined, variant: "destructive" });
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Ağ hatası";
      data = { error: errorMessage };
      toast({ title: "Bağlantı hatası", description: errorMessage, variant: "destructive" });
    } finally {
      setRunning(null);
    }

    const result: ActionResult = {
      id: ++resultCounter,
      timestamp: nowISO(),
      endpoint: action.endpoint,
      method: action.method,
      httpStatus,
      ok,
      data,
      errorMessage,
    };

    setHistory((prev) => {
      const existing = prev[action.id] ?? [];
      return { ...prev, [action.id]: [result, ...existing].slice(0, 5) };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Bakım Konsolu"
        description="Güvenli migration ve bakım işlemleri. Sadece önceden tanımlanmış aksiyonlar çalıştırılabilir."
      />

      {/* Info strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Server,      label: "Ortam",       value: "Production" },
          { icon: ShieldCheck, label: "Yetki",        value: "Admin" },
          { icon: Wrench,      label: "İşlem Tipi",   value: "Kontrollü bakım" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 shadow-card-soft">
            <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
              <div className="text-sm font-semibold">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ACTIONS.map((action) => (
          <ActionCard
            key={action.id}
            action={action}
            results={history[action.id] ?? []}
            onRun={running ? () => {} : openConfirm}
          />
        ))}
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmAction !== null} onOpenChange={(v) => { if (!v) setConfirmAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>İşlemi Onayla</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {confirmAction?.confirmMessage}
          </p>
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-[11px] text-muted-foreground">
            {confirmAction?.method} {confirmAction?.endpoint}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>İptal</Button>
            <Button
              onClick={() => confirmAction && executeAction(confirmAction)}
              disabled={running !== null}
            >
              {running ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Çalışıyor...</> : "Onayla ve Çalıştır"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
