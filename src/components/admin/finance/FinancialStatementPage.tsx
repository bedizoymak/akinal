import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Edit, FileText, Plus, Search, Trash2 } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader, AdminSection } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  CARD_TYPES,
  CURRENCIES,
  ENTRY_DIRECTIONS,
  ENTRY_STATUSES,
  GROUP_TAGS,
  formatDate,
  formatMoney,
  type CardType,
  type CurrencyTag,
  type EntryDirection,
  type EntryStatus,
  type GroupTag,
} from "@/lib/finance";
import {
  chooseChartCurrency,
  formatCurrencyTotalLines,
  getCardTypeLabel,
  getCustomerName,
  getEntryCardName,
  getProjectName,
  isInCurrentMonth,
  positiveCurrencyDifference,
  signedEntryAmount,
  subtractCurrencyTotals,
  sumEntriesByCurrency,
  type CurrencyTotals,
  type FinanceLookups,
} from "@/lib/financialEntries";
import {
  financeSupabase,
  type CustomerLookup,
  type EmployeeRow,
  type ExpenseCardRow,
  type FinancialEntryInsert,
  type FinancialEntryRow,
  type FinancialEntryUpdate,
  type ProjectLookup,
} from "@/lib/financialTypes";
import { cn } from "@/lib/utils";

export type FinancialStatementKind = "project" | "customer" | "employee" | "expense";

type StatementEntity = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  backHref: string;
  backLabel: string;
  fixedLabel: string;
  emptyMessage: string;
  tableTitle: string;
  details: { label: string; value: string | null | undefined }[];
};

type EntryFormState = {
  id: string | null;
  project_id: string;
  entry_date: string;
  card_type: CardType;
  customer_id: string;
  employee_id: string;
  expense_card_id: string;
  title: string;
  description: string;
  amount: string;
  currency_tag: CurrencyTag;
  group_tag: GroupTag;
  direction: EntryDirection;
  status: EntryStatus;
  document_url: string;
};

type ChartDatum = {
  name: string;
  value: number;
  color: string;
};

type DistributionDatum = ChartDatum & {
  id: string;
};

const chartColors = {
  income: "hsl(145, 55%, 25%)",
  expense: "hsl(0, 72%, 51%)",
  planned: "hsl(38, 92%, 50%)",
  neutral: "hsl(220, 9%, 48%)",
  muted: "hsl(220, 9%, 68%)",
};

const distributionColors = [
  "hsl(145, 55%, 25%)",
  "hsl(142, 48%, 42%)",
  "hsl(220, 9%, 42%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(200, 65%, 42%)",
];

const today = new Date().toISOString().slice(0, 10);

function defaultCardType(kind: FinancialStatementKind): CardType {
  if (kind === "employee") return "employee";
  if (kind === "expense") return "expense";
  return "customer";
}

function defaultDirection(cardType: CardType): EntryDirection {
  return cardType === "customer" ? "Gelir" : "Gider";
}

function getFixedFilter(kind: FinancialStatementKind): "project_id" | "customer_id" | "employee_id" | "expense_card_id" {
  if (kind === "project") return "project_id";
  if (kind === "customer") return "customer_id";
  if (kind === "employee") return "employee_id";
  return "expense_card_id";
}

