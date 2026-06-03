import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Database, Loader2, Play, RotateCcw } from "lucide-react";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { executeAdminSql } from "@/lib/apiClient";
import type { AdminSqlEditorResult } from "@/lib/apiTypes";

type QueryHistoryItem = {
  sql: string;
  statementType: string;
  executedAt: string;
};

const HISTORY_KEY = "akinal-admin-sql-history";
const DESTRUCTIVE_TYPES = ["DROP", "TRUNCATE", "ALTER"];
const SELECT_TYPES = ["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN"];

function statementType(sql: string): string {
  const match = sql.trim().match(/^([a-zA-Z]+)/);
  return match?.[1]?.toUpperCase() || "";
}

function hasMultipleStatements(sql: string): boolean {
  const trimmed = sql.trim().replace(/;\s*$/, "");
  let quote: string | null = null;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const next = trimmed[i + 1];

    if (quote) {
      if (char === "\\") {
        i++;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }

    if (char === "-" && next === "-") {
      while (i < trimmed.length && trimmed[i] !== "\n") i++;
      continue;
    }

    if (char === "#") {
      while (i < trimmed.length && trimmed[i] !== "\n") i++;
      continue;
    }

    if (char === "/" && next === "*") {
      i += 2;
      while (i + 1 < trimmed.length && !(trimmed[i] === "*" && trimmed[i + 1] === "/")) i++;
      i++;
      continue;
    }

    if (char === ";") return true;
  }

  return false;
}

function loadHistory(): QueryHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: QueryHistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
}

