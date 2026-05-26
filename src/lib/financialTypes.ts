import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CardType, CurrencyTag, EntryDirection, EntryStatus, GroupTag } from "@/lib/finance";

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type EmployeeRow = {
  id: string;
  full_name: string;
  phone: string | null;
  role: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type EmployeeInsert = {
  id?: string;
  full_name: string;
  phone?: string | null;
  role?: string | null;
  notes?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeUpdate = Partial<EmployeeInsert>;

export type ExpenseCardRow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ExpenseCardInsert = {
  id?: string;
  name: string;
  category?: string | null;
  description?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

export type ExpenseCardUpdate = Partial<ExpenseCardInsert>;

export type FinancialEntryRow = {
  id: string;
  project_id: string | null;
  entry_date: string;
  card_type: CardType;
  customer_id: string | null;
  employee_id: string | null;
  expense_card_id: string | null;
  title: string;
  description: string | null;
  amount: number;
  currency_tag: CurrencyTag;
  group_tag: GroupTag;
  direction: EntryDirection;
  status: EntryStatus;
  document_url: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialEntryInsert = {
  id?: string;
  project_id: string;
  entry_date?: string;
  card_type: CardType;
  customer_id?: string | null;
  employee_id?: string | null;
  expense_card_id?: string | null;
  title: string;
  description?: string | null;
  amount: number;
  currency_tag?: CurrencyTag;
  group_tag?: GroupTag;
  direction: EntryDirection;
  status?: EntryStatus;
  document_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type FinancialEntryUpdate = Partial<FinancialEntryInsert>;

export type ProjectLookup = {
  id: string;
  title: string;
  location?: string | null;
  project_status?: string | null;
};

export type CustomerLookup = {
  id: string;
  customer_type: string;
  full_name: string | null;
  company_name: string | null;
  phone: string;
  email: string | null;
  tax_or_identity_number: string | null;
  status: string;
};

type FinanceTables = Database["public"]["Tables"] & {
  employees: TableDefinition<EmployeeRow, EmployeeInsert, EmployeeUpdate>;
  expense_cards: TableDefinition<ExpenseCardRow, ExpenseCardInsert, ExpenseCardUpdate>;
  financial_entries: TableDefinition<FinancialEntryRow, FinancialEntryInsert, FinancialEntryUpdate>;
};

export type FinanceDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: FinanceTables;
  };
};

export const financeSupabase = supabase as unknown as SupabaseClient<FinanceDatabase>;