function makeEntity(kind: FinancialStatementKind, row: ProjectLookup | CustomerLookup | EmployeeRow | ExpenseCardRow): StatementEntity {
  if (kind === "project") {
    const project = row as ProjectLookup;
    return {
      id: project.id,
      title: project.title,
      eyebrow: "Proje Ekstresi",
      description: "Bu ekran yeni proje ekstresi sistemini kullanır.",
      backHref: "/admin/projeler",
      backLabel: "Projelere Dön",
      fixedLabel: "Proje",
      emptyMessage: "Bu proje için finansal hareket bulunmuyor.",
      tableTitle: "Proje Ekstresi",
      details: [
        { label: "Konum", value: project.location },
        { label: "Durum", value: project.project_status },
      ],
    };
  }

  if (kind === "customer") {
    const customer = row as CustomerLookup;
    return {
      id: customer.id,
      title: getCustomerName(customer),
      eyebrow: "Müşteri Ekstresi",
      description: "Müşterinin tüm projelerdeki planlanan ve gerçekleşen hareketlerini izleyin.",
      backHref: "/admin/musteriler",
      backLabel: "Müşterilere Dön",
      fixedLabel: "Müşteri",
      emptyMessage: "Bu müşteri için finansal hareket bulunmuyor.",
      tableTitle: "Müşteri Ekstresi",
      details: [
        { label: "Yetkili / Kişi", value: customer.full_name },
        { label: "Telefon", value: customer.phone },
        { label: "E-posta", value: customer.email },
        { label: "Vergi / T.C. No", value: customer.tax_or_identity_number },
      ],
    };
  }

  if (kind === "employee") {
    const employee = row as EmployeeRow;
    return {
      id: employee.id,
      title: employee.full_name,
      eyebrow: "Personel Ekstresi",
      description: "Personel, usta, taşeron veya çalışan bazlı ödeme hareketlerini izleyin.",
      backHref: "/admin/personeller",
      backLabel: "Personellere Dön",
      fixedLabel: "Personel",
      emptyMessage: "Bu personel için finansal hareket bulunmuyor.",
      tableTitle: "Personel Ekstresi",
      details: [
        { label: "Görev", value: employee.role },
        { label: "Telefon", value: employee.phone },
        { label: "Durum", value: employee.status },
        { label: "Notlar", value: employee.notes },
      ],
    };
  }

  const card = row as ExpenseCardRow;
  return {
    id: card.id,
    title: card.name,
    eyebrow: "Gider Kartı Ekstresi",
    description: "Sabit gider kartının tüm projelerdeki maliyet hareketlerini izleyin.",
    backHref: "/admin/gider-kartlari",
    backLabel: "Gider Kartlarına Dön",
    fixedLabel: "Gider Kartı",
    emptyMessage: "Bu gider kartı için finansal hareket bulunmuyor.",
    tableTitle: "Gider Kartı Ekstresi",
    details: [
      { label: "Kategori", value: card.category },
      { label: "Durum", value: card.status },
      { label: "Açıklama", value: card.description },
    ],
  };
}

function emptyForm(kind: FinancialStatementKind, entityId: string): EntryFormState {
  const cardType = defaultCardType(kind);
  return {
    id: null,
    project_id: kind === "project" ? entityId : "",
    entry_date: today,
    card_type: cardType,
    customer_id: kind === "customer" ? entityId : "",
    employee_id: kind === "employee" ? entityId : "",
    expense_card_id: kind === "expense" ? entityId : "",
    title: "",
    description: "",
    amount: "",
    currency_tag: "TRY",
    group_tag: "Resmi",
    direction: defaultDirection(cardType),
    status: "Gerçekleşti",
    document_url: "",
  };
}

function formFromEntry(entry: FinancialEntryRow): EntryFormState {
  return {
    id: entry.id,
    project_id: entry.project_id,
    entry_date: entry.entry_date,
    card_type: entry.card_type,
    customer_id: entry.customer_id ?? "",
    employee_id: entry.employee_id ?? "",
    expense_card_id: entry.expense_card_id ?? "",
    title: entry.title,
    description: entry.description ?? "",
    amount: String(entry.amount),
    currency_tag: entry.currency_tag,
    group_tag: entry.group_tag,
    direction: entry.direction,
    status: entry.status,
    document_url: entry.document_url ?? "",
  };
}

function MoneyLines({ totals, tone }: { totals: CurrencyTotals; tone?: "success" | "danger" | "warning" }) {
  const lines = formatCurrencyTotalLines(totals);
  const color = tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-700" : "text-foreground";

  if (!lines.length) return <span className="text-foreground">{formatMoney(0, "TRY")}</span>;

  return (
    <div className={cn("space-y-1 text-base leading-tight", color)}>
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}

function ChartCard({ title, data, currency }: { title: string; data: ChartDatum[]; currency: CurrencyTag }) {
  const visibleData = data.filter((item) => item.value > 0);

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card-soft">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold tracking-normal">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Para birimi: {currency}</p>
        </div>
      </div>
      {visibleData.length ? (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={visibleData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={92} paddingAngle={2}>
              {visibleData.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value: unknown) => formatMoney(Number(value), currency)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[260px] items-center justify-center rounded-md bg-surface-light text-center text-sm text-muted-foreground">
          Grafik için veri bulunmuyor.
        </div>
      )}
    </div>
  );
}

function DetailList({ details }: { details: StatementEntity["details"] }) {
  const visible = details.filter((detail) => detail.value);
  if (!visible.length) return null;

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
      {visible.map((detail) => (
        <div key={detail.label}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{detail.label}</div>
          <div className="mt-1 font-medium text-foreground">{detail.value}</div>
        </div>
      ))}
    </div>
  );
}

function toLookupMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function getSummary(entries: FinancialEntryRow[]) {
  const realizedIncome = sumEntriesByCurrency(entries.filter((entry) => entry.status === "Gerçekleşti" && entry.direction === "Gelir"));
  const realizedExpense = sumEntriesByCurrency(entries.filter((entry) => entry.status === "Gerçekleşti" && entry.direction === "Gider"));
  const plannedIncome = sumEntriesByCurrency(entries.filter((entry) => entry.status === "Planlandı" && entry.direction === "Gelir"));
  const plannedExpense = sumEntriesByCurrency(entries.filter((entry) => entry.status === "Planlandı" && entry.direction === "Gider"));
  const officialBalance = sumEntriesByCurrency(entries.filter((entry) => entry.status !== "İptal" && entry.group_tag === "Resmi"), true);
  const unofficialBalance = sumEntriesByCurrency(entries.filter((entry) => entry.status !== "İptal" && entry.group_tag === "Gayri Resmi"), true);
  const realizedNet = subtractCurrencyTotals(realizedIncome, realizedExpense);
  const realizedSigned = sumEntriesByCurrency(entries.filter((entry) => entry.status === "Gerçekleşti"), true);
  const plannedSigned = sumEntriesByCurrency(entries.filter((entry) => entry.status === "Planlandı"), true);

  return {
    realizedIncome,
    realizedExpense,
    plannedIncome,
    plannedExpense,
    officialBalance,
    unofficialBalance,
    realizedNet,
    realizedSigned,
    plannedSigned,
    remainingIncome: positiveCurrencyDifference(plannedIncome, realizedIncome),
    remainingExpense: positiveCurrencyDifference(plannedExpense, realizedExpense),
  };
}

function getProjectChartData(entries: FinancialEntryRow[], currency: CurrencyTag): ChartDatum[] {
  const scoped = entries.filter((entry) => entry.currency_tag === currency && entry.status === "Gerçekleşti");
  const income = scoped.filter((entry) => entry.direction === "Gelir").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const expense = scoped.filter((entry) => entry.direction === "Gider").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const net = income - expense;

  return [
    { name: "Gelir", value: income, color: chartColors.income },
    { name: "Gider", value: expense, color: chartColors.expense },
    { name: "Net", value: Math.abs(net), color: net >= 0 ? chartColors.income : chartColors.expense },
  ];
}

function getCardChartData(kind: FinancialStatementKind, entries: FinancialEntryRow[], currency: CurrencyTag): ChartDatum[] {
  const scoped = entries.filter((entry) => entry.currency_tag === currency);
  const canceled = scoped.filter((entry) => entry.status === "İptal").reduce((sum, entry) => sum + Number(entry.amount), 0);

  if (kind === "customer") {
    const realizedPayment = scoped.filter((entry) => entry.status === "Gerçekleşti" && entry.direction === "Gelir").reduce((sum, entry) => sum + Number(entry.amount), 0);
    const plannedPayment = scoped.filter((entry) => entry.status === "Planlandı" && entry.direction === "Gelir").reduce((sum, entry) => sum + Number(entry.amount), 0);
    const refund = scoped.filter((entry) => entry.status === "Gerçekleşti" && entry.direction === "Gider").reduce((sum, entry) => sum + Number(entry.amount), 0);
    return [
      { name: "Gerçekleşen Ödeme", value: realizedPayment, color: chartColors.income },
      { name: "Planlanan Ödeme", value: plannedPayment, color: chartColors.planned },
      { name: "Gider / İade", value: refund, color: chartColors.expense },
    ];
  }

  const realizedExpense = scoped.filter((entry) => entry.status === "Gerçekleşti" && entry.direction === "Gider").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const plannedExpense = scoped.filter((entry) => entry.status === "Planlandı" && entry.direction === "Gider").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const realizedLabel = kind === "employee" ? "Gerçekleşen Ödeme" : "Gerçekleşen Gider";
  const plannedLabel = kind === "employee" ? "Planlanan Ödeme" : "Planlanan Gider";

  return [
    { name: realizedLabel, value: realizedExpense, color: chartColors.expense },
    { name: plannedLabel, value: plannedExpense, color: chartColors.planned },
    { name: "İptal Edilen", value: canceled, color: chartColors.muted },
  ];
}

