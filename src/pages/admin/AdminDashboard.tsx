import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  FolderKanban,
  Inbox,
  Plus,
  Receipt,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
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
  AdminCashflowActionCenter,
  AdminCashflowActionItem,
  AdminCashflowCommandCenter,
  AdminExpenseCategoryIntelligence,
  AdminFinancialDrilldownRow,
  AdminFinancialDrilldowns,
  AdminManagementDecisionDashboard,
  AdminNetCashForecast,
  AdminUnifiedFinancialCards,
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
  unifiedFinancialCards: AdminUnifiedFinancialCards;
  cashflowCommandCenter: AdminCashflowCommandCenter;
  netCashForecast: AdminNetCashForecast;
  cashflowActionCenter: AdminCashflowActionCenter;
  managementDecisionDashboard: AdminManagementDecisionDashboard;
  financialDrilldowns: AdminFinancialDrilldowns;
  expenseCategoryIntelligence: AdminExpenseCategoryIntelligence;
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
  unifiedFinancialCards: {
    customers: [],
    projects: [],
    suppliers: [],
    personnel: [],
  },
  cashflowCommandCenter: {
    current_receivables: 0,
    current_payables: 0,
    net_cash_position: 0,
    overdue_collections: 0,
    upcoming_collections: 0,
    upcoming_payments: 0,
    personnel_cost_total: 0,
    most_risky_customers: [],
    most_expensive_projects: [],
    highest_supplier_debt: [],
  },
  netCashForecast: {
    available_cash: 0,
    current_payables: 0,
    overdue_collections: 0,
    overdue_payables: 0,
    official_cash_position: 0,
    unofficial_cash_position: 0,
    combined_operational_cash_position: 0,
    windows: [],
  },
  cashflowActionCenter: {
    critical_collections: {
      highest_overdue_customers: [],
      highest_outstanding_balances: [],
      collection_risk_scores: [],
    },
    critical_payments: {
      upcoming_supplier_payments: [],
      upcoming_personnel_payments: [],
      highest_payable_balances: [],
      overdue_payable_actions: [],
    },
    project_risk_list: {
      lowest_profitability_projects: [],
      highest_expense_projects: [],
      negative_cashflow_projects: [],
    },
    daily_action_queue: {
      customers_to_contact_today: [],
      suppliers_requiring_payment_review: [],
      projects_requiring_financial_review: [],
      payment_priority_queue: [],
    },
  },
  managementDecisionDashboard: {
    top_risky_customers: [],
    top_overdue_collections: [],
    top_supplier_liabilities: [],
    top_personnel_cost_centers: [],
    top_profitable_projects: [],
    top_loss_making_projects: [],
    cash_shortage_warnings: [],
    collection_priority_queue: [],
    payment_priority_queue: [],
    category_priority_queue: [],
    official_unofficial_actions: [],
  },
  financialDrilldowns: {
    customer: { collections: [], pending_payments: [], overdue_payments: [] },
    project: { revenue_rows: [], expense_rows: [], profit_components: [] },
    supplier: { purchases: [], payments: [], remaining_payable_rows: [] },
    personnel: { salary: [], advances: [], reimbursements: [], total_cost_rows: [] },
  },
  expenseCategoryIntelligence: {
    categories: [],
    top_spending_categories: [],
    uncategorized: [],
    summary: {
      realized_cost_total: 0,
      planned_cost_total: 0,
      cash_pressure_total: 0,
      profitability_impact_total: 0,
      uncategorized_count: 0,
      category_count: 0,
    },
  },
};

