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

async function smokeSnapshot(supabase) {
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
    selectRows(supabase, "financial_entries", "id,title,description,direction,status,amount"),
    optionalSelectRows(supabase, "notifications", "id,title,message,type"),
  ]);

  const smokeCustomers = customers.filter((row) => smokeRecord("customers", row));
  const smokeProjects = projects.filter((row) => smokeRecord("projects", row));
  const smokeCustomerIds = new Set(smokeCustomers.map((row) => row.id));
  const smokeProjectIds = new Set(smokeProjects.map((row) => row.id));
  const customerProjects = await optionalSelectRows(supabase, "customer_projects", "id,customer_id,project_id");
  const smokeCustomerProjects = customerProjects.filter(
    (row) => smokeCustomerIds.has(row.customer_id) || smokeProjectIds.has(row.project_id),
  );

  const byTable = {
    customers: smokeCustomers,
    projects: smokeProjects,
    customer_projects: smokeCustomerProjects,
    employees: employees.filter((row) => smokeRecord("employees", row)),
    expense_cards: expenseCards.filter((row) => smokeRecord("expense_cards", row)),
    payment_plans: paymentPlans.filter((row) => smokeRecord("payment_plans", row)),
    payments: payments.filter((row) => smokeRecord("payments", row)),
    expenses: expenses.filter((row) => smokeRecord("expenses", row)),
    financial_entries: financialEntries.filter((row) => smokeRecord("financial_entries", row)),
    notifications: notifications.filter((row) => smokeRecord("notifications", row)),
  };

  return {
    rows: byTable,
    counts: Object.fromEntries(Object.entries(byTable).map(([table, rows]) => [table, rows.length])),
  };
}

async function insertOne(supabase, table, payload) {
  const { data, error } = await supabase.from(table).insert(payload).select("*").single();
  if (error) {
    throw new Error(`${table} insert failed: ${error.message}`);
  }
  return data;
}

async function optionalInsertOne(supabase, table, payload) {
  const { data, error } = await supabase.from(table).insert(payload).select("*").single();
  if (error) {
    console.warn(`${table} insert skipped: ${error.message}`);
    return null;
  }
  return data;
}

async function updateSmokeNotifications(supabase, customerId, projectId) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id,title,message,type,related_customer_id,related_project_id")
    .or(`related_customer_id.eq.${customerId},related_project_id.eq.${projectId}`);

  if (error) return [];

  const updatedIds = [];
  for (const notification of data ?? []) {
    const title = startsWithSmoke(notification.title)
      ? notification.title
      : `${PREFIX}${notification.title}`;
    const message = startsWithSmoke(notification.message)
      ? notification.message
      : `${PREFIX}${notification.message}`;
    const type = startsWithSmoke(notification.type)
      ? notification.type
      : `${PREFIX}${notification.type}`;

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ title, message, type })
      .eq("id", notification.id);

    if (updateError) {
      console.warn(`notifications update skipped for ${notification.id}: ${updateError.message}`);
      continue;
    }

    updatedIds.push(notification.id);
  }

  return updatedIds;
}