function getDistributionData(entries: FinancialEntryRow[], currency: CurrencyTag, lookups: FinanceLookups): DistributionDatum[] {
  const totals = entries
    .filter((entry) => entry.currency_tag === currency && entry.status !== "İptal")
    .reduce<Map<string, number>>((map, entry) => {
      const current = map.get(entry.project_id) ?? 0;
      map.set(entry.project_id, current + Math.abs(signedEntryAmount(entry)));
      return map;
    }, new Map());

  return Array.from(totals.entries())
    .filter(([, value]) => value > 0)
    .map(([projectId, value], index) => ({
      id: projectId,
      name: getProjectName(projectId, lookups),
      value,
      color: distributionColors[index % distributionColors.length],
    }));
}

function buildPayload(form: EntryFormState): FinancialEntryInsert {
  return {
    project_id: form.project_id,
    entry_date: form.entry_date,
    card_type: form.card_type,
    customer_id: form.card_type === "customer" ? form.customer_id : null,
    employee_id: form.card_type === "employee" ? form.employee_id : null,
    expense_card_id: form.card_type === "expense" ? form.expense_card_id : null,
    title: form.title.trim(),
    description: form.description.trim() || null,
    amount: Number(form.amount),
    currency_tag: form.currency_tag,
    group_tag: form.group_tag,
    direction: form.direction,
    status: form.status,
    document_url: form.document_url.trim() || null,
  };
}

function validateForm(form: EntryFormState): string | null {
  if (!form.project_id) return "Proje seçimi zorunludur.";
  if (!form.entry_date) return "Tarih zorunludur.";
  if (!form.card_type) return "Hareket türü zorunludur.";
  if (!form.title.trim()) return "Başlık zorunludur.";
  if (!Number(form.amount) || Number(form.amount) <= 0) return "Tutar 0'dan büyük olmalıdır.";
  if (!form.currency_tag) return "Para birimi zorunludur.";
  if (!form.group_tag) return "Kayıt grubu zorunludur.";
  if (!form.direction) return "Hareket tipi zorunludur.";
  if (!form.status) return "Durum zorunludur.";
  if (form.card_type === "customer" && !form.customer_id) return "Müşteri seçimi zorunludur.";
  if (form.card_type === "employee" && !form.employee_id) return "Personel seçimi zorunludur.";
  if (form.card_type === "expense" && !form.expense_card_id) return "Gider kartı seçimi zorunludur.";
  return null;
}

function SummaryCards({ kind, summary }: { kind: FinancialStatementKind; summary: ReturnType<typeof getSummary> }) {
  if (kind === "project") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label="Toplam Gelir" value={<MoneyLines totals={summary.realizedIncome} tone="success" />} description="Gerçekleşen gelir" />
        <AdminMetricCard label="Toplam Gider" value={<MoneyLines totals={summary.realizedExpense} tone="danger" />} description="Gerçekleşen gider" />
        <AdminMetricCard label="Net Durum" value={<MoneyLines totals={summary.realizedNet} />} description="Gelir eksi gider" />
        <AdminMetricCard label="Planlanan Gelir" value={<MoneyLines totals={summary.plannedIncome} tone="warning" />} description="Beklenen gelir" />
        <AdminMetricCard label="Planlanan Gider" value={<MoneyLines totals={summary.plannedExpense} tone="warning" />} description="Beklenen gider" />
        <AdminMetricCard label="Resmi Bakiye" value={<MoneyLines totals={summary.officialBalance} />} description="Resmi hareketler" />
        <AdminMetricCard label="Gayri Resmi Bakiye" value={<MoneyLines totals={summary.unofficialBalance} />} description="Gayri resmi hareketler" />
        {CURRENCIES.map((currency) => (
          <AdminMetricCard key={currency} label={`${currency} Toplamı`} value={formatMoney(summary.realizedNet[currency], currency)} description="Gerçekleşen net bakiye" />
        ))}
      </div>
    );
  }

  const isCustomer = kind === "customer";
  const isEmployee = kind === "employee";

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AdminMetricCard
        label={isCustomer ? "Toplam Gerçekleşen Ödeme" : isEmployee ? "Toplam Gerçekleşen Ödeme" : "Toplam Gerçekleşen Gider"}
        value={<MoneyLines totals={isCustomer ? summary.realizedIncome : summary.realizedExpense} tone={isCustomer ? "success" : "danger"} />}
        description="Gerçekleşen hareketler"
      />
      <AdminMetricCard
        label={isCustomer ? "Toplam Planlanan Ödeme" : isEmployee ? "Toplam Planlanan Ödeme" : "Toplam Planlanan Gider"}
        value={<MoneyLines totals={isCustomer ? summary.plannedIncome : summary.plannedExpense} tone="warning" />}
        description="Planlanan hareketler"
      />
      <AdminMetricCard
        label={isCustomer ? "Kalan Alacak" : isEmployee ? "Kalan Ödeme" : "Kalan Planlı Gider"}
        value={<MoneyLines totals={isCustomer ? summary.remainingIncome : summary.remainingExpense} />}
        description="Planlanan eksi gerçekleşen"
      />
      <AdminMetricCard label="Toplam Resmi Tutar" value={<MoneyLines totals={summary.officialBalance} />} description="Resmi kayıt bakiyesi" />
      <AdminMetricCard label="Toplam Gayri Resmi Tutar" value={<MoneyLines totals={summary.unofficialBalance} />} description="Gayri resmi kayıt bakiyesi" />
      {CURRENCIES.map((currency) => (
        <AdminMetricCard key={currency} label={`${currency} Toplamı`} value={formatMoney(summary.realizedSigned[currency] + summary.plannedSigned[currency], currency)} description="İptal hariç hareket bakiyesi" />
      ))}
    </div>
  );
}