export function normalizeDashboardData(dashboard: Partial<AdminDashboardResponse> | null | undefined): DashboardData {
  return {
    summary: dashboard?.summary || initialData.summary,
    activeProjects: dashboard?.active_projects_list || [],
    overduePlans: dashboard?.overdue_plans || [],
    upcomingPlans: dashboard?.upcoming_plans || [],
    recentMovements: dashboard?.recent_movements || [],
    monthlyFinancials: dashboard?.monthly_financials || [],
    unifiedFinancialCards: dashboard?.unified_financial_cards || initialData.unifiedFinancialCards,
    cashflowCommandCenter: dashboard?.cashflow_command_center || initialData.cashflowCommandCenter,
    netCashForecast: dashboard?.net_cash_forecast || initialData.netCashForecast,
    cashflowActionCenter: {
      ...initialData.cashflowActionCenter,
      ...(dashboard?.cashflow_action_center || {}),
      critical_collections: {
        ...initialData.cashflowActionCenter.critical_collections,
        ...(dashboard?.cashflow_action_center?.critical_collections || {}),
      },
      critical_payments: {
        ...initialData.cashflowActionCenter.critical_payments,
        ...(dashboard?.cashflow_action_center?.critical_payments || {}),
      },
      project_risk_list: {
        ...initialData.cashflowActionCenter.project_risk_list,
        ...(dashboard?.cashflow_action_center?.project_risk_list || {}),
      },
      daily_action_queue: {
        ...initialData.cashflowActionCenter.daily_action_queue,
        ...(dashboard?.cashflow_action_center?.daily_action_queue || {}),
      },
    },
    managementDecisionDashboard: {
      ...initialData.managementDecisionDashboard,
      ...(dashboard?.management_decision_dashboard || {}),
    },
    financialDrilldowns: {
      customer: {
        ...initialData.financialDrilldowns.customer,
        ...(dashboard?.financial_drilldowns?.customer || {}),
      },
      project: {
        ...initialData.financialDrilldowns.project,
        ...(dashboard?.financial_drilldowns?.project || {}),
      },
      supplier: {
        ...initialData.financialDrilldowns.supplier,
        ...(dashboard?.financial_drilldowns?.supplier || {}),
      },
      personnel: {
        ...initialData.financialDrilldowns.personnel,
        ...(dashboard?.financial_drilldowns?.personnel || {}),
      },
    },
    expenseCategoryIntelligence: {
      ...initialData.expenseCategoryIntelligence,
      ...(dashboard?.expense_category_intelligence || {}),
      summary: {
        ...initialData.expenseCategoryIntelligence.summary,
        ...(dashboard?.expense_category_intelligence?.summary || {}),
      },
    },
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

function lastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return { key: toMonthKey(date), month: toMonthLabel(date) };
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

function FinancialCardGroup<T>({ title, emptyText, cards, renderCard }: {
  title: string;
  emptyText: string;
  cards: T[];
  renderCard: (card: T) => ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-4">
      <div className="mb-3 text-sm font-bold text-foreground">{title}</div>
      {cards.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="space-y-3">{cards.map(renderCard)}</div>
      )}
    </div>
  );
}

function UnifiedFinanceCard({ title, subtitle, metrics }: { title: string; subtitle: string; metrics: [string, string][] }) {
  return (
    <div className="rounded-md border border-border bg-background p-3 shadow-card-soft">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-md bg-muted/40 px-2 py-1.5">
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className="mt-0.5 whitespace-normal break-words text-xs font-bold tabular-nums">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommandCenterList<T extends { id: string; name: string }>({ title, items, getValue }: {
  title: string;
  items: T[];
  getValue: (item: T) => number;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-4 shadow-card-soft">
      <div className="mb-3 text-sm font-bold">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">Kayıt bulunmuyor.</div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
              <div className="min-w-0 truncate text-sm font-medium">{item.name}</div>
              <div className="shrink-0 text-sm font-bold tabular-nums">{formatDashboardTRY(getValue(item))}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DrilldownList({ title, rows }: { title: string; rows: AdminFinancialDrilldownRow[] }) {
  return (
    <div className="rounded-md border border-border bg-background p-4 shadow-card-soft">
      <div className="mb-3 text-sm font-bold">{title}</div>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">Kaynak satır bulunmuyor.</div>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 5).map((row) => (
            <div key={`${row.row_type}-${row.id}`} className="rounded-md bg-muted/40 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-sm font-semibold">{row.owner_name}</div>
                <div className="shrink-0 text-sm font-bold tabular-nums">{formatDashboardTRY(Number(row.amount || 0))}</div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{row.row_type}</span>
                {row.row_date ? <span>{formatDate(row.row_date)}</span> : null}
                <span className="min-w-0 truncate">{row.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionCenterList({ title, items, valueLabel = "Tutar" }: { title: string; items: AdminCashflowActionItem[]; valueLabel?: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-4 shadow-card-soft">
      <div className="mb-3 text-sm font-bold">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">Bugün aksiyon gerektiren kayıt yok.</div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map((item) => (
            <div key={`${title}-${item.id}`} className="rounded-md bg-muted/40 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-sm font-semibold">{item.name}</div>
                <div className="shrink-0 text-sm font-bold tabular-nums">{formatDashboardTRY(Number(item.amount || 0))}</div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{valueLabel}</span>
                {item.score ? <span>Risk: {item.score}/100</span> : null}
                {item.due_date ? <span>{formatDate(item.due_date)}</span> : null}
                <span className="min-w-0 truncate">{item.reason || item.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}
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
    const monthlyByKey = new Map(normalizedData.monthlyFinancials.map((item) => [item.month_key, item]));
    const monthlyFinancials = months.map((month) => {
      const item = monthlyByKey.get(month.key);
      const income = Number(item?.income || 0);
      const expenses = Number(item?.expenses || 0);
      const net = Number(item?.net ?? income - expenses);
      return { month: month.month, income, expenses, net };
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
      unifiedFinancialCards: normalizedData.unifiedFinancialCards,
      cashflowCommandCenter: normalizedData.cashflowCommandCenter,
      netCashForecast: normalizedData.netCashForecast,
      cashflowActionCenter: normalizedData.cashflowActionCenter,
      managementDecisionDashboard: normalizedData.managementDecisionDashboard,
      financialDrilldowns: normalizedData.financialDrilldowns,
      expenseCategoryIntelligence: normalizedData.expenseCategoryIntelligence,
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
  // client-side-only ordering hint — see AdminGelenler.tsx. "Planlanan" = expected/not-yet-due,
  // "Gecikmiş" = overdue and not yet collected.
  const todayISO = new Date().toISOString().slice(0, 10);
  const beklenenTahsilatHref = `/admin/gelenler?${new URLSearchParams({ status: "Planlanan", date_from: todayISO, sort: "date_asc" }).toString()}`;
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
            <AdminMetricCard to="/admin/gelenler" label="Toplam Tahsilat" value={formatDashboardTRY(dashboard.totalIncome)} description="Gerçekleşen gelen ödemeler" icon={Wallet} tone="success" />
            <AdminMetricCard to="/admin/gidenler" label="Toplam Gider" value={formatDashboardTRY(dashboard.totalExpenses)} description="Yapılan masraflar" icon={Receipt} tone="danger" />
            <AdminMetricCard label="Net Durum" value={formatDashboardTRY(dashboard.netStatus)} description="Gerçekleşen gelir eksi gider" icon={dashboard.netStatus >= 0 ? TrendingUp : TrendingDown} tone={dashboard.netStatus >= 0 ? "success" : "danger"} />
            <AdminMetricCard to={beklenenTahsilatHref} label="Beklenen Tahsilat" value={formatDashboardTRY(dashboard.expectedPayments)} description="Bugünden itibaren tüm planlanan müşteri alacakları" icon={CalendarClock} tone="warning" />
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

          <AdminSection title="Nakit Akışı Komuta Merkezi" description="Alacak, borç, risk ve maliyetleri tek yönetici görünümünde takip edin." contentClassName="space-y-5">
            <div className="grid w-full max-w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AdminMetricCard label="Güncel Alacak" value={formatDashboardTRY(Number(dashboard.cashflowCommandCenter.current_receivables || 0))} icon={Wallet} tone="success" />
              <AdminMetricCard label="Güncel Borç" value={formatDashboardTRY(Number(dashboard.cashflowCommandCenter.current_payables || 0))} icon={Receipt} tone="danger" />
              <AdminMetricCard label="Net Nakit Pozisyonu" value={formatDashboardTRY(Number(dashboard.cashflowCommandCenter.net_cash_position || 0))} icon={Number(dashboard.cashflowCommandCenter.net_cash_position || 0) >= 0 ? TrendingUp : TrendingDown} tone={Number(dashboard.cashflowCommandCenter.net_cash_position || 0) >= 0 ? "success" : "danger"} />
              <AdminMetricCard label="Personel Maliyeti" value={formatDashboardTRY(Number(dashboard.cashflowCommandCenter.personnel_cost_total || 0))} icon={Users} tone="accent" />
              <AdminMetricCard label="Vadesi Geçen Tahsilat" value={formatDashboardTRY(Number(dashboard.cashflowCommandCenter.overdue_collections || 0))} icon={CalendarClock} tone="danger" />
              <AdminMetricCard label="Yaklaşan Tahsilat" value={formatDashboardTRY(Number(dashboard.cashflowCommandCenter.upcoming_collections || 0))} icon={CalendarClock} tone="warning" />
              <AdminMetricCard label="Yaklaşan Ödeme" value={formatDashboardTRY(Number(dashboard.cashflowCommandCenter.upcoming_payments || 0))} icon={Receipt} tone="warning" />
            </div>
            <div className="grid w-full max-w-full grid-cols-1 gap-4 xl:grid-cols-3">
              <CommandCenterList
                title="En Riskli Müşteriler"
                items={dashboard.cashflowCommandCenter.most_risky_customers}
                getValue={(item) => Number(item.overdue_amount || item.remaining_receivable || 0)}
              />
              <CommandCenterList
                title="En Masraflı Projeler"
                items={dashboard.cashflowCommandCenter.most_expensive_projects}
                getValue={(item) => Number(item.total_expenses || 0)}
              />
              <CommandCenterList
                title="En Yüksek Tedarikçi Borcu"
                items={dashboard.cashflowCommandCenter.highest_supplier_debt}
                getValue={(item) => Number(item.remaining_payable || item.overdue_payable || 0)}
              />
            </div>
          </AdminSection>

          <AdminSection title="Net Nakit Tahmini" description="Doğrulanmış alacak ve borç kaynaklarından bugün, 7, 30 ve 60 günlük tahmini nakit pozisyonu." contentClassName="space-y-5">
            <div className="grid w-full max-w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AdminMetricCard label="Kullanılabilir Nakit" value={formatDashboardTRY(Number(dashboard.netCashForecast.available_cash || 0))} icon={Wallet} tone={Number(dashboard.netCashForecast.available_cash || 0) >= 0 ? "success" : "danger"} />
              <AdminMetricCard label="Vadesi Geçmiş Borç" value={formatDashboardTRY(Number(dashboard.netCashForecast.overdue_payables || 0))} icon={Receipt} tone="danger" />
              <AdminMetricCard label="Resmi Nakit" value={formatDashboardTRY(Number(dashboard.netCashForecast.official_cash_position || 0))} icon={ShieldCheck} tone="accent" />
              <AdminMetricCard label="Gayri Resmi Nakit" value={formatDashboardTRY(Number(dashboard.netCashForecast.unofficial_cash_position || 0))} icon={Wallet} tone="warning" />
            </div>
            <div className="grid w-full max-w-full grid-cols-1 gap-4 xl:grid-cols-4">
              {dashboard.netCashForecast.windows.map((window) => (
                <div key={window.window} className={cn("rounded-xl border bg-card p-4 shadow-sm", window.negative_forecast_cash ? "border-destructive/40 bg-destructive/5" : "border-border")}>
                  <div className="text-sm font-semibold text-foreground">{window.label}</div>
                  <div className={cn("mt-2 text-xl font-bold", Number(window.forecast_net_cash || 0) >= 0 ? "text-emerald-700" : "text-destructive")}>
                    {formatDashboardTRY(Number(window.forecast_net_cash || 0))}
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between gap-2"><span>Tahsilat</span><span>{formatDashboardTRY(Number(window.expected_collections || 0))}</span></div>
                    <div className="flex justify-between gap-2"><span>Ödeme</span><span>{formatDashboardTRY(Number(window.expected_payments || 0))}</span></div>
                    <div className="flex justify-between gap-2"><span>Riskli tahmin</span><span>{formatDashboardTRY(Number(window.risk_adjusted_forecast || 0))}</span></div>
                    <div className="flex justify-between gap-2"><span>Resmi tahsilat</span><span>{formatDashboardTRY(Number(window.official_expected_collections || 0))}</span></div>
                    <div className="flex justify-between gap-2"><span>Resmi ödeme</span><span>{formatDashboardTRY(Number(window.official_expected_payments || 0))}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </AdminSection>

          <AdminSection title="Nakit Akışı Aksiyon Merkezi" description="Bugün karar verilmesi gereken tahsilat, ödeme ve proje finans aksiyonları." contentClassName="space-y-5">
            <div className="grid w-full max-w-full grid-cols-1 gap-4 xl:grid-cols-3">
              <ActionCenterList title="Kritik Tahsilatlar" items={dashboard.cashflowActionCenter.critical_collections.highest_overdue_customers} valueLabel="Vadesi geçen" />
              <ActionCenterList title="Yüksek Müşteri Bakiyeleri" items={dashboard.cashflowActionCenter.critical_collections.highest_outstanding_balances} valueLabel="Kalan alacak" />
              <ActionCenterList title="Tahsilat Risk Skoru" items={dashboard.cashflowActionCenter.critical_collections.collection_risk_scores} valueLabel="Riskli alacak" />
              <ActionCenterList title="Yaklaşan Tedarikçi Ödemeleri" items={dashboard.cashflowActionCenter.critical_payments.upcoming_supplier_payments} valueLabel="Yaklaşan ödeme" />
              <ActionCenterList title="Yaklaşan Personel Ödemeleri" items={dashboard.cashflowActionCenter.critical_payments.upcoming_personnel_payments} valueLabel="Yaklaşan ödeme" />
              <ActionCenterList title="Vadesi Geçmiş Ödemeler" items={dashboard.cashflowActionCenter.critical_payments.overdue_payable_actions || []} valueLabel="Geciken ödeme" />
              <ActionCenterList title="Yüksek Borç Bakiyeleri" items={dashboard.cashflowActionCenter.critical_payments.highest_payable_balances} valueLabel="Kalan borç" />
              <ActionCenterList title="Düşük Kârlılık Projeleri" items={dashboard.cashflowActionCenter.project_risk_list.lowest_profitability_projects} valueLabel="Net durum" />
              <ActionCenterList title="En Giderli Projeler" items={dashboard.cashflowActionCenter.project_risk_list.highest_expense_projects} valueLabel="Gider etkisi" />
              <ActionCenterList title="Negatif Nakit Akışlı Projeler" items={dashboard.cashflowActionCenter.project_risk_list.negative_cashflow_projects} valueLabel="Nakit etkisi" />
            </div>
            <div className="grid w-full max-w-full grid-cols-1 gap-4 xl:grid-cols-3">
              <ActionCenterList title="Bugün Aranacak Müşteriler" items={dashboard.cashflowActionCenter.daily_action_queue.customers_to_contact_today} valueLabel="Takip tutarı" />
              <ActionCenterList title="Ödeme İncelemesi Gereken Tedarikçiler" items={dashboard.cashflowActionCenter.daily_action_queue.suppliers_requiring_payment_review} valueLabel="Kontrol tutarı" />
              <ActionCenterList title="Finans İncelemesi Gereken Projeler" items={dashboard.cashflowActionCenter.daily_action_queue.projects_requiring_financial_review} valueLabel="Kontrol tutarı" />
            </div>
          </AdminSection>

          <AdminSection title="Yönetim Karar Paneli" description="Doğrulanmış nakit akışı verilerinden yönetim karar listeleri." contentClassName="space-y-5">
            <div className="grid w-full max-w-full grid-cols-1 gap-4 xl:grid-cols-3">
              <ActionCenterList title="En Riskli Müşteriler" items={dashboard.managementDecisionDashboard.top_risky_customers} valueLabel="Riskli alacak" />
              <ActionCenterList title="En Gecikmiş Tahsilatlar" items={dashboard.managementDecisionDashboard.top_overdue_collections} valueLabel="Vadesi geçen" />
              <ActionCenterList title="Tahsilat Öncelik Kuyruğu" items={dashboard.managementDecisionDashboard.collection_priority_queue} valueLabel="Takip tutarı" />
              <ActionCenterList title="Tedarikçi Borçları" items={dashboard.managementDecisionDashboard.top_supplier_liabilities} valueLabel="Kalan borç" />
              <ActionCenterList title="Personel Maliyet Merkezleri" items={dashboard.managementDecisionDashboard.top_personnel_cost_centers} valueLabel="Toplam maliyet" />
              <ActionCenterList title="Ödeme Öncelik Kuyruğu" items={dashboard.managementDecisionDashboard.payment_priority_queue} valueLabel="Ödeme etkisi" />
              <ActionCenterList title="Kategori Aksiyonları" items={dashboard.managementDecisionDashboard.category_priority_queue || []} valueLabel="Kategori etkisi" />
              <ActionCenterList title="Resmi/Gayri Resmi Uyarılar" items={dashboard.managementDecisionDashboard.official_unofficial_actions || []} valueLabel="Nakit etkisi" />
              <ActionCenterList title="En Kârlı Projeler" items={dashboard.managementDecisionDashboard.top_profitable_projects} valueLabel="Net kâr" />
              <ActionCenterList title="Zarar Eden Projeler" items={dashboard.managementDecisionDashboard.top_loss_making_projects} valueLabel="Net zarar" />
              <ActionCenterList title="Nakit Açığı Uyarıları" items={dashboard.managementDecisionDashboard.cash_shortage_warnings} valueLabel="Risk tutarı" />
            </div>
          </AdminSection>

          <AdminSection title="Gider Kategori Zekası" description="Gerçekleşen gider, planlanan yükümlülük ve proje kârlılığı etkisini kategori bazında gösterir." contentClassName="space-y-5">
            <div className="grid w-full max-w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <AdminMetricCard label="Gerçekleşen Kategori Gideri" value={formatDashboardTRY(Number(dashboard.expenseCategoryIntelligence.summary.realized_cost_total || 0))} icon={Receipt} tone="danger" />
              <AdminMetricCard label="Planlanan Kategori Gideri" value={formatDashboardTRY(Number(dashboard.expenseCategoryIntelligence.summary.planned_cost_total || 0))} icon={CalendarClock} tone="warning" />
              <AdminMetricCard label="Nakit Baskısı" value={formatDashboardTRY(Number(dashboard.expenseCategoryIntelligence.summary.cash_pressure_total || 0))} icon={Wallet} tone="danger" />
              <AdminMetricCard label="Kârlılık Etkisi" value={formatDashboardTRY(Number(dashboard.expenseCategoryIntelligence.summary.profitability_impact_total || 0))} icon={TrendingDown} tone="warning" />
              <AdminMetricCard label="Kategorisiz Grup" value={String(dashboard.expenseCategoryIntelligence.summary.uncategorized_count || 0)} icon={Inbox} tone={dashboard.expenseCategoryIntelligence.summary.uncategorized_count > 0 ? "warning" : "success"} />
            </div>
            <div className="grid w-full max-w-full grid-cols-1 gap-4 xl:grid-cols-4">
              {dashboard.expenseCategoryIntelligence.top_spending_categories.slice(0, 8).map((category) => (
                <div key={category.category} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="text-sm font-semibold text-foreground">{category.category}</div>
                  <div className="mt-2 text-xl font-bold text-destructive">{formatDashboardTRY(Number(category.total_exposure || 0))}</div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between gap-2"><span>Gerçekleşen</span><span>{formatDashboardTRY(Number(category.realized_cost || 0))}</span></div>
                    <div className="flex justify-between gap-2"><span>Planlanan</span><span>{formatDashboardTRY(Number(category.planned_cost || 0))}</span></div>
                    <div className="flex justify-between gap-2"><span>Nakit baskısı</span><span>{formatDashboardTRY(Number(category.cash_pressure || 0))}</span></div>
                    <div className="flex justify-between gap-2"><span>Proje etkisi</span><span>{formatDashboardTRY(Number(category.profitability_impact || 0))}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </AdminSection>

          <AdminSection title="Finans Kaynak Satırları" description="Kart ve komuta merkezi rakamlarını oluşturan son kaynak kayıtları." contentClassName="space-y-5">
            <div className="grid w-full max-w-full grid-cols-1 gap-4 xl:grid-cols-3">
              <DrilldownList title="Müşteri Tahsilatları" rows={dashboard.financialDrilldowns.customer.collections} />
              <DrilldownList title="Bekleyen Müşteri Ödemeleri" rows={dashboard.financialDrilldowns.customer.pending_payments} />
              <DrilldownList title="Vadesi Geçen Müşteri Ödemeleri" rows={dashboard.financialDrilldowns.customer.overdue_payments} />
              <DrilldownList title="Proje Gelir Satırları" rows={dashboard.financialDrilldowns.project.revenue_rows} />
              <DrilldownList title="Proje Gider Satırları" rows={dashboard.financialDrilldowns.project.expense_rows} />
              <DrilldownList title="Proje Kâr Bileşenleri" rows={dashboard.financialDrilldowns.project.profit_components} />
              <DrilldownList title="Tedarikçi Alımları" rows={dashboard.financialDrilldowns.supplier.purchases} />
              <DrilldownList title="Tedarikçi Ödemeleri" rows={dashboard.financialDrilldowns.supplier.payments} />
              <DrilldownList title="Tedarikçi Kalan Borçları" rows={dashboard.financialDrilldowns.supplier.remaining_payable_rows} />
              <DrilldownList title="Personel Maaş Satırları" rows={dashboard.financialDrilldowns.personnel.salary} />
              <DrilldownList title="Personel Avansları" rows={dashboard.financialDrilldowns.personnel.advances} />
              <DrilldownList title="Personel Masraf İadeleri" rows={dashboard.financialDrilldowns.personnel.reimbursements} />
              <DrilldownList title="Personel Toplam Maliyet Satırları" rows={dashboard.financialDrilldowns.personnel.total_cost_rows} />
            </div>
          </AdminSection>

          <AdminSection title="Birleşik Finans Kartları" description="Müşteri, proje, tedarikçi ve personel bazında hızlı finans görünümü." contentClassName="space-y-5">
            <div className="grid w-full max-w-full grid-cols-1 gap-4 xl:grid-cols-2">
              <FinancialCardGroup
                title="Müşteri Kartları"
                emptyText="Müşteri finans kartı bulunmuyor."
                cards={dashboard.unifiedFinancialCards.customers}
                renderCard={(card) => (
                  <UnifiedFinanceCard
                    key={card.id}
                    title={card.name}
                    subtitle={card.payment_performance_summary}
                    metrics={[
                      ["Sözleşme", formatDashboardTRY(Number(card.total_contract_value || 0))],
                      ["Tahsilat", formatDashboardTRY(Number(card.total_collected || 0))],
                      ["Kalan", formatDashboardTRY(Number(card.remaining_receivable || 0))],
                      ["Vadesi Geçen", formatDashboardTRY(Number(card.overdue_amount || 0))],
                      ["Yaklaşan", formatDashboardTRY(Number(card.upcoming_amount || 0))],
                      ["Resmi Kalan", formatDashboardTRY(Number(card.official_remaining_receivable || 0))],
                      ["Gayri Resmi Kalan", formatDashboardTRY(Number(card.unofficial_remaining_receivable || 0))],
                    ]}
                  />
                )}
              />
              <FinancialCardGroup
                title="Proje Kartları"
                emptyText="Proje finans kartı bulunmuyor."
                cards={dashboard.unifiedFinancialCards.projects}
                renderCard={(card) => (
                  <UnifiedFinanceCard
                    key={card.id}
                    title={card.name}
                    subtitle={`Net kâr: ${formatDashboardTRY(Number(card.net_profit || 0))}`}
                    metrics={[
                      ["Gelir", formatDashboardTRY(Number(card.total_revenue || 0))],
                      ["Gider", formatDashboardTRY(Number(card.total_expenses || 0))],
                      ["Alacak", formatDashboardTRY(Number(card.outstanding_receivables || 0))],
                      ["Borç", formatDashboardTRY(Number(card.outstanding_payables || 0))],
                      ["Nakit", formatDashboardTRY(Number(card.current_cash_position || 0))],
                      ["Nakit Maruziyeti", formatDashboardTRY(Number(card.cash_exposure || 0))],
                      ["Resmi Kâr", formatDashboardTRY(Number(card.official_project_profit || 0))],
                      ["Gayri Resmi Kâr", formatDashboardTRY(Number(card.unofficial_project_profit || 0))],
                    ]}
                  />
                )}
              />
              <FinancialCardGroup
                title="Tedarikçi Kartları"
                emptyText="Tedarikçi finans kartı bulunmuyor."
                cards={dashboard.unifiedFinancialCards.suppliers}
                renderCard={(card) => (
                  <UnifiedFinanceCard
                    key={card.id}
                    title={card.name}
                    subtitle={card.last_payment_date ? `Son ödeme: ${formatDate(card.last_payment_date)}` : "Ödeme kaydı yok"}
                    metrics={[
                      ["Alım", formatDashboardTRY(Number(card.total_purchases || 0))],
                      ["Ödenen", formatDashboardTRY(Number(card.total_paid || 0))],
                      ["Kalan", formatDashboardTRY(Number(card.remaining_payable || 0))],
                      ["Vadesi Geçen", formatDashboardTRY(Number(card.overdue_payable || 0))],
                      ["Resmi Borç", formatDashboardTRY(Number(card.official_remaining_payable || 0))],
                      ["Gayri Resmi Borç", formatDashboardTRY(Number(card.unofficial_remaining_payable || 0))],
                    ]}
                  />
                )}
              />
              <FinancialCardGroup
                title="Personel Kartları"
                emptyText="Personel finans kartı bulunmuyor."
                cards={dashboard.unifiedFinancialCards.personnel}
                renderCard={(card) => (
                  <UnifiedFinanceCard
                    key={card.id}
                    title={card.name}
                    subtitle={`Toplam maliyet: ${formatDashboardTRY(Number(card.total_personnel_cost || 0))}`}
                    metrics={[
                      ["Maaş", formatDashboardTRY(Number(card.salary_paid || 0))],
                      ["Avans", formatDashboardTRY(Number(card.advances_paid || 0))],
                      ["Masraf İadesi", formatDashboardTRY(Number(card.expense_reimbursements || 0))],
                      ["Kalan Borç", formatDashboardTRY(Number(card.remaining_payable || 0))],
                      ["Vadesi Geçen", formatDashboardTRY(Number(card.overdue_payable || 0))],
                      ["Resmi Maliyet", formatDashboardTRY(Number(card.official_total_personnel_cost || 0))],
                      ["Gayri Resmi Maliyet", formatDashboardTRY(Number(card.unofficial_total_personnel_cost || 0))],
                    ]}
                  />
                )}
              />
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
                dashboard.recentMovements.map((movement) => {
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
                    <Tooltip formatter={(value: number) => formatDashboardTRY(value)} />
                    <Legend />
                    <Bar dataKey="income" name="Toplam Tahsilat" fill={chartColors.income} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Toplam Gider" fill={chartColors.expenses} radius={[4, 4, 0, 0]} />
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
