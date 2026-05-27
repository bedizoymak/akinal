import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const PREFIX = "DEMO_DATA_";
const BASE_DATE = new Date("2025-01-15T00:00:00.000Z");
const TODAY = "2026-05-26";
const CHUNK_SIZE = 100;

const REQUIRED_ENV = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SMOKE_ADMIN_EMAIL",
  "SMOKE_ADMIN_PASSWORD",
];

const projectNames = [
  "Akinal Residence",
  "Marmara Loft",
  "Kuzey Park Evleri",
  "Vadi Konakları",
  "Sahil Teras",
  "Çınar Apartmanı",
  "Nergis Sitesi",
  "Defne Plaza",
  "Güneşli Kentsel Dönüşüm",
  "Moda Yaşam",
  "Erenköy Bahçe",
  "Ataşehir Ofis",
  "Kartal Panorama",
  "Maltepe Sahil",
  "Üsküdar Yalı",
  "Bostancı Kule",
  "Koşuyolu Evleri",
  "Levent Ticari Merkez",
  "Pendik Marina",
  "Kadıköy Ada",
];

const districts = [
  ["İstanbul", "Kadıköy"],
  ["İstanbul", "Ataşehir"],
  ["İstanbul", "Üsküdar"],
  ["İstanbul", "Maltepe"],
  ["İstanbul", "Kartal"],
  ["İstanbul", "Pendik"],
  ["İstanbul", "Beykoz"],
  ["İstanbul", "Şişli"],
  ["İstanbul", "Beşiktaş"],
  ["İstanbul", "Bakırköy"],
  ["Kocaeli", "Gebze"],
  ["Bursa", "Nilüfer"],
  ["Ankara", "Çankaya"],
  ["İzmir", "Karşıyaka"],
  ["Tekirdağ", "Çorlu"],
];

const companyNames = [
  "Kuzey Yapı A.Ş.",
  "Marmara Gayrimenkul Ltd. Şti.",
  "Eren İnşaat Taahhüt",
  "Yıldız Proje Geliştirme",
  "Aslanlar Yapı Kooperatifi",
  "Doğa Mimarlık Ofisi",
  "Çelik Hafriyat Ltd. Şti.",
  "Vadi Arsa Ortaklığı",
  "Bora Dönüşüm Danışmanlık",
  "Kaya Apartmanı Yönetimi",
  "Mavişehir Konut Ortaklığı",
  "Aydınlar Ticaret A.Ş.",
  "Sahil Mülk Geliştirme",
  "Güven Taahhüt Ltd. Şti.",
  "Poyraz Beton Ortaklığı",
  "Yeni Nesil Yapı",
  "Akarsu Mimarlık",
  "Özkan Aile Ortaklığı",
  "Balkan Gayrimenkul",
  "Demirci Apartmanı Malikleri",
];

const contactNames = [
  "Ali Veli",
  "Ayşe Yılmaz",
  "Mehmet Demir",
  "Zeynep Kaya",
  "Murat Şahin",
  "Elif Koç",
  "Hasan Aydın",
  "Selin Çelik",
  "Emre Arslan",
  "Derya Yıldız",
  "Burak Özkan",
  "Aslı Aksoy",
  "Onur Kılıç",
  "Pınar Yalçın",
  "Serkan Güneş",
  "Ceren Taş",
  "Fatih Polat",
  "Buse Ergin",
  "Kerem Kurt",
  "Nazlı Acar",
];

const employeeRoles = [
  "Şantiye Şefi",
  "Kalfa",
  "Usta",
  "Elektrik Ustası",
  "Sıhhi Tesisat Ustası",
  "Boyacı",
  "Demirci Ustası",
  "Kalıp Ustası",
  "Operatör",
  "İş Güvenliği Uzmanı",
  "Mimar",
  "İnşaat Mühendisi",
  "Muhasebe Sorumlusu",
  "Satın Alma Sorumlusu",
  "Depo Sorumlusu",
  "Bekçi",
  "Nakliye Sorumlusu",
  "Proje Koordinatörü",
  "Harita Teknikeri",
  "Saha Elemanı",
];

