import { useEffect, useRef, useState } from "react";
import { AdminPageHeader, AdminMetricCard, AdminSection, AdminEmptyState } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  getAdminBackupDashboard,
  adminBackupDownloadUrl,
  adminBackupDriveDownloadUrl,
  runAdminBackupNow,
} from "@/lib/apiClient";
import type { BackupDashboardResponse } from "@/lib/apiTypes";
import {
  Archive,
  CloudUpload,
  Database,
  Download,
  History,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

const BACKUP_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1i99EccR4kS9VJM14b4hs3pFfUxl6w4MC?usp=drive_link";

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  // MySQL UTC timestamps arrive without an offset; Drive timestamps already
  // carry Z/offset information. Normalize the former to UTC so both sources
  // follow the same timezone-aware formatting path.
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Customer-facing wording only: neutral, non-technical, no restore guarantees or
// promises about database completeness. Every internal run/package state
// (success, success_with_warnings, complete, partial, ...) collapses to the
// same simple "successful" label here — the underlying distinction is still
// tracked and enforced server-side (retention, audit log), it's just not shown.
const SUCCESSFUL_BACKUP_STATUSES = new Set(["success", "success_with_warnings", "complete", "partial"]);

function StatusBadge({ status }: { status: string }) {
  const successful = SUCCESSFUL_BACKUP_STATUSES.has(status);
  return (
    <Badge
      variant="outline"
      className={successful
        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
        : "border-red-300 bg-red-50 text-red-700"}
    >
      {successful ? "Başarılı" : "Başarısız"}
    </Badge>
  );
}

type RunPhase = "idle" | "preparing" | "uploading" | "verifying" | "success" | "failed";

const RUN_PHASE_LABEL: Record<RunPhase, string> = {
  idle: "Yedekleme Hazır",
  preparing: "Yedek hazırlanıyor…",
  uploading: "Drive'a yükleniyor…",
  verifying: "Doğrulanıyor…",
  success: "Yedek Başarıyla Oluşturuldu",
  failed: "Yedekleme Başarısız",
};

export default function AdminBackupCenter() {
  const { toast } = useToast();
  const [data, setData] = useState<BackupDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<"site" | "database" | null>(null);

  const [runPhase, setRunPhase] = useState<RunPhase>("idle");
  const [lastRunInfo, setLastRunInfo] = useState<{ packageName: string; createdAt: string } | null>(null);
  const phaseTimers = useRef<number[]>([]);

  async function load(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const result = await getAdminBackupDashboard();
      setData(result);
    } catch (err) {
      toast({
        title: "Yedekleme verileri alınamadı",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => {
      phaseTimers.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  function clearPhaseTimers() {
    phaseTimers.current.forEach((id) => window.clearTimeout(id));
    phaseTimers.current = [];
  }

  async function handleBackupNow() {
    if (runPhase !== "idle" && runPhase !== "success" && runPhase !== "failed") return; // already running

    clearPhaseTimers();
    setRunPhase("preparing");
    // The request runs as one synchronous call on the server; these staged
    // labels give the admin visible progress while it's in flight rather than
    // a single unexplained spinner. The server itself performs archive →
    // upload → verification in that same order.
    phaseTimers.current.push(window.setTimeout(() => setRunPhase("uploading"), 3500));
    phaseTimers.current.push(window.setTimeout(() => setRunPhase("verifying"), 9000));

    try {
      const result = await runAdminBackupNow();
      clearPhaseTimers();
      setRunPhase("success");
      setLastRunInfo({ packageName: result.package_name, createdAt: result.created_at });
      toast({ title: "Yedek Başarıyla Oluşturuldu", description: `${result.package_name} · ${formatDate(result.created_at)}` });
      await load(true);
      window.setTimeout(() => setRunPhase("idle"), 8000);
    } catch (err) {
      clearPhaseTimers();
      setRunPhase("failed");
      toast({
        title: "Yedekleme Başarısız",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
      window.setTimeout(() => setRunPhase("idle"), 8000);
    }
  }

  function handleManualDownload(type: "site" | "database") {
    setDownloading(type);
    const link = document.createElement("a");
    link.href = adminBackupDownloadUrl(type);
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: type === "site" ? "Site yedeği indiriliyor..." : "Veritabanı yedeği indiriliyor..." });
    window.setTimeout(() => setDownloading(null), 2000);
    window.setTimeout(() => load(true), 3000);
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Yedekleme bilgileri yükleniyor...</div>;
  }

  if (!data) {
    return (
      <AdminEmptyState
        title="Yedekleme verileri yüklenemedi"
        description="Sayfayı yeniden yüklemeyi deneyin."
        icon={ShieldAlert}
      />
    );
  }

  const {
    drive_diagnostics,
    retention_limit,
    retained_count,
    history,
    audit_log,
    drive_backups,
  } = data;

  const isRunning = runPhase === "preparing" || runPhase === "uploading" || runPhase === "verifying";
  const driveConnected = drive_diagnostics.state === "connected";

  const statusTone = runPhase === "success" ? "success" : runPhase === "failed" ? "danger" : isRunning ? "warning" : "default";
  const statusBorder = runPhase === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : runPhase === "failed" ? "border-red-300 bg-red-50 text-red-800"
    : isRunning ? "border-amber-300 bg-amber-50 text-amber-800"
    : "border-border bg-card text-foreground";

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Yedekleme Merkezi"
        description="Google Drive'a otomatik ve manuel yedekleme."
        actions={
          <Button variant="outline" onClick={() => load(true)} disabled={refreshing} className="gap-2">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Yenile
          </Button>
        }
      />

      {/* Primary call to action */}
      <div className={`rounded-lg border-2 px-6 py-6 ${statusBorder}`}>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold">
              {runPhase === "success" && <ShieldCheck className="h-5 w-5" />}
              {runPhase === "failed" && <ShieldAlert className="h-5 w-5" />}
              {isRunning && <Loader2 className="h-5 w-5 animate-spin" />}
              {RUN_PHASE_LABEL[runPhase]}
            </div>
            <p className="mt-1 text-sm opacity-90">
              {runPhase === "success" && lastRunInfo
                ? `${lastRunInfo.packageName} · ${formatDate(lastRunInfo.createdAt)}`
                : runPhase === "failed"
                  ? "Yedekleme tamamlanamadı. Lütfen tekrar deneyin."
                  : isRunning
                    ? "Bu işlem birkaç dakika sürebilir. Sayfayı kapatmayın."
                    : "Elle bir yedekleme başlatın veya otomatik günlük yedeklemenin çalışmasını bekleyin."}
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleBackupNow}
            disabled={isRunning}
            className="gap-2 whitespace-nowrap"
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
            Şimdi Drive'a Yedekle
          </Button>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AdminMetricCard
          label="Saklanan Yedek Sayısı"
          value={`${retained_count} / ${retention_limit}`}
          description="Google Drive'da saklanan yedek paketleri"
          icon={Archive}
          tone="accent"
          href={BACKUP_DRIVE_FOLDER_URL}
        />
        <AdminMetricCard
          label="Google Drive"
          value={driveConnected ? "Bağlı" : "Bağlı Değil"}
          description={driveConnected ? "Yedekler yapılandırılan klasöre yükleniyor" : "Yapılandırma gerekiyor"}
          icon={CloudUpload}
          tone={driveConnected ? "success" : "warning"}
          href={BACKUP_DRIVE_FOLDER_URL}
        />
        <AdminMetricCard
          label="Son Yedekleme"
          value={drive_backups[0] ? formatDate(drive_backups[0].created_at) : "Henüz yok"}
          description={drive_backups[0]?.name ?? "Henüz yedekleme yapılmadı"}
          icon={ShieldCheck}
          tone={drive_backups[0] ? "success" : "default"}
          href={BACKUP_DRIVE_FOLDER_URL}
        />
      </div>

      {/* Manual downloads */}
      <AdminSection title="Manuel Yedek İndirme" description="Anlık bir yedek oluşturup doğrudan tarayıcınıza indirir.">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => handleManualDownload("site")} disabled={downloading !== null} variant="outline" className="gap-2">
            {downloading === "site" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Site Yedeğini İndir
          </Button>
          <Button onClick={() => handleManualDownload("database")} disabled={downloading !== null} variant="outline" className="gap-2">
            {downloading === "database" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Veritabanı Yedeğini İndir
          </Button>
        </div>
      </AdminSection>

      {/* Drive backups list */}
      <AdminSection title="Google Drive Yedekleri" description="Bu sistem tarafından oluşturulan yedek paketleri.">
        {drive_backups.length === 0 ? (
          <AdminEmptyState
            title="Henüz Drive yedeği yok"
            description="İlk yedekleme tamamlandığında burada listelenecek."
            icon={CloudUpload}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Paket Adı</TableHead>
                <TableHead>Boyut</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İndir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drive_backups.map((folder) => (
                <TableRow key={folder.id}>
                  <TableCell>{formatDate(folder.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{folder.name}</TableCell>
                  <TableCell>{formatBytes(folder.size)}</TableCell>
                  <TableCell><StatusBadge status={folder.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {folder.files.map((file) => (
                        <a
                          key={file.id}
                          href={adminBackupDriveDownloadUrl(file.id, `${folder.name}-${file.name}`)}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-accent hover:text-accent"
                        >
                          <Download className="h-3 w-3" /> {file.name}
                        </a>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminSection>

      {/* History */}
      <AdminSection title="Yedekleme Geçmişi" description="Son 5 yedekleme çalışması.">
        {history.length === 0 ? (
          <AdminEmptyState title="Henüz kayıt yok" icon={History} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Başlangıç</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Boyut</TableHead>
                <TableHead>Paket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((run) => {
                const driveFolder = drive_backups.find((folder) =>
                  (run.drive_folder_id && folder.id === run.drive_folder_id)
                  || (run.package_name && folder.name === run.package_name));
                return (
                  <TableRow key={run.id}>
                    <TableCell>{formatDate(run.started_at)}</TableCell>
                    <TableCell className="text-xs">{run.run_type === "manual_admin" ? "Manuel" : run.run_type === "daily_auto" ? "Otomatik" : run.run_type}</TableCell>
                    <TableCell><StatusBadge status={driveFolder?.status ?? run.status} /></TableCell>
                    <TableCell>{formatBytes(driveFolder?.size ?? run.total_size)}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{run.package_name ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </AdminSection>

      {/* Audit log */}
      <AdminSection title="Denetim Kaydı" description="Bu ekrandan yapılan işlemler.">
        {audit_log.length === 0 ? (
          <AdminEmptyState title="Henüz işlem yok" icon={History} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Yönetici</TableHead>
                <TableHead>İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit_log.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.created_at)}</TableCell>
                  <TableCell className="text-xs">{entry.admin_email ?? "—"}</TableCell>
                  <TableCell className="text-xs">{entry.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminSection>
    </div>
  );
}
