import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Customer = any;
export type PaymentPlan = any;
export type Payment = any;
export type Expense = any;
export type Project = any;

export function useTable<T = any>(table: string, orderBy = "created_at", asc = false) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from(table as any).select("*").order(orderBy, { ascending: asc }) as any);
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
  const projects = useTable<Project>("projects", "sort_order", true);
  const links = useTable<any>("customer_projects", "created_at", true);
  const loading = customers.loading || plans.loading || payments.loading || expenses.loading || projects.loading;
  const reloadAll = async () => {
    await Promise.all([customers.reload(), plans.reload(), payments.reload(), expenses.reload(), projects.reload(), links.reload()]);
  };
  return { customers, plans, payments, expenses, projects, links, loading, reloadAll };
}
