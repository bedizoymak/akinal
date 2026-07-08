import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Calculator, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { useToast } from "@/hooks/use-toast";
import {
  type InflationCalculationResult,
  type InflationIndex,
  type InflationIndicesResponse,
  calculateInflation,
  getInflationIndices,
} from "@/lib/apiClient";

const MONTHS: { value: number; label: string }[] = [
  { value: 1,  label: "Ocak" },
  { value: 2,  label: "Şubat" },
  { value: 3,  label: "Mart" },
  { value: 4,  label: "Nisan" },
  { value: 5,  label: "Mayıs" },
  { value: 6,  label: "Haziran" },
  { value: 7,  label: "Temmuz" },
  { value: 8,  label: "Ağustos" },
  { value: 9,  label: "Eylül" },
  { value: 10, label: "Ekim" },
  { value: 11, label: "Kasım" },
  { value: 12, label: "Aralık" },
];

function formatTRY(v: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 2,
  }).format(v);
}

function formatPct(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined) return "—";
  return `%${Number(v).toLocaleString("tr-TR", {
    minimumFractionDigits: decimals, maximumFractionDigits: 4,
  })}`;
}

function periodLabel(year: number, month: number): string {
  return `${MONTHS.find((m) => m.value === month)?.label ?? month} ${year}`;
}

