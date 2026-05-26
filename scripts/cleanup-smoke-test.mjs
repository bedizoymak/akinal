import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const PREFIX = "SMOKE_TEST_";
const PROJECT_SLUG = "smoke-test-proje";

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

async function loadSmokeEnv() {
  const localEnv = parseEnvFile(await readFile(".env.local", "utf8"));
  const merged = { ...process.env, ...localEnv };

  for (const key of [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SMOKE_ADMIN_EMAIL",
    "SMOKE_ADMIN_PASSWORD",
  ]) {
    if (!merged[key]) {
      throw new Error(`Missing ${key} in .env.local`);
    }
  }

  return merged;
}

function createSmokeClient(env) {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function startsWithSmoke(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

function smokeRecord(table, row) {
  switch (table) {
    case "customers":
      return [
        row.company_name,
        row.full_name,
        row.email,
        row.notes,
      ].some(startsWithSmoke);
    case "projects":
      return startsWithSmoke(row.title) || row.slug === PROJECT_SLUG;
    case "employees":
      return [row.full_name, row.notes].some(startsWithSmoke);
    case "expense_cards":
      return [row.name, row.description].some(startsWithSmoke);
    case "payment_plans":
      return [row.title, row.description, row.notes].some(startsWithSmoke);
    case "payments":
      return startsWithSmoke(row.description);
    case "expenses":
      return [row.title, row.description].some(startsWithSmoke);
    case "financial_entries":
      return [row.title, row.description].some(startsWithSmoke);
    case "notifications":
      return [row.title, row.message, row.type].some(startsWithSmoke);
    default:
      return false;
  }
}

async function selectRows(supabase, table, columns = "*") {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) {
    throw new Error(`${table} select failed: ${error.message}`);
  }
  return data ?? [];
}

async function optionalSelectRows(supabase, table, columns = "*") {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) return [];
  return data ?? [];
}

async function findSmokeRows(supabase) {
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
  ] = await Promise.all([
    selectRows(supabase, "customers", "id,company_name,full_name,email,notes"),
    selectRows(supabase, "projects", "id,title,slug"),
    selectRows(supabase, "employees", "id,full_name,notes"),
    selectRows(supabase, "expense_cards", "id,name,description"),
    selectRows(supabase, "payment_plans", "id,title,description,notes"),
    selectRows(supabase, "payments", "id,description"),
    selectRows(supabase, "expenses", "id,title,description"),
    selectRows(supabase, "financial_entries", "id,title,description"),
    optionalSelectRows(supabase, "notifications", "id,title,message,type,related_customer_id,related_project_id"),
  ]);

  const smokeCustomers = customers.filter((row) => smokeRecord("customers", row));
  const smokeProjects = projects.filter((row) => smokeRecord("projects", row));
  const smokeCustomerIds = new Set(smokeCustomers.map((row) => row.id));
  const smokeProjectIds = new Set(smokeProjects.map((row) => row.id));
  const customerProjects = await optionalSelectRows(supabase, "customer_projects", "id,customer_id,project_id");

  return {
    customers: smokeCustomers,
    projects: smokeProjects,
    customer_projects: customerProjects.filter(
      (row) => smokeCustomerIds.has(row.customer_id) || smokeProjectIds.has(row.project_id),
    ),
    employees: employees.filter((row) => smokeRecord("employees", row)),
    expense_cards: expenseCards.filter((row) => smokeRecord("expense_cards", row)),
    payment_plans: paymentPlans.filter((row) => smokeRecord("payment_plans", row)),
    payments: payments.filter((row) => smokeRecord("payments", row)),
    expenses: expenses.filter((row) => smokeRecord("expenses", row)),
    financial_entries: financialEntries.filter((row) => smokeRecord("financial_entries", row)),
    notifications: notifications.filter(
      (row) =>
        smokeRecord("notifications", row) ||
        smokeCustomerIds.has(row.related_customer_id) ||
        smokeProjectIds.has(row.related_project_id),
    ),
  };
}

async function deleteByIds(supabase, table, rows) {
  const ids = rows.map((row) => row.id).filter(Boolean);
  if (!ids.length) return 0;

  const { data, error } = await supabase.from(table).delete().in("id", ids).select("id");
  if (error) {
    throw new Error(`${table} delete failed: ${error.message}`);
  }

  return data?.length ?? ids.length;
}

async function main() {
  const env = await loadSmokeEnv();
  const supabase = createSmokeClient(env);
  let signedIn = false;

  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: env.SMOKE_ADMIN_EMAIL,
      password: env.SMOKE_ADMIN_PASSWORD,
    });

    if (signInError) {
      throw new Error(`Admin sign in failed: ${signInError.message}`);
    }
    signedIn = true;

    const smoke = await findSmokeRows(supabase);
    const deleted = {};

    for (const table of [
      "notifications",
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
      deleted[table] = await deleteByIds(supabase, table, smoke[table] ?? []);
    }

    console.log("SMOKE_TEST_DELETED_COUNTS");
    console.log(JSON.stringify(deleted, null, 2));
  } finally {
    if (signedIn) {
      await supabase.auth.signOut();
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