const expenseCardNames = [
  ["Beton", "Malzeme"],
  ["Demir", "Malzeme"],
  ["Tuğla", "Malzeme"],
  ["Çimento", "Malzeme"],
  ["Seramik", "Malzeme"],
  ["Elektrik Malzemesi", "Malzeme"],
  ["Tesisat Malzemesi", "Malzeme"],
  ["İskele", "Şantiye Gideri"],
  ["Vinç Kiralama", "Şantiye Gideri"],
  ["Hafriyat", "Taşeron"],
  ["Nakliye", "Nakliye"],
  ["Ruhsat Harcı", "Ruhsat"],
  ["Tapu Masrafı", "Tapu"],
  ["Mimari Proje", "Mimari / Proje"],
  ["Statik Proje", "Mimari / Proje"],
  ["İşçilik Avansı", "İşçilik"],
  ["Güvenlik", "Ofis Gideri"],
  ["Şantiye Elektriği", "Şantiye Gideri"],
  ["Kalıp Taşeronu", "Taşeron"],
  ["Peyzaj", "Diğer"],
];

const projectTypes = [
  "Kentsel Dönüşüm",
  "Kat Karşılığı İnşaat",
  "Anahtar Teslim İnşaat",
  "Proje Geliştirme",
  "Riskli Yapı Yenileme",
  "Konut Projesi",
  "Ticari Proje",
];

const projectStatuses = [
  "Planlama Aşamasında",
  "Projelendirme",
  "Ruhsat Sürecinde",
  "Devam Ediyor",
  "Tamamlandı",
];

const paymentMethods = ["Havale / EFT", "Nakit", "Çek", "Senet", "Kredi Kartı"];
const currencies = ["TRY", "TRY", "TRY", "USD", "EUR"];
const groups = ["Resmi", "Resmi", "Gayri Resmi"];

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

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function addMonths(date, months, day = 15) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  next.setUTCDate(day);
  return next.toISOString().slice(0, 10);
}

function moneyTry(seed, min = 85000, step = 27500, bucket = 28) {
  return min + (seed % bucket) * step;
}

function moneyForCurrency(baseTry, currency) {
  if (currency === "USD") return Math.round(baseTry / 32);
  if (currency === "EUR") return Math.round(baseTry / 35);
  return baseTry;
}

function slugFor(index, name) {
  return `${PREFIX.toLowerCase().replace(/_/g, "-")}${name
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${String(index + 1).padStart(2, "0")}`;
}

function rowCountMap(rowsByTable) {
  return Object.fromEntries(Object.entries(rowsByTable).map(([table, rows]) => [table, rows.length]));
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

async function insertRows(supabase, table, rows) {
  const inserted = [];
  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    const chunk = rows.slice(index, index + CHUNK_SIZE);
    const { data, error } = await supabase.from(table).insert(chunk).select("*");
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
    inserted.push(...(data ?? []));
  }
  return inserted;
}

function demoFinancialTotals(rows) {
  const initial = {
    TRY: { plannedIncome: 0, realizedIncome: 0, plannedExpense: 0, realizedExpense: 0 },
    USD: { plannedIncome: 0, realizedIncome: 0, plannedExpense: 0, realizedExpense: 0 },
    EUR: { plannedIncome: 0, realizedIncome: 0, plannedExpense: 0, realizedExpense: 0 },
  };

  for (const row of rows) {
    const currency = row.currency_tag;
    if (!initial[currency]) continue;
    const amount = Number(row.amount ?? 0);
    if (row.direction === "Gelir" && row.status === "Planlandı") initial[currency].plannedIncome += amount;
    if (row.direction === "Gelir" && row.status === "Gerçekleşti") initial[currency].realizedIncome += amount;
    if (row.direction === "Gider" && row.status === "Planlandı") initial[currency].plannedExpense += amount;
    if (row.direction === "Gider" && row.status === "Gerçekleşti") initial[currency].realizedExpense += amount;
  }

  return initial;
}