function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function ResultCard({ label, value, sub, tone = "default" }: {
  label: string; value: string; sub?: string;
  tone?: "default" | "success" | "danger" | "accent";
}) {
  const toneClass = {
    default: "text-foreground", success: "text-emerald-600",
    danger: "text-red-600", accent: "text-accent",
  }[tone];
  const barClass = {
    default: "bg-border", success: "bg-emerald-500",
    danger: "bg-red-500", accent: "bg-accent",
  }[tone];
  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-card p-5 shadow-sm">
      <div className={`absolute inset-x-0 top-0 h-1 ${barClass}`} />
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className={`mt-3 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function AdminInflationCalculator() {
  const { toast } = useToast();

  const [amountTry,   setAmountTry]   = useState("1000000");
  const [baseYear,    setBaseYear]    = useState(2025);
  const [baseMonth,   setBaseMonth]   = useState(6);
  const [targetYear,  setTargetYear]  = useState(2026);
  const [targetMonth, setTargetMonth] = useState(6);

  const [indices,          setIndices]          = useState<InflationIndex[]>([]);
  const [syncWarning,      setSyncWarning]       = useState<string | null>(null);
  const [lastSyncedPeriod, setLastSyncedPeriod]  = useState<string | null>(null);
  const [activeIndexType,  setActiveIndexType]   = useState<string>("TCMB_YEARLY_BASE_100");
  const [result,           setResult]            = useState<InflationCalculationResult | null>(null);
  const [calculating,      setCalculating]       = useState(false);
  const [loadingIdx,       setLoadingIdx]        = useState(true);

  const availablePeriods = new Set(indices.map((i) => periodKey(i.period_year, i.period_month)));
  const availableYears   = [...new Set(indices.map((i) => i.period_year))].sort((a, b) => a - b);

  const baseSerial   = baseYear * 12 + baseMonth;
  const targetSerial = targetYear * 12 + targetMonth;
  const periodCount  = targetSerial - baseSerial;

  // Warn if either endpoint is missing from loaded data
  const baseMissing   = indices.length > 0 && !availablePeriods.has(periodKey(baseYear, baseMonth));
  const targetMissing = indices.length > 0 && !availablePeriods.has(periodKey(targetYear, targetMonth));
  const orderInvalid  = periodCount <= 0;

  useEffect(() => {
    setLoadingIdx(true);
    getInflationIndices()
      .then((res: InflationIndicesResponse) => {
        const loaded = res.indices ?? [];
        setIndices(loaded);
        setSyncWarning(res.sync_warning ?? null);
        setLastSyncedPeriod(res.last_synced_period ?? null);
        const indexType = res.active_index_type ?? "TCMB_YEARLY_BASE_100";
        setActiveIndexType(indexType);

        if (loaded.length === 0) return;

        // Indices come back DESC; find latest period serial
        const serials = loaded.map((i) => i.period_year * 12 + i.period_month);
        const maxSerial = Math.max(...serials);
        const tMonth = maxSerial % 12 || 12;
        const tYear  = Math.floor((maxSerial - tMonth) / 12);

        // Base = target minus 12 months; fall back to earliest available if not present
        const idealBaseSerial = maxSerial - 12;
        const minSerial = Math.min(...serials);
        const resolvedBaseSerial = serials.includes(idealBaseSerial) ? idealBaseSerial : minSerial;
        const bMonth = resolvedBaseSerial % 12 || 12;
        const bYear  = Math.floor((resolvedBaseSerial - bMonth) / 12);

        setTargetYear(tYear);
        setTargetMonth(tMonth);
        setBaseYear(bYear);
        setBaseMonth(bMonth);

        // Auto-calculate with resolved defaults
        setCalculating(true);
        setResult(null);
        calculateInflation({
          amount_try:   1_000_000,
          base_year:    bYear,
          base_month:   bMonth,
          target_year:  tYear,
          target_month: tMonth,
          index_type:   indexType,
        })
          .then(setResult)
          .catch((err: unknown) => {
            toast({
              title: "Hesaplama başarısız.",
              description: err instanceof Error ? err.message : String(err),
              variant: "destructive",
            });
          })
          .finally(() => setCalculating(false));
      })
      .catch((err: unknown) => {
        toast({
          title: "Endeksler yüklenemedi.",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      })
      .finally(() => setLoadingIdx(false));
  }, []);

  async function handleCalculate() {
    const amount = parseFloat(amountTry.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Geçersiz tutar.", description: "Lütfen pozitif bir tutar girin.", variant: "destructive" });
      return;
    }
    setCalculating(true);
    setResult(null);
    try {
      const res = await calculateInflation({
        amount_try:   amount,
        base_year:    baseYear,
        base_month:   baseMonth,
        target_year:  targetYear,
        target_month: targetMonth,
        index_type:   activeIndexType,
      });
      setResult(res);
    } catch (err) {
      toast({
        title: "Hesaplama başarısız.",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  }

  const canCalculate = !calculating && !orderInvalid && !baseMissing && !targetMissing && indices.length > 0;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Finans"
        title="Enflasyon Hesaplama"
        description="TCMB aylık TÜFE verilerini bileşik çarpımla iki dönem arasındaki enflasyonu hesaplar."
      />

      {syncWarning && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>{syncWarning}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4 text-accent" />
            Hesaplama Parametreleri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Tutar (TL)</Label>
            <Input
              id="amount"
              placeholder="örn. 1000000"
              value={amountTry}
              onChange={(e) => setAmountTry(e.target.value)}
              className="max-w-sm tabular-nums"
            />
          </div>

          {/* Period selectors */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto_1fr]">
            {/* Base period */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">Baz Dönem</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Ay</Label>
                  <Select value={String(baseMonth)} onValueChange={(v) => { setBaseMonth(Number(v)); setResult(null); }}>
                    <SelectTrigger className={baseMissing ? "border-amber-400" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Yıl</Label>
                  <Select value={String(baseYear)} onValueChange={(v) => { setBaseYear(Number(v)); setResult(null); }}>
                    <SelectTrigger className={baseMissing ? "border-amber-400" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(availableYears.length > 0 ? availableYears : [2025, 2026]).map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-end justify-center pb-2">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>

            {/* Target period */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">Hedef Dönem</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Ay</Label>
                  <Select value={String(targetMonth)} onValueChange={(v) => { setTargetMonth(Number(v)); setResult(null); }}>
                    <SelectTrigger className={targetMissing ? "border-amber-400" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Yıl</Label>
                  <Select value={String(targetYear)} onValueChange={(v) => { setTargetYear(Number(v)); setResult(null); }}>
                    <SelectTrigger className={targetMissing ? "border-amber-400" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(availableYears.length > 0 ? availableYears : [2025, 2026]).map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Validation warnings */}
          {orderInvalid && (
            <p className="text-sm text-red-600">Hedef dönem baz dönemden sonra olmalıdır.</p>
          )}
          {!orderInvalid && (baseMissing || targetMissing) && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                {baseMissing && <>{periodLabel(baseYear, baseMonth)} (baz dönem){targetMissing ? " ve " : ""}</>}
                {targetMissing && <>{periodLabel(targetYear, targetMonth)} (hedef dönem)</>}
                {" "}için veri bulunamadı.
              </span>
            </div>
          )}

          {!orderInvalid && !baseMissing && !targetMissing && indices.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {periodCount} aylık bileşik hesaplama:{" "}
              {periodLabel(baseYear, baseMonth)} → {periodLabel(targetYear, targetMonth)}
            </p>
          )}

          <Button
            onClick={handleCalculate}
            disabled={!canCalculate}
            className="bg-accent text-accent-foreground hover:bg-accent-glow"
          >
            <Calculator className="h-4 w-4" />
            {calculating ? "Hesaplanıyor..." : "Hesapla"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            <p className="text-sm font-semibold text-muted-foreground">
              Hesaplanan dönem:{" "}
              <span className="text-foreground">
                {result.months_used[0]} → {result.months_used[result.months_used.length - 1]}
              </span>
              {" "}({result.months_used.length} ay bileşik TÜFE)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <ResultCard
              label="Tutar"
              value={formatTRY(result.amount_try)}
              sub={`Baz: ${periodLabel(baseYear, baseMonth)}`}
            />
            <ResultCard
              label="Güncellenmiş Tutar"
              value={formatTRY(result.adjusted_amount)}
              sub={`Hedef: ${periodLabel(targetYear, targetMonth)}`}
              tone="accent"
            />
            <ResultCard
              label="Fark"
              value={formatTRY(result.difference)}
              sub={`+${result.rate_percent.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`}
              tone="danger"
            />
            <ResultCard
              label="Enflasyon Oranı"
              value={formatPct(result.rate_percent, 4)}
              sub={`Çarpan: ${result.factor.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`}
            />
          </div>
        </div>
      )}

      {/* TÜFE data table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>TÜFE Aylık Verileri</span>
            <span className="flex items-center gap-3 text-sm font-normal text-muted-foreground">
              {lastSyncedPeriod && (
                <span>
                  Son dönem: <span className="font-medium text-foreground">{lastSyncedPeriod}</span>
                </span>
              )}
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                Kaynak: TCMB
              </span>
              {loadingIdx ? "Yükleniyor..." : `${indices.length} kayıt`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!loadingIdx && indices.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Henüz TÜFE verisi bulunamadı.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dönem</TableHead>
                  <TableHead className="text-right">Yıllık Değişim</TableHead>
                  <TableHead className="text-right">Aylık Değişim</TableHead>
                  <TableHead>Kaynak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indices.map((row) => {
                  const key      = periodKey(row.period_year, row.period_month);
                  const isBase   = key === periodKey(baseYear, baseMonth);
                  const isTarget = key === periodKey(targetYear, targetMonth);
                  const inRange  = !orderInvalid
                    && (row.period_year * 12 + row.period_month) > baseSerial
                    && (row.period_year * 12 + row.period_month) <= targetSerial;

                  return (
                    <TableRow
                      key={row.id}
                      className={inRange ? "bg-accent/5" : isBase ? "bg-muted/40" : undefined}
                    >
                      <TableCell className="font-medium tabular-nums">
                        {periodLabel(row.period_year, row.period_month)}
                        {isBase && (
                          <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">baz</span>
                        )}
                        {isTarget && (
                          <span className="ml-2 rounded-full bg-accent/20 px-1.5 py-0.5 text-xs font-semibold text-accent">hedef</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatPct(row.annual_change_percent)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatPct(row.monthly_change_percent)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.source ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
