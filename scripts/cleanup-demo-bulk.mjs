import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const PREFIX = "DEMO_DATA_";
const CHUNK_SIZE = 100;

const REQUIRED_ENV = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SMOKE_ADMIN_EMAIL",
  "SMOKE_ADMIN_PASSWORD",
];

function parseEnvFile(contents) {
  const env = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsAt = line.indexOf("=");
    if (equalsAt === -1) continue;
    const key = line.slice(0, equalsAt).trim();
    let value = line.slice(equalsAt + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function loadEnv() {
  const localEnv = parseEnvFile(await readFile(".env.local", "utf8"));
  const merged = { ...process.env, ...localEnv };
  for (const key of REQUIRED_ENV) {
    if (!merged[key]) throw new Error(`Missing ${key} in .env.local`);
  }
  return merged;
}

function createDemoClient(env) {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function startsWithDemo(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

async function selectRows(supabase, table, columns = "*") {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw new Error(`${table} select failed: ${error.message}`);
  return data ?? [];
}

async function optionalSelectRows(supabase, table, columns = "*") {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) return [];
  return data ?? [];
}

async function findDemoRows(supabase) {
  const [
    customers,
    projects,
    employees,
    expenseCards,
    paymentPlans,
    payments,
    expenses,
    financialEntries,
    notifications,
    customerNotes,
    documents,
    mediaLibrary,
  ] = await Promise.all([
    selectRows(supabase, "customers", "id,company_name,full_name,email,notes,address"),
    selectRows(supabase, "projects", "id,title,slug,short_description,detailed_description,seo_title,seo_description"),
    selectRows(supabase, "employees", "id,full_name,notes"),
    selectRows(supabase, "expense_cards", "id,name,description"),
    selectRows(supabase, "payment_plans", "id,title,description,notes"),
    selectRows(supabase, "payments", "id,description"),
    selectRows(supabase, "expenses", "id,title,description"),
    selectRows(supabase, "financial_entries", "id,title,description"),
    optionalSelectRows(supabase, "notifications", "id,title,message,type"),
    optionalSelectRows(supabase, "customer_notes", "id,note,customer_id"),
    optionalSelectRows(supabase, "documents", "id,title,notes,customer_id,project_id"),
    optionalSelectRows(supabase, "media_library", "id,title,file_name,alt_text,related_project_id"),
  ]);

  const demoCustomers = customers.filter((row) =>
    [row.company_name, row.full_name, row.notes, row.address].some(startsWithDemo),
  );
  const demoProjects = projects.filter((row) =>
    startsWithDemo(row.title) ||
    startsWithDemo(row.short_description) ||
    startsWithDemo(row.detailed_description) ||
    row.slug?.startsWith("demo-data-"),
  );
  const demoCustomerIds = new Set(demoCustomers.map((row) => row.id));
  const demoProjectIds = new Set(demoProjects.map((row) => row.id));
  const customerProjects = await optionalSelectRows(supabase, "customer_projects", "id,customer_id,project_id");

  return {
    customers: demoCustomers,
    projects: demoProjects,
    customer_projects: customerProjects.filter(
      (row) => demoCustomerIds.has(row.customer_id) || demoProjectIds.has(row.project_id),
    ),
    employees: employees.filter((row) => [row.full_name, row.notes].some(startsWithDemo)),
    expense_cards: expenseCards.filter((row) => [row.name, row.description].some(startsWithDemo)),
    payment_plans: paymentPlans.filter((row) => [row.title, row.description, row.notes].some(startsWithDemo)),
    payments: payments.filter((row) => startsWithDemo(row.description)),
    expenses: expenses.filter((row) => [row.title, row.description].some(startsWithDemo)),
    financial_entries: financialEntries.filter((row) => [row.title, row.description].some(startsWithDemo)),
    notifications: notifications.filter((row) => [row.title, row.message, row.type].some(startsWithDemo)),
    customer_notes: customerNotes.filter((row) => startsWithDemo(row.note)),
    documents: documents.filter((row) => [row.title, row.notes].some(startsWithDemo)),
    media_library: mediaLibrary.filter((row) => [row.title, row.file_name, row.alt_text].some(startsWithDemo)),
  };
}

async function deleteByIds(supabase, table, rows) {
  const ids = rows.map((row) => row.id).filter(Boolean);
  let deletedCount = 0;

  for (let index = 0; index < ids.length; index += CHUNK_SIZE) {
    const chunk = ids.slice(index, index + CHUNK_SIZE);
    const { data, error } = await supabase.from(table).delete().in("id", chunk).select("id");
    if (error) throw new Error(`${table} delete failed: ${error.message}`);
    deletedCount += data?.length ?? chunk.length;
  }

  return deletedCount;
}

async function main() {
  const env = await loadEnv();
  const supabase = createDemoClient(env);
  let signedIn = false;

  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: env.SMOKE_ADMIN_EMAIL,
      password: env.SMOKE_ADMIN_PASSWORD,
    });
    if (signInError) throw new Error(`Admin sign in failed: ${signInError.message}`);
    signedIn = true;

    const demoRows = await findDemoRows(supabase);
    const deleted = {};

    for (const table of [
      "notifications",
      "customer_notes",
      "documents",
      "media_library",
      "financial_entries",
      "payments",
      "expenses",
      "payment_plans",
      "customer_projects",
      "projects",
      "employees",
      "expense_cards",
      "customers",
    ]) {
      deleted[table] = await deleteByIds(supabase, table, demoRows[table] ?? []);
    }

    console.log("DEMO_DATA_DELETED_COUNTS");
    console.log(JSON.stringify(deleted, null, 2));
  } finally {
    if (signedIn) await supabase.auth.signOut();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
