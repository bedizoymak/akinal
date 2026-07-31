import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  FolderKanban,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader, AdminSection } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDate,
  displayLabel,
  formatMoney,
  type CurrencyTag,
  type EntryDirection,
  type GroupTag,
} from "@/lib/finance";
import { statusBadgeVariant } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { ApiError, getAdminDashboard } from "@/lib/apiClient";
import type {
  AdminDashboardResponse,
  AdminDashboardMonthlyFinancial,
  AdminDashboardMovement,
  AdminDashboardPaymentPlan,
  AdminDashboardProject,
  AdminDashboardSummary,
} from "@/lib/apiTypes";

type RecentMovement = {
  id: string;
  label: string;
  amount: number;
  date: string;
  direction: EntryDirection;
  source: string;
  currency: CurrencyTag;
  group: GroupTag;
  projectTitle?: string;
};

type DashboardData = {
  summary: AdminDashboardSummary;
  activeProjects: AdminDashboardProject[];
  overduePlans: AdminDashboardPaymentPlan[];
  upcomingPlans: AdminDashboardPaymentPlan[];
  recentMovements: AdminDashboardMovement[];
  monthlyFinancials: AdminDashboardMonthlyFinancial[];
};

const initialData: DashboardData = {
  summary: {
    total_projects: 0,
    active_projects: 0,
    published_projects: 0,
    draft_projects: 0,
    total_contact_requests: 0,
    new_contact_requests: 0,
    unread_notifications: 0,
    total_customers: 0,
    total_payments: 0,
    total_expenses: 0,
    basic_net_balance: 0,
  },
  activeProjects: [],
  overduePlans: [],
  upcomingPlans: [],
  recentMovements: [],
  monthlyFinancials: [],
};

export function normalizeDashboardData(dashboard: Partial<AdminDashboardResponse> | null | undefined): DashboardData {
  return {
    summary: dashboard?.summary || initialData.summary,
    activeProjects: dashboard?.active_projects_list || [],
    overduePlans: dashboard?.overdue_plans || [],
    upcomingPlans: dashboard?.upcoming_plans || [],
    recentMovements: dashboard?.recent_movements || [],
    monthlyFinancials: dashboard?.monthly_financials || [],
  };
}

const chartColors = {
  income: "hsl(142 48% 28%)",
  expenses: "hsl(0 72% 51%)",
  net: "hsl(38 92% 50%)",
};

const dashboardCurrencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const ADMIN_DASHBOARD_AUTH_GUARD_CACHE_BUST = "20260617-hard-null-guard-v2";

function formatDashboardTRY(value: number) {
  return dashboardCurrencyFormatter.format(value);
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthLabel(date: Date) {
  return date.toLocaleDateString("tr-TR", { month: "short" }).replace(".", "");
}

// Full Turkish month name for tooltips (e.g. "Mayıs"), distinct from the short axis label.
function toMonthLabelFull(date: Date) {
  return date.toLocaleDateString("tr-TR", { month: "long" });
}

function lastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return { key: toMonthKey(date), month: toMonthLabel(date), monthFull: toMonthLabelFull(date) };
  });
}

function chartCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} mn`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} bin`;
  return value.toLocaleString("tr-TR");
}

function normalizeCurrency(value: string | null | undefined): CurrencyTag {
  return value === "USD" || value === "EUR" ? value : "TRY";
}

function normalizeDirection(value: string | null | undefined): EntryDirection {
  return value === "Gider" ? "Gider" : "Gelir";
}

function normalizeGroup(value: string | null | undefined): GroupTag {
  return value === "Gayri Resmi" ? "Gayri Resmi" : "Resmi";
}

function movementSource(cardType: string | null | undefined) {
  if (cardType === "employee") return "Personel";
  if (cardType === "expense") return "Gider";
  return "Müşteri";
}

