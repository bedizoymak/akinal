import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Customer = Tables["customers"]["Row"];
export type PaymentPlan = Tables["payment_plans"]["Row"];
export type Payment = Tables["payments"]["Row"];
export type Expense = Tables["expenses"]["Row"];
export type Project = Tables["projects"]["Row"];
export type FinancialEntry = Tables["financial_entries"]["Row"];
export type CustomerProject = Tables["customer_projects"]["Row"];
type FinanceTableName = "customers" | "payment_plans" | "payments" | "expenses" | "financial_entries" | "projects" | "customer_projects";

export function useTable<T>(table: FinanceTableName, orderBy = "created_at", asc = false) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from(table).select("*").order(orderBy, { ascending: asc });
    setData((data as T[]) || []);
    setLoading(false);
  }, [table, orderBy, asc]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, reload, setData };
}

export function useFinanceAll() {
  const customers = useTable<Customer>("customers", "created_at", false);
  const plans = useTable<PaymentPlan>("payment_plans", "due_date", true);
  const payments = useTable<Payment>("payments", "payment_date", false);
  const expenses = useTable<Expense>("expenses", "expense_date", false);
  const financialEntries = useTable<FinancialEntry>("financial_entries", "entry_date", false);
  const projects = useTable<Project>("projects", "sort_order", true);
  const links = useTable<CustomerProject>("customer_projects", "created_at", true);
  const loading = customers.loading || plans.loading || payments.loading || expenses.loading || financialEntries.loading || projects.loading;
  const reloadAll = async () => {
    await Promise.all([customers.reload(), plans.reload(), payments.reload(), expenses.reload(), financialEntries.reload(), projects.reload(), links.reload()]);
  };
  return { customers, plans, payments, expenses, financialEntries, projects, links, loading, reloadAll };
}
