import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, CalendarDays } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getAdminEmployees, getEmployeeFinancialEntries, createEmployeeFinancialEntry, updateEmployeeFinancialEntry, deleteEmployeeFinancialEntry, getAdminProjects } from "@/lib/apiClient";
import type { AdminEmployee } from "@/lib/apiTypes";
import { CardStatementTable } from "@/components/admin/finance/CardStatementTable";
import type { CardEntryFormValues } from "@/components/admin/finance/CardEntryForm";
import { EmployeeRolesPanel } from "@/components/admin/employees/EmployeeRolesPanel";
import { CostPeriodsPanel } from "@/components/admin/employees/CostPeriodsPanel";
import { ProjectAssignmentsPanel } from "@/components/admin/employees/ProjectAssignmentsPanel";
import { cn } from "@/lib/utils";

type Tab = "roller" | "maliyetler" | "atamalar";

const TABS: { key: Tab; label: string }[] = [
  { key: "roller", label: "Roller" },
  { key: "maliyetler", label: "Maliyet Dönemleri" },
  { key: "atamalar", label: "Proje Atamaları" },
];

export default function AdminEmployeeDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<AdminEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("roller");
  const qc = useQueryClient();

  const { data: entries = [] } = useQuery({
    queryKey: ["employee-financial-entries", id],
    queryFn: () => getEmployeeFinancialEntries({ employee_id: id! }),
    enabled: !!id,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: getAdminProjects,
  });

  async function handleEntryAdd(values: CardEntryFormValues) {
    await createEmployeeFinancialEntry({ employee_id: id!, project_id: values.project_id, entry_date: values.entry_date, title: values.title, notes: values.notes || null, amount: values.amount, paid_amount: values.paid_amount, currency: values.currency, exchange_rate_to_try: values.exchange_rate_to_try, is_exchange_rate_manual: values.is_exchange_rate_manual, account_type: values.account_type, payment_method: values.payment_method });
    await qc.invalidateQueries({ queryKey: ["employee-financial-entries", id] });
    toast({ title: "Kayıt eklendi." });
  }
  async function handleEntryEdit(entryId: string, values: CardEntryFormValues) {
    await updateEmployeeFinancialEntry({ id: entryId, employee_id: id!, project_id: values.project_id, entry_date: values.entry_date, title: values.title, notes: values.notes || null, amount: values.amount, paid_amount: values.paid_amount, currency: values.currency, exchange_rate_to_try: values.exchange_rate_to_try, is_exchange_rate_manual: values.is_exchange_rate_manual, account_type: values.account_type, payment_method: values.payment_method });
    await qc.invalidateQueries({ queryKey: ["employee-financial-entries", id] });
    toast({ title: "Kayıt güncellendi." });
  }
  async function handleEntryDelete(entryId: string) {
    await deleteEmployeeFinancialEntry(entryId);
    await qc.invalidateQueries({ queryKey: ["employee-financial-entries", id] });
    toast({ title: "Kayıt silindi." });
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getAdminEmployees()
      .then((list) => {
        setEmployee(list.find((e) => e.id === id) ?? null);
      })
      .catch(() => toast({ title: "Personel yüklenemedi.", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [id, toast]);

  if (!id) return <div className="py-12 text-center text-sm text-muted-foreground">Personel bulunamadı.</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/personeller"><ChevronLeft className="h-4 w-4" /> Personeller</Link>
        </Button>
        <div className="flex-1">
          {loading ? (
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          ) : employee ? (
            <>
              <h1 className="text-xl font-semibold text-foreground">{employee.full_name}</h1>
              {employee.role && <p className="text-sm text-muted-foreground">{employee.role}</p>}
            </>
          ) : (
            <p className="text-sm text-destructive">Personel bulunamadı.</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={`/admin/personeller/${id}/tahsisat`}><CalendarDays className="h-4 w-4 mr-1" /> Tahsisat</Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-b-2 border-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="rounded-md border border-border bg-card p-5">
        {tab === "roller" && <EmployeeRolesPanel employeeId={id} />}
        {tab === "maliyetler" && <CostPeriodsPanel employeeId={id} />}
        {tab === "atamalar" && <ProjectAssignmentsPanel employeeId={id} />}
      </div>

      {/* New card-based financial entries */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card-soft">
        <CardStatementTable
          entries={entries as any}
          projects={projects.map((p) => ({ id: p.id, title: p.title }))}
          direction="expense"
          onAdd={handleEntryAdd}
          onEdit={handleEntryEdit}
          onDelete={handleEntryDelete}
          title="Mali Hareketler"
        />
      </div>
    </div>
  );
}