export default function AdminSqlEditor() {
  const { toast } = useToast();
  const [sql, setSql] = useState("SELECT * FROM ak_projects LIMIT 20");
  const [confirmed, setConfirmed] = useState(false);
  const [destructiveConfirmation, setDestructiveConfirmation] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AdminSqlEditorResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const currentType = statementType(sql);
  const isSelect = SELECT_TYPES.includes(currentType);
  const isDestructive = DESTRUCTIVE_TYPES.includes(currentType);
  const multipleStatements = useMemo(() => hasMultipleStatements(sql), [sql]);
  const canExecute = sql.trim() && !multipleStatements && (isSelect || confirmed) && (!isDestructive || destructiveConfirmation.trim() === "UYGULA");

  async function runSql() {
    if (!sql.trim()) {
      toast({ title: "SQL sorgusu boş olamaz", variant: "destructive" });
      return;
    }
    if (multipleStatements) {
      toast({ title: "Tek istekte yalnızca bir SQL ifadesi çalıştırılabilir", variant: "destructive" });
      return;
    }
    if (!isSelect && !confirmed) {
      toast({ title: "SELECT dışındaki sorgular için onay gerekli", variant: "destructive" });
      return;
    }
    if (isDestructive && destructiveConfirmation.trim() !== "UYGULA") {
      toast({ title: "Yıkıcı sorgular için UYGULA onayı gerekli", variant: "destructive" });
      return;
    }

    setRunning(true);
    setError("");
    setResult(null);

    try {
      const response = await executeAdminSql({ sql, confirmed, destructive_confirmation: destructiveConfirmation });
      setResult(response);
      const nextHistory = [
        { sql, statementType: response.statement_type, executedAt: response.executed_at },
        ...history.filter((item) => item.sql !== sql),
      ].slice(0, 20);
      setHistory(nextHistory);
      saveHistory(nextHistory);
      toast({ title: "SQL sorgusu çalıştırıldı" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "SQL sorgusu çalıştırılamadı.");
    } finally {
      setRunning(false);
    }
  }

  function clearState() {
    setSql("");
    setConfirmed(false);
    setDestructiveConfirmation("");
    setResult(null);
    setError("");
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Sistem"
        title="SQL Editörü"
        description="Canlı MySQL veritabanında tek SQL ifadesi çalıştırın. Bu araç yalnızca yetkili admin kullanımı içindir."
      />

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Canlı veritabanı uyarısı</AlertTitle>
        <AlertDescription>Canlı veritabanında yapılan işlemler geri alınamaz.</AlertDescription>
      </Alert>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4 rounded-md border border-border bg-card p-4 shadow-card-soft">
          <div>
            <Label htmlFor="sql-editor-input">SQL</Label>
            <Textarea
              id="sql-editor-input"
              value={sql}
              onChange={(event) => setSql(event.target.value)}
              className="mt-2 min-h-[260px] font-mono text-sm"
              spellCheck={false}
              placeholder="SELECT * FROM ak_projects LIMIT 20"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Algılanan tür: <strong>{currentType || "-"}</strong></span>
              {multipleStatements && <span className="font-medium text-destructive">Birden fazla ifade algılandı.</span>}
            </div>
          </div>

          {!isSelect && (
            <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <label className="flex items-start gap-2">
                <Checkbox checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
                <span>Bu SELECT dışı SQL sorgusunun canlı veritabanını değiştirebileceğini onaylıyorum.</span>
              </label>
              {isDestructive && (
                <div>
                  <Label htmlFor="destructive-confirmation">DROP / TRUNCATE / ALTER onayı</Label>
                  <Input
                    id="destructive-confirmation"
                    value={destructiveConfirmation}
                    onChange={(event) => setDestructiveConfirmation(event.target.value)}
                    placeholder="UYGULA"
                    className="mt-1 bg-white"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={runSql} disabled={!canExecute || running} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Çalıştır
            </Button>
            <Button variant="outline" onClick={clearState} disabled={running}>
              <RotateCcw className="h-4 w-4" />
              Temizle
            </Button>
          </div>
        </section>

        <aside className="rounded-md border border-border bg-card p-4 shadow-card-soft">
          <div className="mb-3 font-semibold">Sorgu Geçmişi</div>
          {history.length ? (
            <Select onValueChange={(value) => {
              const item = history.find((entry) => entry.executedAt === value);
              if (item) {
                setSql(item.sql);
                setConfirmed(false);
                setDestructiveConfirmation("");
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Geçmişten sorgu seç" /></SelectTrigger>
              <SelectContent>
                {history.map((item) => (
                  <SelectItem key={item.executedAt} value={item.executedAt}>
                    {item.statementType} - {new Date(item.executedAt).toLocaleString("tr-TR")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">Henüz sorgu geçmişi yok.</p>
          )}
          {history.length > 0 && (
            <div className="mt-3 max-h-[360px] space-y-2 overflow-auto">
              {history.map((item) => (
                <button
                  key={item.executedAt}
                  type="button"
                  onClick={() => {
                    setSql(item.sql);
                    setConfirmed(false);
                    setDestructiveConfirmation("");
                  }}
                  className="w-full rounded-md border border-border bg-background p-2 text-left text-xs hover:border-accent/60"
                >
                  <div className="font-semibold">{item.statementType} · {new Date(item.executedAt).toLocaleString("tr-TR")}</div>
                  <div className="mt-1 line-clamp-3 font-mono text-muted-foreground">{item.sql}</div>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>SQL hatası</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <section className="rounded-md border border-border bg-card shadow-card-soft">
          <div className="border-b border-border p-4">
            <div className="font-semibold">Sonuç</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {result.is_select ? `${result.row_count} satır listelendi.` : `${result.affected_rows ?? 0} satır etkilendi.`}
            </div>
          </div>

          {result.is_select ? (
            result.columns.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>{result.columns.map((column) => <th key={column} className="p-3">{column}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, index) => (
                      <tr key={index} className="border-t border-border">
                        {result.columns.map((column) => (
                          <td key={column} className="max-w-[360px] truncate p-3 font-mono text-xs" title={String(row[column] ?? "")}>
                            {String(row[column] ?? "NULL")}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {result.rows.length === 0 && (
                      <tr><td colSpan={result.columns.length} className="p-8 text-center text-muted-foreground">Sorgu başarıyla çalıştı, sonuç satırı yok.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <AdminEmptyState title="Sonuç kolonu yok" description="Sorgu çalıştı ancak listelenecek kolon dönmedi." icon={Database} />
            )
          ) : (
            <div className="p-4 text-sm">
              <div className="rounded-md bg-muted p-4">
                <div className="font-semibold">İşlem tamamlandı</div>
                <div className="mt-1 text-muted-foreground">Etkilenen satır: {result.affected_rows ?? 0}</div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
