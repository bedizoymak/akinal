import { useEffect, useState, useCallback } from "react";
import { getAdminReportsData } from "@/lib/apiClient";
import type { AdminReportsResponse } from "@/lib/apiTypes";

const emptyReportsData: AdminReportsResponse = {
  customers: [],
  payment_plans: [],
  payments: [],
  expenses: [],
  financial_entries: [],
  projects: [],
  customer_projects: [],
  contact_requests: [],
  aggregates: {
    total_projects: 0,
    total_customers: 0,
    total_payments: 0,
    total_expenses: 0,
    total_contact_requests: 0,
  },
};

function useStaticTable<T>(sourceData: T[], loading: boolean, reload: () => Promise<void>) {
  const [data, setData] = useState<T[]>([]);
  useEffect(() => { setData(sourceData); }, [sourceData]);
  return { data, loading, reload, setData };
}

export function useFinanceAll() {
  const [reports, setReports] = useState<AdminReportsResponse>(emptyReportsData);
  const [loading, setLoading] = useState(true);
  const reloadAll = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await getAdminReportsData());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { reloadAll(); }, [reloadAll]);

  const customers = useStaticTable(reports.customers, loading, reloadAll);
  const plans = useStaticTable(reports.payment_plans, loading, reloadAll);
  const payments = useStaticTable(reports.payments, loading, reloadAll);
  const expenses = useStaticTable(reports.expenses, loading, reloadAll);
  const financialEntries = useStaticTable(reports.financial_entries, loading, reloadAll);
  const projects = useStaticTable(reports.projects, loading, reloadAll);
  const links = useStaticTable(reports.customer_projects, loading, reloadAll);
  return { customers, plans, payments, expenses, financialEntries, projects, links, loading, reloadAll };
}