function groupFinancialEntries(rows) {
  const grouped = {};
  for (const row of rows) {
    const key = `${row.direction} / ${row.status}`;
    if (!grouped[key]) grouped[key] = { count: 0, amount: 0 };
    grouped[key].count += 1;
    grouped[key].amount += Number(row.amount ?? 0);
  }
  return grouped;
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

    const preflight = await smokeSnapshot(supabase);
    const existingCount = Object.values(preflight.counts).reduce((sum, count) => sum + count, 0);
    if (existingCount > 0) {
      console.error("Smoke test records already exist. Run npm run cleanup:smoke before seeding again.");
      console.error(JSON.stringify(preflight.counts, null, 2));
      process.exitCode = 1;
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const plusDays = (days) => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return date.toISOString().slice(0, 10);
    };

    const customer = await insertOne(supabase, "customers", {
      company_name: `${PREFIX}Müşteri A.Ş.`,
      full_name: `${PREFIX}Ali Veli`,
      customer_type: "corporate",
      phone: "+90 532 000 00 01",
      whatsapp: "+90 532 000 00 01",
      email: "smoke-test-musteri@example.com",
      tax_or_identity_number: "1234567890",
      address: `${PREFIX}Kurgusal Mah. Test Sok. No: 10`,
      city: "İstanbul",
      district: "Kadıköy",
      status: "Aktif",
      notes: `${PREFIX}seed customer`,
    });

    const project = await insertOne(supabase, "projects", {
      title: `${PREFIX}Proje`,
      slug: PROJECT_SLUG,
      short_description: `${PREFIX}kısa açıklama`,
      detailed_description: `${PREFIX}detaylı açıklama. Bu kayıt yalnızca admin smoke testi içindir.`,
      project_type: "Konut Projesi",
      project_status: "Devam Ediyor",
      location: "Kadıköy, İstanbul",
      city: "İstanbul",
      district: "Kadıköy",
      start_year: "2026",
      delivery_year: "2027",
      is_published: false,
      is_featured: false,
      sort_order: 9999,
    });

    const customerProject = await optionalInsertOne(supabase, "customer_projects", {
      customer_id: customer.id,
      project_id: project.id,
    });

    const employee = await insertOne(supabase, "employees", {
      full_name: `${PREFIX}Personel`,
      phone: "+90 533 000 00 02",
      role: "Şantiye Sorumlusu",
      notes: `${PREFIX}seed employee`,
      status: "Aktif",
    });

    const expenseCard = await insertOne(supabase, "expense_cards", {
      name: `${PREFIX}Gider Kartı`,
      category: "Malzeme",
      description: `${PREFIX}seed expense card`,
      status: "Aktif",
    });

    const paymentPlans = [];
    paymentPlans.push(await insertOne(supabase, "payment_plans", {
      customer_id: customer.id,
      project_id: project.id,
      title: `${PREFIX}Peşinat Planı`,
      description: `${PREFIX}planlanan peşinat`,
      amount: 1250000,
      due_date: plusDays(14),
      status: "Bekliyor",
      notes: `${PREFIX}seed payment plan 1`,
    }));
    paymentPlans.push(await insertOne(supabase, "payment_plans", {
      customer_id: customer.id,
      project_id: project.id,
      title: `${PREFIX}Ara Ödeme Planı`,
      description: `${PREFIX}planlanan ara ödeme`,
      amount: 875000,
      due_date: plusDays(45),
      status: "Bekliyor",
      notes: `${PREFIX}seed payment plan 2`,
    }));

    const payment = await insertOne(supabase, "payments", {
      customer_id: customer.id,
      project_id: project.id,
      payment_plan_id: paymentPlans[0].id,
      amount: 250000,
      payment_date: today,
      payment_method: "Havale / EFT",
      description: `${PREFIX}gerçekleşen tahsilat`,
    });

    const expense = await insertOne(supabase, "expenses", {
      customer_id: customer.id,
      project_id: project.id,
      title: `${PREFIX}Beton Avansı`,
      category: "Malzeme",
      amount: 185000,
      expense_date: today,
      description: `${PREFIX}gerçekleşen proje gideri`,
    });

    const financialEntries = [];
    for (const payload of [
      {
        card_type: "customer",
        customer_id: customer.id,
        title: `${PREFIX}Müşteri Gelir Planlandı`,
        description: `${PREFIX}customer income planned`,
        amount: 1250000,
        direction: "Gelir",
        status: "Planlandı",
      },
      {
        card_type: "customer",
        customer_id: customer.id,
        title: `${PREFIX}Müşteri Gelir Gerçekleşti`,
        description: `${PREFIX}customer income realized`,
        amount: 250000,
        direction: "Gelir",
        status: "Gerçekleşti",
      },
      {
        card_type: "employee",
        employee_id: employee.id,
        title: `${PREFIX}Personel Gider Planlandı`,
        description: `${PREFIX}employee expense planned`,
        amount: 95000,
        direction: "Gider",
        status: "Planlandı",
      },
      {
        card_type: "employee",
        employee_id: employee.id,
        title: `${PREFIX}Personel Gider Gerçekleşti`,
        description: `${PREFIX}employee expense realized`,
        amount: 45000,
        direction: "Gider",
        status: "Gerçekleşti",
      },
      {
        card_type: "expense",
        expense_card_id: expenseCard.id,
        title: `${PREFIX}Gider Kartı Gider Planlandı`,
        description: `${PREFIX}expense card expense planned`,
        amount: 180000,
        direction: "Gider",
        status: "Planlandı",
      },
      {
        card_type: "expense",
        expense_card_id: expenseCard.id,
        title: `${PREFIX}Gider Kartı Gider Gerçekleşti`,
        description: `${PREFIX}expense card expense realized`,
        amount: 185000,
        direction: "Gider",
        status: "Gerçekleşti",
      },
    ]) {
      financialEntries.push(await insertOne(supabase, "financial_entries", {
        project_id: project.id,
        entry_date: today,
        currency_tag: "TRY",
        group_tag: "Resmi",
        document_url: null,
        ...payload,
      }));
    }

    const notificationIds = await updateSmokeNotifications(supabase, customer.id, project.id);
    const postInsert = await smokeSnapshot(supabase);

    const ids = {
      customers: [customer.id],
      projects: [project.id],
      customer_projects: customerProject ? [customerProject.id] : [],
      employees: [employee.id],
      expense_cards: [expenseCard.id],
      payment_plans: paymentPlans.map((row) => row.id),
      payments: [payment.id],
      expenses: [expense.id],
      financial_entries: financialEntries.map((row) => row.id),
      notifications: notificationIds,
    };

    console.log("SMOKE_TEST_CREATED_IDS");
    console.log(JSON.stringify(ids, null, 2));
    console.log("SMOKE_TEST_COUNTS_BY_TABLE");
    console.log(JSON.stringify(postInsert.counts, null, 2));
    console.log("SMOKE_TEST_FINANCIAL_ENTRIES_GROUPED");
    console.log(JSON.stringify(groupFinancialEntries(postInsert.rows.financial_entries), null, 2));
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