function LoadingDashboard() {
  return (
    <div className="w-full max-w-full space-y-7 overflow-x-hidden">
      <div className="rounded-md border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-card-soft">
        Veriler hazırlanıyor...
      </div>
      <div className="grid w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-md border border-border bg-card p-4 shadow-card-soft">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-7 w-28" />
            <Skeleton className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 rounded-md" />
      <Skeleton className="h-72 rounded-md" />
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(false);
      setAuthError(false);
      setErrorMessage("");
      try {
        const dashboard = await getAdminDashboard();
        if (!active) return;
        if (!dashboard) {
          setData(null);
          setErrorMessage("Dashboard API boş veri döndürdü.");
          setLoadError(true);
          return;
        }
        setData(normalizeDashboardData(dashboard));
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setAuthError(true);
          navigate("/admin/giris", { replace: true });
          return;
        }
        setData(null);
        setErrorMessage(error instanceof Error ? error.message : "Dashboard verileri alınamadı.");
        setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  const normalizedData = data || initialData;
  const dashboard = useMemo(() => {
    const months = lastSixMonths();
    // "Aylık Finans Özeti" — last 6 months of REALIZED (paid) cash flow, oldest → newest.
    // dashboard.php's monthly_financials aggregates paid_amount_try (never amount_try/remaining)
    // grouped by entry_date across the four canonical financial-entry tables (customer/employee/
    // supplier/expense-card). entry_date is the only date column those tables have — there is no
    // separate paid/collection-date field — so it is the canonical realized date here, and it's
    // the same basis the Toplam Tahsilat/Toplam Gider/Net Durum cards use (compute_finance_summary
    // sums the same paid_amount_try columns, unfiltered by date).
    const monthlyByKey = new Map(normalizedData.monthlyFinancials.map((item) => [item.month, item]));
    const monthlyFinancials = months.map((month) => {
      const item = monthlyByKey.get(month.key);
      const income = Number(item?.income || 0);
      const expenses = Number(item?.expense || 0);
      const net = Number(item?.net ?? income - expenses);
      return { month: month.month, monthFull: month.monthFull, income, expenses, net };
    });

    const recentMovements: RecentMovement[] = normalizedData.recentMovements.map((movement) => ({
      id: movement.id,
      label: movement.label || "Finansal hareket",
      amount: Number(movement.amount || 0),
      date: movement.date || "",
      direction: normalizeDirection(movement.direction),
      source: movementSource(movement.card_type),
      currency: normalizeCurrency(movement.currency),
      group: normalizeGroup(movement.group),
      projectTitle: movement.project_title || undefined,
    }));

    return {
      summary: normalizedData.summary,
      totalIncome: Number(normalizedData.summary.total_payments || 0),
      totalExpenses: Number(normalizedData.summary.total_expenses || 0),
      netStatus: Number(normalizedData.summary.basic_net_balance || 0),
      monthIncome: Number(normalizedData.summary.month_income || 0),
      monthExpenses: Number(normalizedData.summary.month_expenses || 0),
      monthNet: Number(normalizedData.summary.month_net || 0),
      activeProjects: normalizedData.activeProjects,
      expectedPayments: Number(normalizedData.summary.expected_payments || 0),
      overdueCollections: Number(normalizedData.summary.overdue_collections || 0),
      overduePlanCount: Number(normalizedData.summary.overdue_plan_count || normalizedData.overduePlans.length),
      overduePlans: normalizedData.overduePlans,
      upcomingPlans: normalizedData.upcomingPlans,
      recentMovements,
      newRequests: Array.from({ length: Number(normalizedData.summary.new_contact_requests || 0) }),
      cacheBust: ADMIN_DASHBOARD_AUTH_GUARD_CACHE_BUST,
      monthlyFinancials,
      hasFinancialData: Boolean(Number(normalizedData.summary.financial_entry_count || 0) || normalizedData.monthlyFinancials.length || recentMovements.length),
    };
  }, [normalizedData]);

  if (loading) {
    return <LoadingDashboard />;
  }

  if (authError) {
    return null;
  }

  if (loadError || !data) {
    return (
      <div className="w-full max-w-full space-y-6 overflow-x-hidden">
        <AdminPageHeader
          eyebrow="Yönetim Özeti"
          title="Genel Bakış"
          description="Projeler, tahsilatlar, giderler ve net durumu tek ekrandan takip edin."
        />
        <AdminEmptyState
          title="Veriler alınamadı"
          description={errorMessage || "Oturumunuz sona ermiş veya dashboard API geçici olarak yanıt vermiyor olabilir."}
          icon={Wallet}
          action={<Button onClick={() => window.location.reload()}>Tekrar Dene</Button>}
        />
      </div>
    );
  }

  // Gelenler (/admin/gelenler) reads status/date_from/date_to as API filters and "sort" as a
  // client-side-only ordering hint — see AdminGelenler.tsx. "Gecikmiş" = overdue and not yet
  // collected. Local (Türkiye) calendar date, not toISOString() (UTC — off-by-one near midnight).
  const nowLocal = new Date();
  const todayLocalISO = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
  const toplamTahsilatHref = `/admin/gelenler?${new URLSearchParams({ date_to: todayLocalISO }).toString()}`;
  // "Açık" = every open/uncollected customer receivable (planned or overdue, any date) — see
  // the matching status branch in gelenler.php. No date_from/date_to: open items aren't
  // date-scoped, they just haven't been fully collected yet.
  const beklenenTahsilatHref = `/admin/gelenler?${new URLSearchParams({ status: "Açık", sort: "date_asc" }).toString()}`;
  const vadesiGecenHref = `/admin/gelenler?${new URLSearchParams({ status: "Gecikmiş", sort: "date_desc" }).toString()}`;

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-hidden">
      <AdminPageHeader
        eyebrow="Yönetim Özeti"
        title="Genel Bakış"
        description="Projeler, tahsilatlar, giderler ve net durumu tek ekrandan takip edin."
      />

      {loading ? (
        <LoadingDashboard />
      ) : loadError ? (
        <AdminEmptyState
          title="Veriler alınamadı"
          description={errorMessage || "Oturumunuz sona ermiş veya dashboard API geçici olarak yanıt vermiyor olabilir."}
          icon={Wallet}
          action={<Button onClick={() => window.location.reload()}>Tekrar Dene</Button>}
        />
      ) : (
        <>
          <div className="grid w-full max-w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminMetricCard to="/admin/projeler" label="Aktif Projeler" value={dashboard.summary.active_projects} description={`${dashboard.summary.total_projects} toplam proje`} icon={FolderKanban} tone="accent" />
            <AdminMetricCard to={toplamTahsilatHref} label="Toplam Tahsilat" value={formatDashboardTRY(dashboard.totalIncome)} description="Gerçekleşen gelen ödemeler" icon={Wallet} tone="success" />
            <AdminMetricCard to="/admin/gidenler" label="Toplam Gider" value={formatDashboardTRY(dashboard.totalExpenses)} description="Yapılan masraflar" icon={Receipt} tone="danger" />
            <AdminMetricCard to="/admin/net-durum" label="Net Durum" value={formatDashboardTRY(dashboard.netStatus)} description="Gerçekleşen gelir eksi gider" icon={dashboard.netStatus >= 0 ? TrendingUp : TrendingDown} tone={dashboard.netStatus >= 0 ? "success" : "danger"} />
            <AdminMetricCard to={beklenenTahsilatHref} label="Beklenen Tahsilat" value={formatDashboardTRY(dashboard.expectedPayments)} description="Açık (tahsil edilmemiş) tüm müşteri alacakları" icon={CalendarClock} tone="warning" />
            <AdminMetricCard to={vadesiGecenHref} label="Vadesi Geçen Alacak" value={formatDashboardTRY(dashboard.overdueCollections)} description={`${dashboard.overduePlanCount} ödeme kaydı takip bekliyor`} icon={Receipt} tone={dashboard.overdueCollections > 0 ? "danger" : "success"} />
          </div>

          {(() => {
            const donutData = [
              { name: "Tahsil Edilen", value: dashboard.totalIncome, color: "hsl(142 48% 28%)" },
              { name: "Toplam Gider", value: dashboard.totalExpenses, color: "hsl(0 72% 51%)" },
            ].filter((d) => d.value > 0);
            return (
              <div className="rounded-xl border border-border bg-card p-5 shadow-card-soft">
                <div className="mb-4">
                  <div className="text-sm font-semibold">Gelir / Gider Dağılımı</div>
                  <div className="mt-1 text-xs text-muted-foreground">Gerçekleşen toplam tahsilat ve gider oranı</div>
                </div>
                {donutData.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Henüz finansal veri bulunmuyor.</div>
                ) : (
                  <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
                    <ResponsiveContainer width={200} height={200}>
                      <PieChart>
                        <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3}>
                          {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [formatDashboardTRY(Number(v || 0)), ""]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="w-full max-w-xs space-y-2">
                      {donutData.map((entry) => (
                        <div key={entry.name} className="flex items-center gap-2 text-sm">
                          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
                          <span className="text-muted-foreground">{entry.name}</span>
                          <span className="ml-auto pl-4 font-bold tabular-nums">{formatDashboardTRY(entry.value)}</span>
                        </div>
                      ))}
                      <div className="border-t border-border pt-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: dashboard.netStatus >= 0 ? "hsl(142 48% 28%)" : "hsl(0 72% 51%)" }} />
                          <span className="text-muted-foreground">Net Durum</span>
                          <span className={cn("ml-auto pl-4 font-bold tabular-nums", dashboard.netStatus >= 0 ? "text-emerald-700" : "text-red-600")}>{formatDashboardTRY(dashboard.netStatus)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <AdminSection title="Bu Ayın Özeti" description="İçinde bulunduğumuz ayın gerçekleşen gelir, gider ve net durumu.">
            <div className="grid w-full max-w-full grid-cols-1 gap-4 md:grid-cols-3">
              <AdminMetricCard label="Bu Ay Tahsilat" value={formatDashboardTRY(dashboard.monthIncome)} icon={Wallet} tone="success" />
              <AdminMetricCard label="Bu Ay Gider" value={formatDashboardTRY(dashboard.monthExpenses)} icon={Receipt} tone="danger" />
              <AdminMetricCard label="Bu Ay Net Durum" value={formatDashboardTRY(dashboard.monthNet)} icon={dashboard.monthNet >= 0 ? TrendingUp : TrendingDown} tone={dashboard.monthNet >= 0 ? "success" : "danger"} />
            </div>
          </AdminSection>

          <div className="grid w-full max-w-full grid-cols-1 gap-6 xl:grid-cols-3">
            <AdminSection title="Takip Gerektirenler" description="Bugün bakılması faydalı olan kısa liste." className="xl:col-span-1" contentClassName="space-y-3">
              <Link to="/admin/musteriler" className="block rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5">
                <div className="text-sm font-semibold">Vadesi Geçen Alacak</div>
                <div className={cn("mt-1 text-lg font-bold", dashboard.overdueCollections > 0 ? "text-red-700" : "text-emerald-700")}>{formatDashboardTRY(dashboard.overdueCollections)}</div>
                <div className="mt-1 text-xs text-muted-foreground">{dashboard.overduePlanCount} ödeme kaydı takip bekliyor.</div>
              </Link>
              <Link to="/admin/musteriler" className="block rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5">
                <div className="text-sm font-semibold">Yaklaşan Tahsilatlar</div>
                <div className="mt-1 text-lg font-bold text-amber-700">{dashboard.upcomingPlans.length}</div>
                <div className="mt-1 text-xs text-muted-foreground">Önümüzdeki 30 gün içinde.</div>
              </Link>
              <Link to="/admin/talepler" className="block rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5">
                <div className="text-sm font-semibold">Yeni İletişim Talepleri</div>
                <div className="mt-1 text-lg font-bold text-accent">{dashboard.newRequests.length}</div>
                <div className="mt-1 text-xs text-muted-foreground">Web sitesinden gelen yeni talepler.</div>
              </Link>
            </AdminSection>

            <AdminSection title="Son Hareketler" description="Son tahsilat, gider ve finans kayıtları." className="xl:col-span-2" contentClassName="space-y-2">
              {dashboard.recentMovements.length === 0 ? (
                <AdminEmptyState title="Henüz finansal hareket yok" description="İlk finansal hareket eklendiğinde son kayıtlar burada görünecek." icon={Wallet} />
              ) : (
                dashboard.recentMovements.slice(0, 5).map((movement) => {
                  const isIncome = movement.direction === "Gelir";
                  return (
                    <div key={movement.id} className="flex min-w-0 max-w-full flex-col gap-3 rounded-md border border-border p-3 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", isIncome ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>{movement.source}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(movement.date)}</span>
                        </div>
                        <div className="mt-2 whitespace-normal break-words font-semibold">{movement.label}</div>
                        <div className="mt-1 whitespace-normal break-words text-xs text-muted-foreground">
                          {movement.projectTitle || "Proje bağlantısı yok"} · {movement.group}
                        </div>
                      </div>
                      <div className={cn("max-w-full shrink-0 self-end whitespace-normal break-words text-right text-lg font-extrabold tabular-nums sm:self-auto", isIncome ? "text-emerald-700" : "text-red-600")}>
                        {isIncome ? "+" : "-"}{formatMoney(movement.amount, movement.currency)}
                      </div>
                    </div>
                  );
                })
              )}
            </AdminSection>
          </div>

          <div className="grid w-full max-w-full grid-cols-1 gap-6 xl:grid-cols-2">
            <AdminSection title="Proje Durumu" description="Devam eden projeler ve hızlı erişim." contentClassName="space-y-2">
              {dashboard.activeProjects.length === 0 ? (
                <AdminEmptyState
                  title="Aktif proje bulunmuyor"
                  description="Yeni proje eklediğinizde proje durumu burada görünecek."
                  icon={FolderKanban}
                  action={<Button asChild><Link to="/admin/projeler/yeni">Yeni Proje Ekle</Link></Button>}
                />
              ) : (
                dashboard.activeProjects.slice(0, 6).map((project) => (
                  <Link key={project.id} to={`/admin/projeler/${project.id}/finans`} className="flex min-w-0 max-w-full flex-col gap-3 rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="whitespace-normal break-words font-semibold">{project.title}</div>
                      <div className="mt-1 whitespace-normal break-words text-xs text-muted-foreground">{project.location || "Konum girilmemiş"}</div>
                    </div>
                    <div className="flex max-w-full shrink-0 items-center gap-2 self-start sm:self-auto">
                      <span className={cn("rounded-md border px-2 py-1 text-xs font-medium", statusBadgeVariant(project.project_status))}>{displayLabel(project.project_status)}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))
              )}
            </AdminSection>

            <AdminSection title="Aylık Finans Özeti" description="Son 6 ayın tahsilat, gider ve net durumu.">
              {dashboard.hasFinancialData ? (
                <div className="min-w-0 max-w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dashboard.monthlyFinancials} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={chartCurrency} tick={{ fontSize: 12 }} width={56} />
                    <Tooltip
                      formatter={(value: number) => formatDashboardTRY(value)}
                      labelFormatter={(_label, payload) => payload?.[0]?.payload?.monthFull ?? _label}
                    />
                    <Legend />
                    <Bar dataKey="income" name="Tahsilat" fill={chartColors.income} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Gider" fill={chartColors.expenses} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" name="Net Durum" fill={chartColors.net} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <AdminEmptyState title="Henüz finansal hareket yok" description="Finansal hareket eklendikçe aylık grafik otomatik oluşacak." icon={BarChart3} />
              )}
            </AdminSection>
          </div>
        </>
      )}
    </div>
  );
}