function buildCustomers() {
  return companyNames.map((company, index) => {
    const [city, district] = districts[index % districts.length];
    const contact = contactNames[index];
    return {
      customer_type: index % 5 === 0 ? "Arsa Sahibi" : "Firma",
      full_name: `${PREFIX}${contact}`,
      company_name: `${PREFIX}${company}`,
      phone: `+90 532 ${String(420 + index).padStart(3, "0")} ${String(10 + index).padStart(2, "0")} ${String(20 + index).padStart(2, "0")}`,
      whatsapp: `+90 532 ${String(420 + index).padStart(3, "0")} ${String(10 + index).padStart(2, "0")} ${String(20 + index).padStart(2, "0")}`,
      email: `demo-data-musteri-${String(index + 1).padStart(2, "0")}@example.com`,
      tax_or_identity_number: String(3400000000 + index * 1717).slice(0, 10),
      address: `${PREFIX}${district} Mah. Şantiye Sok. No: ${index + 10}`,
      city,
      district,
      status: index % 7 === 0 ? "Beklemede" : "Aktif",
      notes: `${PREFIX}${company} için kontrollü demo müşteri kaydı.`,
    };
  });
}

function buildProjects() {
  return projectNames.map((name, index) => {
    const [city, district] = districts[(index + 2) % districts.length];
    return {
      title: `${PREFIX}${name} ${String(index + 1).padStart(2, "0")}`,
      slug: slugFor(index, name),
      short_description: `${PREFIX}${district} bölgesinde kurgusal demo proje özeti.`,
      detailed_description: `${PREFIX}${name} için ruhsat, şantiye ve teslim süreçlerini göstermek amacıyla oluşturulan demo proje.`,
      project_type: projectTypes[index % projectTypes.length],
      project_status: projectStatuses[index % projectStatuses.length],
      location: `${district}, ${city}`,
      city,
      district,
      start_year: index % 4 === 0 ? "2025" : "2026",
      delivery_year: index % 4 === 0 ? "2026" : "2027",
      land_area: `${1200 + index * 85} m²`,
      construction_area: `${4200 + index * 260} m²`,
      apartment_count: `${18 + index * 2}`,
      floor_count: `${5 + (index % 7)}`,
      block_count: `${1 + (index % 3)}`,
      cover_image_url: null,
      is_published: false,
      is_featured: false,
      sort_order: 9000 + index,
      seo_title: `${PREFIX}${name} demo SEO başlığı`,
      seo_description: `${PREFIX}${name} demo SEO açıklaması`,
    };
  });
}

function buildEmployees() {
  return contactNames.map((name, index) => ({
    full_name: `${PREFIX}Personel ${String(index + 1).padStart(2, "0")} - ${name}`,
    phone: `+90 533 ${String(510 + index).padStart(3, "0")} ${String(30 + index).padStart(2, "0")} ${String(40 + index).padStart(2, "0")}`,
    role: employeeRoles[index % employeeRoles.length],
    notes: `${PREFIX}${employeeRoles[index % employeeRoles.length]} için demo personel kartı.`,
    status: index % 9 === 0 ? "Pasif" : "Aktif",
  }));
}

function buildExpenseCards() {
  return expenseCardNames.map(([name, category], index) => ({
    name: `${PREFIX}Gider Kartı ${String(index + 1).padStart(2, "0")} - ${name}`,
    category,
    description: `${PREFIX}${category} kategorisi için demo ticari gider kartı.`,
    status: index % 10 === 0 ? "Pasif" : "Aktif",
  }));
}

