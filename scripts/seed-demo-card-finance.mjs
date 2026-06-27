/**
 * Demo seed for the new card-based finance architecture.
 * Seeds: ak_suppliers + all 4 financial entry tables.
 *
 * Usage:
 *   node scripts/seed-demo-card-finance.mjs
 *
 * Requires env: DB_HOST, DB_USER, DB_PASS, DB_NAME
 * Or edit the DB config below directly for local use.
 */

import mysql from "mysql2/promise";

const DB = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "akinalinsaat",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function toTRY(amount, rate) {
  return Math.round(amount * rate * 100) / 100;
}

function autoStatus(amount, paid, entryDate) {
  const today = new Date().toISOString().slice(0, 10);
  if (paid <= 0) return entryDate < today ? "Gecikmiş" : "Planlanan";
  if (paid >= amount) return paid > amount ? "Fazla Ödendi" : "Gerçekleşti";
  return "Kısmi Ödendi";
}

function isOverdue(amount, paid, entryDate) {
  const today = new Date().toISOString().slice(0, 10);
  return entryDate < today && paid < amount ? 1 : 0;
}

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const conn = await mysql.createConnection(DB);
  console.log("Connected to", DB.database);

  // 1. Fetch first 2 projects
  const [projects] = await conn.execute("SELECT id, title FROM ak_projects ORDER BY created_at LIMIT 2");
  if (projects.length === 0) throw new Error("No projects found — run project seed first.");
  const [p1, p2 = p1] = projects;
  console.log(`Using projects: ${p1.title}, ${p2.title}`);

  // 2. Fetch first 2 customers
  const [customers] = await conn.execute("SELECT id, first_name, last_name FROM ak_customers ORDER BY created_at LIMIT 2");
  if (customers.length === 0) throw new Error("No customers found — run customer seed first.");
  const [c1, c2 = c1] = customers;

  // 3. Fetch first 2 employees
  const [employees] = await conn.execute("SELECT id, full_name FROM ak_employees ORDER BY created_at LIMIT 2");
  if (employees.length === 0) throw new Error("No employees found — run employee seed first.");
  const [em1, em2 = em1] = employees;

  // 4. Fetch first 2 expense cards
  const [expenseCards] = await conn.execute("SELECT id, name FROM ak_expense_cards ORDER BY created_at LIMIT 2");
  if (expenseCards.length === 0) throw new Error("No expense cards found — run expense card seed first.");
  const [ec1, ec2 = ec1] = expenseCards;

  // 5. Seed suppliers
  console.log("\n→ Seeding ak_suppliers...");
  const sup1Id = uuid();
  const sup2Id = uuid();
  const sup3Id = uuid();
  const suppliers = [
    [sup1Id, "Yılmaz Demir İnşaat Malzemeleri Ltd.", "supplier", "Murat Yılmaz", "0532 111 2233", null, "info@yilmazdemir.com", "1234567890", "Kocasinan Mah. İnşaat Cad. No:15", "İstanbul", "Kadıköy", null, 1],
    [sup2Id, "Ahsen Elektrik Taahhüt", "subcontractor", "Ahsen Kaya", "0533 444 5566", "05334445566", null, null, null, "Ankara", "Çankaya", "Elektrik taahhüt işleri için tercih edilen firma.", 1],
    [sup3Id, "Kadir Vinç Kiralama", "crane_rental", "Kadir Şahin", "0541 888 7766", null, null, null, null, "İstanbul", "Sarıyer", null, 1],
  ];
  for (const s of suppliers) {
    await conn.execute(
      `INSERT IGNORE INTO ak_suppliers (id, name, supplier_type, contact_person, phone, whatsapp, email, tax_no, address, city, district, notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      s
    );
  }
  console.log(`  Seeded 3 suppliers (${sup1Id.slice(0, 8)}..., ${sup2Id.slice(0, 8)}..., ${sup3Id.slice(0, 8)}...)`);

  // 6. Seed customer financial entries (income)
  console.log("\n→ Seeding ak_customer_financial_entries...");
  const customerEntries = [
    { customer_id: c1.id, project_id: p1.id, entry_date: dateOffset(-60), title: "1. Taksit — İnşaat Avansı", amount: 250000, paid_amount: 250000, currency: "TRY", rate: 1 },
    { customer_id: c1.id, project_id: p1.id, entry_date: dateOffset(-30), title: "2. Taksit — Temel Atımı", amount: 300000, paid_amount: 150000, currency: "TRY", rate: 1 },
    { customer_id: c1.id, project_id: p1.id, entry_date: dateOffset(30), title: "3. Taksit — Kaba İnşaat", amount: 300000, paid_amount: 0, currency: "TRY", rate: 1 },
    { customer_id: c2.id, project_id: p2.id, entry_date: dateOffset(-90), title: "Kaparo Ödemesi", amount: 10000, paid_amount: 10000, currency: "USD", rate: 32.5 },
    { customer_id: c2.id, project_id: p2.id, entry_date: dateOffset(-45), title: "1. Ara Ödeme", amount: 25000, paid_amount: 15000, currency: "USD", rate: 32.8 },
  ];
  for (const e of customerEntries) {
    const id = uuid();
    const amountTry = toTRY(e.amount, e.rate);
    const paidTry = toTRY(e.paid_amount, e.rate);
    const status = autoStatus(e.amount, e.paid_amount, e.entry_date);
    const overdue = isOverdue(e.amount, e.paid_amount, e.entry_date);
    await conn.execute(
      `INSERT IGNORE INTO ak_customer_financial_entries
       (id, customer_id, project_id, entry_date, title, amount, paid_amount, currency, exchange_rate_to_try, is_exchange_rate_manual, exchange_rate_source, amount_try, paid_amount_try, status, is_overdue, account_type, payment_method, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'api', ?, ?, ?, ?, 'resmi', 'Banka Havalesi/EFT', NOW(), NOW())`,
      [id, e.customer_id, e.project_id, e.entry_date, e.title, e.amount, e.paid_amount, e.currency, e.rate, amountTry, paidTry, status, overdue]
    );
  }
  console.log(`  Seeded ${customerEntries.length} customer entries`);

  // 7. Seed employee financial entries (expense)
  console.log("\n→ Seeding ak_employee_financial_entries...");
  const employeeEntries = [
    { employee_id: em1.id, project_id: p1.id, entry_date: dateOffset(-55), title: "Ocak Maaşı", amount: 35000, paid_amount: 35000, currency: "TRY", rate: 1 },
    { employee_id: em1.id, project_id: p1.id, entry_date: dateOffset(-25), title: "Şubat Maaşı", amount: 35000, paid_amount: 20000, currency: "TRY", rate: 1 },
    { employee_id: em2.id, project_id: p2.id, entry_date: dateOffset(-55), title: "Ocak Maaşı", amount: 28000, paid_amount: 28000, currency: "TRY", rate: 1 },
    { employee_id: em2.id, project_id: p2.id, entry_date: dateOffset(-10), title: "Prim Ödemesi", amount: 5000, paid_amount: 0, currency: "TRY", rate: 1 },
  ];
  for (const e of employeeEntries) {
    const id = uuid();
    const amountTry = toTRY(e.amount, e.rate);
    const paidTry = toTRY(e.paid_amount, e.rate);
    const status = autoStatus(e.amount, e.paid_amount, e.entry_date);
    const overdue = isOverdue(e.amount, e.paid_amount, e.entry_date);
    await conn.execute(
      `INSERT IGNORE INTO ak_employee_financial_entries
       (id, employee_id, project_id, entry_date, title, amount, paid_amount, currency, exchange_rate_to_try, is_exchange_rate_manual, exchange_rate_source, amount_try, paid_amount_try, status, is_overdue, account_type, payment_method, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'default', ?, ?, ?, ?, 'gayri_resmi', 'Nakit', NOW(), NOW())`,
      [id, e.employee_id, e.project_id, e.entry_date, e.title, e.amount, e.paid_amount, e.currency, e.rate, amountTry, paidTry, status, overdue]
    );
  }
  console.log(`  Seeded ${employeeEntries.length} employee entries`);

  // 8. Seed supplier financial entries (expense)
  console.log("\n→ Seeding ak_supplier_financial_entries...");
  const supplierEntries = [
    { supplier_id: sup1Id, project_id: p1.id, entry_date: dateOffset(-50), title: "Çimento ve Demir Malzeme", amount: 85000, paid_amount: 85000, currency: "TRY", rate: 1 },
    { supplier_id: sup1Id, project_id: p1.id, entry_date: dateOffset(-20), title: "İkinci Sevk Malzeme", amount: 60000, paid_amount: 30000, currency: "TRY", rate: 1 },
    { supplier_id: sup2Id, project_id: p1.id, entry_date: dateOffset(-40), title: "Elektrik Tesisat İşçilik", amount: 45000, paid_amount: 45000, currency: "TRY", rate: 1 },
    { supplier_id: sup3Id, project_id: p2.id, entry_date: dateOffset(-15), title: "Vinç Kiralama (3 gün)", amount: 12000, paid_amount: 0, currency: "TRY", rate: 1 },
  ];
  for (const e of supplierEntries) {
    const id = uuid();
    const amountTry = toTRY(e.amount, e.rate);
    const paidTry = toTRY(e.paid_amount, e.rate);
    const status = autoStatus(e.amount, e.paid_amount, e.entry_date);
    const overdue = isOverdue(e.amount, e.paid_amount, e.entry_date);
    await conn.execute(
      `INSERT IGNORE INTO ak_supplier_financial_entries
       (id, supplier_id, project_id, entry_date, title, amount, paid_amount, currency, exchange_rate_to_try, is_exchange_rate_manual, exchange_rate_source, amount_try, paid_amount_try, status, is_overdue, account_type, payment_method, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'default', ?, ?, ?, ?, 'resmi', 'Banka Havalesi/EFT', NOW(), NOW())`,
      [id, e.supplier_id, e.project_id, e.entry_date, e.title, e.amount, e.paid_amount, e.currency, e.rate, amountTry, paidTry, status, overdue]
    );
  }
  console.log(`  Seeded ${supplierEntries.length} supplier entries`);

  // 9. Seed expense card financial entries (expense)
  console.log("\n→ Seeding ak_expense_card_financial_entries...");
  const expenseCardEntries = [
    { expense_card_id: ec1.id, project_id: p1.id, entry_date: dateOffset(-45), title: "Şantiye Genel Giderleri", amount: 8500, paid_amount: 8500, currency: "TRY", rate: 1 },
    { expense_card_id: ec1.id, project_id: p1.id, entry_date: dateOffset(-15), title: "Araç Yakıt Gideri", amount: 3200, paid_amount: 1500, currency: "TRY", rate: 1 },
    { expense_card_id: ec2.id, project_id: p2.id, entry_date: dateOffset(-30), title: "Kırtasiye ve Büro Malzemeleri", amount: 1200, paid_amount: 1200, currency: "TRY", rate: 1 },
  ];
  for (const e of expenseCardEntries) {
    const id = uuid();
    const amountTry = toTRY(e.amount, e.rate);
    const paidTry = toTRY(e.paid_amount, e.rate);
    const status = autoStatus(e.amount, e.paid_amount, e.entry_date);
    const overdue = isOverdue(e.amount, e.paid_amount, e.entry_date);
    await conn.execute(
      `INSERT IGNORE INTO ak_expense_card_financial_entries
       (id, expense_card_id, project_id, entry_date, title, amount, paid_amount, currency, exchange_rate_to_try, is_exchange_rate_manual, exchange_rate_source, amount_try, paid_amount_try, status, is_overdue, account_type, payment_method, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'default', ?, ?, ?, ?, 'gayri_resmi', 'Nakit', NOW(), NOW())`,
      [id, e.expense_card_id, e.project_id, e.entry_date, e.title, e.amount, e.paid_amount, e.currency, e.rate, amountTry, paidTry, status, overdue]
    );
  }
  console.log(`  Seeded ${expenseCardEntries.length} expense card entries`);

  // 10. Print summary
  console.log("\n── Summary ──────────────────────────────────────────");
  const [custRows] = await conn.execute("SELECT COUNT(*) AS n, SUM(amount_try) AS total FROM ak_customer_financial_entries");
  const [empRows] = await conn.execute("SELECT COUNT(*) AS n, SUM(amount_try) AS total FROM ak_employee_financial_entries");
  const [supRows] = await conn.execute("SELECT COUNT(*) AS n, SUM(amount_try) AS total FROM ak_supplier_financial_entries");
  const [ecRows] = await conn.execute("SELECT COUNT(*) AS n, SUM(amount_try) AS total FROM ak_expense_card_financial_entries");
  const fmt = (v) => "₺" + Number(v || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 });
  console.log(`  Customer entries : ${custRows[0].n} rows, ${fmt(custRows[0].total)} planned income`);
  console.log(`  Employee entries : ${empRows[0].n} rows, ${fmt(empRows[0].total)} planned expense`);
  console.log(`  Supplier entries : ${supRows[0].n} rows, ${fmt(supRows[0].total)} planned expense`);
  console.log(`  Expense card ent.: ${ecRows[0].n} rows, ${fmt(ecRows[0].total)} planned expense`);
  const totalIncome = Number(custRows[0].total || 0);
  const totalExpense = Number(empRows[0].total || 0) + Number(supRows[0].total || 0) + Number(ecRows[0].total || 0);
  console.log(`  Planned profit   : ${fmt(totalIncome - totalExpense)}`);
  console.log("── Done ─────────────────────────────────────────────");

  await conn.end();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