type FinancialStatementPageProps = {
  kind: FinancialStatementKind;
  entityId: string;
};

export default function FinancialStatementPage({ kind, entityId }: FinancialStatementPageProps) {
  const { toast } = useToast();
  const [entity, setEntity] = useState<StatementEntity | null>(null);
  const [entries, setEntries] = useState<FinancialEntryRow[]>([]);
  const [projects, setProjects] = useState<ProjectLookup[]>([]);
  const [customers, setCustomers] = useState<CustomerLookup[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [expenseCards, setExpenseCards] = useState<ExpenseCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<EntryFormState>(() => emptyForm(kind, entityId));
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [cardTypeFilter, setCardTypeFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");

  const lookups = useMemo<FinanceLookups>(() => ({
    projects: toLookupMap(projects),
    customers: toLookupMap(customers),
    employees: toLookupMap(employees),
    expenseCards: toLookupMap(expenseCards),
  }), [projects, customers, employees, expenseCards]);

  const loadEntity = useCallback(async () => {
    if (kind === "project") {
      const { data, error: queryError } = await financeSupabase.from("projects").select("id,title,location,project_status").eq("id", entityId).maybeSingle();
      if (queryError) throw queryError;
      return data ? makeEntity(kind, data as ProjectLookup) : null;
    }
    if (kind === "customer") {
      const { data, error: queryError } = await financeSupabase.from("customers").select("id,customer_type,full_name,company_name,phone,email,tax_or_identity_number,status").eq("id", entityId).maybeSingle();
      if (queryError) throw queryError;
      return data ? makeEntity(kind, data as CustomerLookup) : null;
    }
    if (kind === "employee") {
      const { data, error: queryError } = await financeSupabase.from("employees").select("*").eq("id", entityId).maybeSingle();
      if (queryError) throw queryError;
      return data ? makeEntity(kind, data) : null;
    }
    const { data, error: queryError } = await financeSupabase.from("expense_cards").select("*").eq("id", entityId).maybeSingle();
    if (queryError) throw queryError;
    return data ? makeEntity(kind, data) : null;
  }, [entityId, kind]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const fixedFilter = getFixedFilter(kind);
      const [entityResult, entriesResult, projectsResult, customersResult, employeesResult, expenseCardsResult] = await Promise.all([
        loadEntity(),
        financeSupabase.from("financial_entries").select("*").eq(fixedFilter, entityId).order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
        financeSupabase.from("projects").select("id,title,location,project_status").order("sort_order", { ascending: true }),
        financeSupabase.from("customers").select("id,customer_type,full_name,company_name,phone,email,tax_or_identity_number,status").order("created_at", { ascending: false }),
        financeSupabase.from("employees").select("*").order("full_name", { ascending: true }),
        financeSupabase.from("expense_cards").select("*").order("name", { ascending: true }),
      ]);

      if (entriesResult.error) throw entriesResult.error;
      if (projectsResult.error) throw projectsResult.error;
      if (customersResult.error) throw customersResult.error;
      if (employeesResult.error) throw employeesResult.error;
      if (expenseCardsResult.error) throw expenseCardsResult.error;

      setEntity(entityResult);
      setEntries(entriesResult.data ?? []);
      setProjects((projectsResult.data ?? []) as ProjectLookup[]);
      setCustomers((customersResult.data ?? []) as CustomerLookup[]);
      setEmployees(employeesResult.data ?? []);
      setExpenseCards(expenseCardsResult.data ?? []);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Veriler yüklenirken bir hata oluştu.";
      setError(message);
      toast({ title: "Bir hata oluştu.", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [entityId, kind, loadEntity, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => getSummary(entries), [entries]);
  const chartCurrency = useMemo(() => chooseChartCurrency(entries), [entries]);

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    if (fromDate && entry.entry_date < fromDate) return false;
    if (toDate && entry.entry_date > toDate) return false;
    if (kind !== "project" && projectFilter !== "all" && entry.project_id !== projectFilter) return false;
    if (kind === "project" && cardTypeFilter !== "all" && entry.card_type !== cardTypeFilter) return false;
    if (groupFilter !== "all" && entry.group_tag !== groupFilter) return false;
    if (directionFilter !== "all" && entry.direction !== directionFilter) return false;
    if (statusFilter !== "all" && entry.status !== statusFilter) return false;
    if (currencyFilter !== "all" && entry.currency_tag !== currencyFilter) return false;
    if (search) {
      const haystack = [
        entry.title,
        entry.description ?? "",
        getEntryCardName(entry, lookups),
        getProjectName(entry.project_id, lookups),
      ].join(" ").toLocaleLowerCase("tr-TR");
      if (!haystack.includes(search.toLocaleLowerCase("tr-TR"))) return false;
    }
    return true;
  }), [cardTypeFilter, currencyFilter, directionFilter, entries, fromDate, groupFilter, kind, lookups, projectFilter, search, statusFilter, toDate]);

  const currentMonthEntries = useMemo(() => entries.filter((entry) => isInCurrentMonth(entry.entry_date)), [entries]);
  const projectCurrentChart = useMemo(() => getProjectChartData(currentMonthEntries, chartCurrency), [chartCurrency, currentMonthEntries]);
  const projectAllChart = useMemo(() => getProjectChartData(entries, chartCurrency), [chartCurrency, entries]);
  const cardCurrentChart = useMemo(() => getCardChartData(kind, currentMonthEntries, chartCurrency), [chartCurrency, currentMonthEntries, kind]);
  const cardAllChart = useMemo(() => getCardChartData(kind, entries, chartCurrency), [chartCurrency, entries, kind]);
  const distributionChart = useMemo(() => getDistributionData(entries, chartCurrency, lookups), [chartCurrency, entries, lookups]);

  function openCreate() {
    setForm(emptyForm(kind, entityId));
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(entry: FinancialEntryRow) {
    setForm(formFromEntry(entry));
    setFormError("");
    setDialogOpen(true);
  }

  function updateForm<K extends keyof EntryFormState>(key: K, value: EntryFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleCardTypeChange(value: string) {
    const next = value as CardType;
    setForm((current) => ({
      ...current,
      card_type: next,
      customer_id: next === "customer" ? current.customer_id : "",
      employee_id: next === "employee" ? current.employee_id : "",
      expense_card_id: next === "expense" ? current.expense_card_id : "",
      direction: defaultDirection(next),
    }));
  }

  async function saveEntry() {
    const validationMessage = validateForm(form);
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = buildPayload(form);
      if (form.id) {
        const updatePayload: FinancialEntryUpdate = payload;
        const { error: updateError } = await financeSupabase.from("financial_entries").update(updatePayload).eq("id", form.id);
        if (updateError) throw updateError;
        toast({ title: "Finansal hareket güncellendi." });
      } else {
        const { error: insertError } = await financeSupabase.from("financial_entries").insert(payload);
        if (insertError) throw insertError;
        toast({ title: "Finansal hareket oluşturuldu." });
      }
      setDialogOpen(false);
      await load();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Bir hata oluştu.";
      toast({ title: "Bir hata oluştu.", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entry: FinancialEntryRow) {
    if (!confirm(`"${entry.title}" hareketini silmek istediğinize emin misiniz?`)) return;

    const { error: deleteError } = await financeSupabase.from("financial_entries").delete().eq("id", entry.id);
    if (deleteError) {
      toast({ title: "Bir hata oluştu.", description: deleteError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Finansal hareket silindi." });
    await load();
  }

  const dialogTitle = form.id ? "Hareketi Düzenle" : "Yeni Hareket Ekle";

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</div>;
  }

  if (error) {
    return <AdminEmptyState title="Veriler yüklenemedi" description={error} icon={FileText} />;
  }

  if (!entity) {
    return <AdminEmptyState title="Kayıt bulunamadı" description="Seçilen kayıt bulunamadı veya erişim yetkiniz yok." icon={FileText} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={entity.eyebrow}
        title={entity.title}
        description={entity.description}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={entity.backHref}>
                <ArrowLeft className="h-4 w-4" />
                {entity.backLabel}
              </Link>
            </Button>
            <Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              <Plus className="h-4 w-4" />
              Yeni Hareket Ekle
            </Button>
          </>
        }
      />

      <DetailList details={entity.details} />
      <SummaryCards kind={kind} summary={summary} />

      {entries.length === 0 ? (
        <AdminEmptyState title={entity.emptyMessage} description="Yeni finansal hareket ekleyerek ekstreyi oluşturmaya başlayabilirsiniz." icon={FileText} action={<Button onClick={openCreate}>Yeni Hareket Ekle</Button>} />
      ) : (
        <>
          <div className={cn("grid gap-4", kind === "project" ? "lg:grid-cols-2" : "xl:grid-cols-3")}>
            {kind === "project" ? (
              <>
                <ChartCard title="Bu Ay Kârlılık" data={projectCurrentChart} currency={chartCurrency} />
                <ChartCard title="Tüm Proje Kârlılık" data={projectAllChart} currency={chartCurrency} />
              </>
            ) : (
              <>
                <ChartCard title={kind === "customer" ? "Bu Ay Müşteri Özeti" : kind === "employee" ? "Bu Ay Personel Özeti" : "Bu Ay Gider Kartı Özeti"} data={cardCurrentChart} currency={chartCurrency} />
                <ChartCard title={kind === "customer" ? "Tüm Zaman Müşteri Özeti" : kind === "employee" ? "Tüm Zaman Personel Özeti" : "Tüm Zaman Gider Kartı Özeti"} data={cardAllChart} currency={chartCurrency} />
                <ChartCard title="Projelere Göre Dağılım" data={distributionChart} currency={chartCurrency} />
              </>
            )}
          </div>

          <AdminSection
            title={entity.tableTitle}
            description="Finansal hareketleri tarih, kart, kayıt grubu, hareket tipi, durum ve para birimine göre filtreleyin."
            actions={<Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent-glow"><Plus className="h-4 w-4" /> Yeni Hareket Ekle</Button>}
          >
            <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Arama" className="pl-9" />
              </div>
              {kind !== "project" ? (
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger><SelectValue placeholder="Proje" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Projeler</SelectItem>
                    {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={cardTypeFilter} onValueChange={setCardTypeFilter}>
                <SelectTrigger><SelectValue placeholder="Hareket Türü" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Hareket Türleri</SelectItem>
                    {CARD_TYPES.map((type) => <SelectItem key={type} value={type}>{getCardTypeLabel(type)}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Başlangıç Tarihi" />
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Bitiş Tarihi" />
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger><SelectValue placeholder="Kayıt Grubu" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tüm Kayıt Grupları</SelectItem>{GROUP_TAGS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger><SelectValue placeholder="Hareket Tipi" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tüm Hareket Tipleri</SelectItem>{ENTRY_DIRECTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tüm Durumlar</SelectItem>{ENTRY_STATUSES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                <SelectTrigger><SelectValue placeholder="Para Birimi" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tüm Para Birimleri</SelectItem>{CURRENCIES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Tarih</th>
                    {kind === "project" ? (
                      <>
                        <th className="p-3">Hareket Türü</th>
                        <th className="p-3">Kart Adı</th>
                      </>
                    ) : (
                      <th className="p-3">Proje</th>
                    )}
                    <th className="p-3">Başlık</th>
                    <th className="p-3">Kayıt Grubu</th>
                    <th className="p-3">Hareket Tipi</th>
                    <th className="p-3">Durum</th>
                    <th className="p-3 text-right">Tutar</th>
                    <th className="p-3">Para Birimi</th>
                    <th className="p-3">Belge</th>
                    <th className="p-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap">{formatDate(entry.entry_date)}</td>
                      {kind === "project" ? (
                        <>
                          <td className="p-3">{getCardTypeLabel(entry.card_type)}</td>
                          <td className="p-3">{getEntryCardName(entry, lookups)}</td>
                        </>
                      ) : (
                        <td className="p-3">{getProjectName(entry.project_id, lookups)}</td>
                      )}
                      <td className="p-3">
                        <div className="font-medium">{entry.title}</div>
                        {entry.description && <div className="mt-1 max-w-xs truncate text-xs text-muted-foreground">{entry.description}</div>}
                      </td>
                      <td className="p-3">{entry.group_tag}</td>
                      <td className={cn("p-3 font-medium", entry.direction === "Gelir" ? "text-emerald-700" : "text-red-600")}>{entry.direction}</td>
                      <td className="p-3">{entry.status}</td>
                      <td className="p-3 text-right font-semibold">{formatMoney(entry.amount, entry.currency_tag)}</td>
                      <td className="p-3">{entry.currency_tag}</td>
                      <td className="p-3">
                        {entry.document_url ? (
                          <Button asChild size="sm" variant="ghost">
                            <a href={entry.document_url} target="_blank" rel="noreferrer">Aç</a>
                          </Button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(entry)} title="Düzenle"><Edit className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteEntry(entry)} title="Sil"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredEntries.length === 0 && (
                    <tr><td colSpan={kind === "project" ? 11 : 10} className="p-8 text-center text-muted-foreground">Filtrelere uygun finansal hareket bulunmuyor.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminSection>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          {formError && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>}

          <div className="grid gap-4 md:grid-cols-2">
            {kind === "project" ? (
              <>
                <div>
                  <Label>Proje *</Label>
                  <Input value={entity.title} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Hareket Türü *</Label>
                  <Select value={form.card_type} onValueChange={handleCardTypeChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CARD_TYPES.map((type) => <SelectItem key={type} value={type}>{getCardTypeLabel(type)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>{entity.fixedLabel} *</Label>
                  <Input value={entity.title} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Proje *</Label>
                  <Select value={form.project_id || "none"} onValueChange={(value) => updateForm("project_id", value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Proje seçin</SelectItem>
                      {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {form.card_type === "customer" && kind === "project" && (
              <div className="md:col-span-2">
                <Label>Müşteri *</Label>
                <Select value={form.customer_id || "none"} onValueChange={(value) => updateForm("customer_id", value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Müşteri seçin</SelectItem>
                    {customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{getCustomerName(customer)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.card_type === "employee" && kind === "project" && (
              <div className="md:col-span-2">
                <Label>Personel *</Label>
                <Select value={form.employee_id || "none"} onValueChange={(value) => updateForm("employee_id", value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Personel seçin</SelectItem>
                    {employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.card_type === "expense" && kind === "project" && (
              <div className="md:col-span-2">
                <Label>Gider Kartı *</Label>
                <Select value={form.expense_card_id || "none"} onValueChange={(value) => updateForm("expense_card_id", value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Gider kartı seçin</SelectItem>
                    {expenseCards.map((card) => <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Tarih *</Label>
              <Input type="date" value={form.entry_date} onChange={(event) => updateForm("entry_date", event.target.value)} />
            </div>
            <div>
              <Label>Başlık *</Label>
              <Input value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
            </div>
            <div>
              <Label>Tutar *</Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} />
            </div>
            <div>
              <Label>Para Birimi *</Label>
              <Select value={form.currency_tag} onValueChange={(value) => updateForm("currency_tag", value as CurrencyTag)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kayıt Grubu *</Label>
              <Select value={form.group_tag} onValueChange={(value) => updateForm("group_tag", value as GroupTag)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GROUP_TAGS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hareket Tipi *</Label>
              <Select value={form.direction} onValueChange={(value) => updateForm("direction", value as EntryDirection)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ENTRY_DIRECTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Durum *</Label>
              <Select value={form.status} onValueChange={(value) => updateForm("status", value as EntryStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ENTRY_STATUSES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Belge URL</Label>
              <Input value={form.document_url} onChange={(event) => updateForm("document_url", event.target.value)} placeholder="https://..." />
            </div>
            <div className="md:col-span-2">
              <Label>Açıklama</Label>
              <Textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Vazgeç</Button>
            <Button onClick={saveEntry} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