async function demoSnapshot(supabase) {
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
    selectRows(supabase, "financial_entries", "id,project_id,title,description,direction,status,amount,currency_tag,group_tag"),
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
    rows: {
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
    },
  };
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

    const preflight = await demoSnapshot(supabase);
    const existingCount = Object.values(preflight.rows).reduce((sum, rows) => sum + rows.length, 0);
    if (existingCount > 0) {
      console.error("DEMO_DATA records already exist. Run npm run cleanup:demo before seeding again.");
      console.error(JSON.stringify(rowCountMap(preflight.rows), null, 2));
      process.exitCode = 1;
      return;
    }

    const customers = await insertRows(supabase, "customers", buildCustomers());
    const projects = await insertRows(supabase, "projects", buildProjects());
    const employees = await insertRows(supabase, "employees", buildEmployees());
    const expenseCards = await insertRows(supabase, "expense_cards", buildExpenseCards());

    const customerProjectRows = [];
    const linkedProjectsByCustomer = new Map();
    for (let customerIndex = 0; customerIndex < customers.length; customerIndex += 1) {
      const linked = [];
      for (let offset = 0; offset < 3; offset += 1) {
        const project = projects[(customerIndex + offset * 7) % projects.length];
        linked.push(project);
        customerProjectRows.push({
          customer_id: customers[customerIndex].id,
          project_id: project.id,
        });
      }
      linkedProjectsByCustomer.set(customers[customerIndex].id, linked);
    }
    const customerProjects = await insertRows(supabase, "customer_projects", customerProjectRows);

    const paymentPlanRows = [];
    for (let customerIndex = 0; customerIndex < customers.length; customerIndex += 1) {
      const customer = customers[customerIndex];
      const linkedProjects = linkedProjectsByCustomer.get(customer.id);
      for (let planIndex = 0; planIndex < 20; planIndex += 1) {
        const dueMonth = (customerIndex * 2 + planIndex) % 24;
        const dueDate = addMonths(BASE_DATE, dueMonth, 12 + (planIndex % 12));
        const planNumber = String(planIndex + 1).padStart(2, "0");
        const paidLike = planIndex % 5 === 0;
        const partialLike = !paidLike && planIndex % 4 === 0;
        const overdueLike = dueDate < TODAY && !paidLike && !partialLike;
        paymentPlanRows.push({
          customer_id: customer.id,
          project_id: linkedProjects[planIndex % linkedProjects.length].id,
          title: `${PREFIX}Tahsilat Planı ${planNumber} - ${customer.company_name.replace(PREFIX, "")}`,
          description: `${PREFIX}${planNumber} numaralı vadeli müşteri alacağı.`,
          amount: moneyTry(customerIndex * 43 + planIndex * 17, 180000, 32500, 34),
          due_date: dueDate,
          status: paidLike ? "Ödendi" : partialLike ? "Kısmi Ödendi" : overdueLike ? "Gecikti" : "Bekliyor",
          notes: `${PREFIX}20 taksitli kontrollü demo tahsilat planı.`,
        });
      }
    }
    const paymentPlans = await insertRows(supabase, "payment_plans", paymentPlanRows);

    const paymentRows = paymentPlans
      .map((plan, index) => {
        const planIndex = index % 20;
        const paidLike = planIndex % 5 === 0;
        const partialLike = !paidLike && planIndex % 4 === 0;
        if (!paidLike && !partialLike) return null;

        const amount = paidLike
          ? Number(plan.amount)
          : Math.round(Number(plan.amount) * (0.35 + (planIndex % 3) * 0.1));

        return {
          customer_id: plan.customer_id,
          project_id: plan.project_id,
          payment_plan_id: plan.id,
          amount,
          payment_date: addDays(new Date(`${plan.due_date}T00:00:00.000Z`), paidLike ? -6 : 3),
          payment_method: paymentMethods[index % paymentMethods.length],
          description: `${PREFIX}${paidLike ? "Tam" : "Kısmi"} tahsilat - ${plan.title}`,
          document_url: null,
        };
      })
      .filter(Boolean);
    const payments = await insertRows(supabase, "payments", paymentRows);

    const expenseRows = [];
    for (let projectIndex = 0; projectIndex < projects.length; projectIndex += 1) {
      for (let expenseIndex = 0; expenseIndex < 6; expenseIndex += 1) {
        const relatedCustomer = customers[(projectIndex + expenseIndex * 3) % customers.length];
        const card = expenseCards[(projectIndex + expenseIndex) % expenseCards.length];
        expenseRows.push({
          customer_id: relatedCustomer.id,
          project_id: projects[projectIndex].id,
          title: `${PREFIX}${card.category} Gideri ${String(expenseIndex + 1).padStart(2, "0")} - ${projects[projectIndex].title.replace(PREFIX, "")}`,
          category: card.category ?? "Diğer",
          amount: moneyTry(projectIndex * 29 + expenseIndex * 13, 45000, 22500, 22),
          expense_date: addMonths(BASE_DATE, (projectIndex * 3 + expenseIndex) % 24, 5 + (expenseIndex % 20)),
          description: `${PREFIX}${card.name.replace(PREFIX, "")} için gerçekleşen demo gider.`,
          document_url: null,
        });
      }
    }
    const expenses = await insertRows(supabase, "expenses", expenseRows);

    const financialEntryRows = [];
    const planCurrencyById = new Map();

    for (let index = 0; index < paymentPlans.length; index += 1) {
      const plan = paymentPlans[index];
      const currency = currencies[index % currencies.length];
      const group = groups[index % groups.length];
      const amount = moneyForCurrency(Number(plan.amount), currency);
      planCurrencyById.set(plan.id, { currency, group });
      financialEntryRows.push({
        project_id: plan.project_id,
        entry_date: plan.due_date,
        card_type: "customer",
        customer_id: plan.customer_id,
        title: `${PREFIX}Gelir Planlandı - ${plan.title}`,
        description: `${PREFIX}Müşteri tahsilat planından üretilen planlanan gelir kaydı.`,
        amount,
        currency_tag: currency,
        group_tag: group,
        direction: "Gelir",
        status: "Planlandı",
        document_url: null,
      });
    }

    for (const payment of payments) {
      const linked = planCurrencyById.get(payment.payment_plan_id) ?? { currency: "TRY", group: "Resmi" };
      financialEntryRows.push({
        project_id: payment.project_id,
        entry_date: payment.payment_date,
        card_type: "customer",
        customer_id: payment.customer_id,
        title: `${PREFIX}Gelir Gerçekleşti - ${payment.description.replace(PREFIX, "")}`,
        description: `${PREFIX}Tahsilat kaydından üretilen gerçekleşen gelir hareketi.`,
        amount: moneyForCurrency(Number(payment.amount), linked.currency),
        currency_tag: linked.currency,
        group_tag: linked.group,
        direction: "Gelir",
        status: "Gerçekleşti",
        document_url: null,
      });
    }

    for (let index = 0; index < employees.length; index += 1) {
      const project = projects[index % projects.length];
      const currency = currencies[(index + 1) % currencies.length];
      const amount = moneyForCurrency(moneyTry(index * 31, 65000, 18500, 16), currency);
      financialEntryRows.push({
        project_id: project.id,
        entry_date: addMonths(BASE_DATE, index, 20),
        card_type: "employee",
        employee_id: employees[index].id,
        title: `${PREFIX}Personel Gider Planlandı - ${employees[index].full_name.replace(PREFIX, "")}`,
        description: `${PREFIX}Personel için planlanan hakediş/maaş gideri.`,
        amount,
        currency_tag: currency,
        group_tag: groups[index % groups.length],
        direction: "Gider",
        status: "Planlandı",
        document_url: null,
      });
      financialEntryRows.push({
        project_id: project.id,
        entry_date: addMonths(BASE_DATE, index + 1, 25),
        card_type: "employee",
        employee_id: employees[index].id,
        title: `${PREFIX}Personel Gider Gerçekleşti - ${employees[index].full_name.replace(PREFIX, "")}`,
        description: `${PREFIX}Personel için gerçekleşen hakediş/maaş ödemesi.`,
        amount: Math.round(amount * 0.72),
        currency_tag: currency,
        group_tag: groups[(index + 1) % groups.length],
        direction: "Gider",
        status: "Gerçekleşti",
        document_url: null,
      });
    }

    for (let index = 0; index < expenseCards.length; index += 1) {
      const project = projects[(index * 2) % projects.length];
      const currency = currencies[(index + 2) % currencies.length];
      const amount = moneyForCurrency(moneyTry(index * 47, 95000, 24500, 18), currency);
      financialEntryRows.push({
        project_id: project.id,
        entry_date: addMonths(BASE_DATE, index + 2, 12),
        card_type: "expense",
        expense_card_id: expenseCards[index].id,
        title: `${PREFIX}Gider Kartı Planlandı - ${expenseCards[index].name.replace(PREFIX, "")}`,
        description: `${PREFIX}Gider kartı için planlanan maliyet kaydı.`,
        amount,
        currency_tag: currency,
        group_tag: groups[index % groups.length],
        direction: "Gider",
        status: "Planlandı",
        document_url: null,
      });
      financialEntryRows.push({
        project_id: project.id,
        entry_date: addMonths(BASE_DATE, index + 3, 18),
        card_type: "expense",
        expense_card_id: expenseCards[index].id,
        title: `${PREFIX}Gider Kartı Gerçekleşti - ${expenseCards[index].name.replace(PREFIX, "")}`,
        description: `${PREFIX}Gider kartı için gerçekleşen maliyet kaydı.`,
        amount: Math.round(amount * 0.85),
        currency_tag: currency,
        group_tag: groups[(index + 2) % groups.length],
        direction: "Gider",
        status: "Gerçekleşti",
        document_url: null,
      });
    }

    for (let index = 0; index < expenses.length; index += 1) {
      const expense = expenses[index];
      const expenseCard = expenseCards[index % expenseCards.length];
      const currency = index % 11 === 0 ? "USD" : index % 17 === 0 ? "EUR" : "TRY";
      financialEntryRows.push({
        project_id: expense.project_id,
        entry_date: expense.expense_date,
        card_type: "expense",
        expense_card_id: expenseCard.id,
        title: `${PREFIX}Gider Gerçekleşti - ${expense.title.replace(PREFIX, "")}`,
        description: `${PREFIX}Operasyonel gider kaydından üretilen gerçekleşen gider hareketi.`,
        amount: moneyForCurrency(Number(expense.amount), currency),
        currency_tag: currency,
        group_tag: groups[index % groups.length],
        direction: "Gider",
        status: "Gerçekleşti",
        document_url: null,
      });
    }

    const financialEntries = await insertRows(supabase, "financial_entries", financialEntryRows);

    const customerNoteRows = customers.flatMap((customer, index) => [
      {
        customer_id: customer.id,
        note: `${PREFIX}${customer.company_name.replace(PREFIX, "")} için sözleşme görüşmesi tamamlandı.`,
      },
      {
        customer_id: customer.id,
        note: `${PREFIX}${index + 1}. müşteri için tapu/ruhsat evrakları demo takip notu.`,
      },
    ]);
    const customerNotes = await insertRows(supabase, "customer_notes", customerNoteRows);

    const notificationRows = paymentPlans
      .filter((_, index) => index % 10 === 0)
      .map((plan, index) => ({
        title: `${PREFIX}${plan.status === "Gecikti" ? "Geciken Tahsilat" : "Yaklaşan Tahsilat"}`,
        message: `${PREFIX}${plan.title} için ${plan.due_date} tarihli demo hatırlatma.`,
        type: `${PREFIX}Finans`,
        priority: plan.status === "Gecikti" ? "high" : index % 3 === 0 ? "medium" : "low",
        is_read: index % 4 === 0,
        related_customer_id: plan.customer_id,
        related_project_id: plan.project_id,
        related_payment_plan_id: plan.id,
      }));
    const notifications = await insertRows(supabase, "notifications", notificationRows);

    const snapshot = await demoSnapshot(supabase);
    const countsByTable = rowCountMap(snapshot.rows);
    const insertedCounts = {
      customers: customers.length,
      projects: projects.length,
      customer_projects: customerProjects.length,
      employees: employees.length,
      expense_cards: expenseCards.length,
      payment_plans: paymentPlans.length,
      payments: payments.length,
      expenses: expenses.length,
      financial_entries: financialEntries.length,
      customer_notes: customerNotes.length,
      notifications: notifications.length,
      documents: 0,
      media_library: 0,
    };

    console.log("DEMO_DATA_CREATED_COUNTS");
    console.log(JSON.stringify(insertedCounts, null, 2));
    console.log("DEMO_DATA_COUNTS_BY_TABLE");
    console.log(JSON.stringify(countsByTable, null, 2));
    console.log("DEMO_DATA_FINANCE_TOTALS_BY_CURRENCY");
    console.log(JSON.stringify(demoFinancialTotals(snapshot.rows.financial_entries), null, 2));
    console.log("DEMO_DATA_SOURCE_HEALTH");
    console.log(JSON.stringify({
      dashboardLedgerRows: snapshot.rows.financial_entries.length,
      reportsProjectCoverage: new Set(snapshot.rows.financial_entries.map((row) => row.project_id).filter(Boolean)).size,
      customerProjectLinks: snapshot.rows.customer_projects.length,
      everyCustomerHasAtLeastThreeProjects: snapshot.rows.customer_projects.length >= customers.length * 3,
      everyCustomerHasTwentyPlans: paymentPlans.length === customers.length * 20,
      documentsSkipped: "No safe real file URLs were created.",
      mediaLibrarySkipped: "No safe real image files were created.",
    }, null, 2));
  } finally {
    if (signedIn) await supabase.auth.signOut();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
