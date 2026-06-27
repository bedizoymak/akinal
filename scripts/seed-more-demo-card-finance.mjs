/**
 * scripts/seed-more-demo-card-finance.mjs
 *
 * Expanded demo seed — richer data for production handover demo.
 * Safe to run multiple times: skips rows that already exist by title per owner.
 *
 * Tables touched:
 *   ak_projects                        (ensures 4 exist)
 *   ak_customers                       (ensures 4 exist)
 *   ak_employees                       (ensures 4 exist)
 *   ak_suppliers                       (ensures 5 exist)
 *   ak_expense_cards                   (ensures 8 named cards exist)
 *   ak_customer_financial_entries      (14 income entries)
 *   ak_employee_financial_entries      (13 expense entries)
 *   ak_supplier_financial_entries      (12 expense entries)
 *   ak_expense_card_financial_entries  (13 expense entries)
 *
 * Prerequisites:
 *   npm install mysql2
 *   DB_HOST / DB_USER / DB_PASS / DB_NAME env vars (or edit DB block below)
 *
 * Usage:
 *   DB_NAME=akinalin_wp282 DB_USER=xxx DB_PASS=yyy node scripts/seed-more-demo-card-finance.mjs
 */

import mysql from "mysql2/promise";

const DB = {
  host:     process.env.DB_HOST || "localhost",
  user:     process.env.DB_USER || "root",
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

// ── Idempotent master-record helpers ──────────────────────────────────────────

async function ensureProject(conn, slug, f) {
  const [rows] = await conn.execute(
    "SELECT id FROM ak_projects WHERE slug = ? LIMIT 1", [slug]
  );
  if (rows.length > 0) { console.log(`  ↳ project '${f.title}' already exists`); return rows[0].id; }
  const id = uuid();
  await conn.execute(
    `INSERT INTO ak_projects
     (id, title, slug, short_description, project_type, project_status, location, city, district, start_year, delivery_year, is_published, is_featured, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, NOW(), NOW())`,
    [id, f.title, slug, f.desc, f.type, f.status, f.location, f.city ?? null, f.district ?? null, f.start ?? null, f.end ?? null]
  );
  console.log(`  ↳ created project '${f.title}'`);
  return id;
}

async function ensureCustomer(conn, fullName, f = {}) {
  const [rows] = await conn.execute(
    "SELECT id FROM ak_customers WHERE full_name = ? LIMIT 1", [fullName]
  );
  if (rows.length > 0) { console.log(`  ↳ customer '${fullName}' already exists`); return rows[0].id; }
  const id = uuid();
  await conn.execute(
    `INSERT INTO ak_customers (id, customer_type, full_name, phone, city, district, status, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'Aktif', ?, NOW(), NOW())`,
    [id, f.type ?? "Bireysel", fullName, f.phone ?? "", f.city ?? null, f.district ?? null, f.notes ?? null]
  );
  console.log(`  ↳ created customer '${fullName}'`);
  return id;
}

async function ensureEmployee(conn, fullName, f = {}) {
  const [rows] = await conn.execute(
    "SELECT id FROM ak_employees WHERE full_name = ? LIMIT 1", [fullName]
  );
  if (rows.length > 0) { console.log(`  ↳ employee '${fullName}' already exists`); return rows[0].id; }
  const id = uuid();
  await conn.execute(
    `INSERT INTO ak_employees (id, full_name, phone, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'Aktif', NOW(), NOW())`,
    [id, fullName, f.phone ?? null, f.role ?? null]
  );
  console.log(`  ↳ created employee '${fullName}'`);
  return id;
}

async function ensureSupplier(conn, name, f = {}) {
  const [rows] = await conn.execute(
    "SELECT id FROM ak_suppliers WHERE name = ? LIMIT 1", [name]
  );
  if (rows.length > 0) { console.log(`  ↳ supplier '${name}' already exists`); return rows[0].id; }
  const id = uuid();
  await conn.execute(
    `INSERT INTO ak_suppliers (id, name, supplier_type, contact_person, phone, city, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [id, name, f.type ?? "other", f.contact ?? null, f.phone ?? null, f.city ?? null]
  );
  console.log(`  ↳ created supplier '${name}'`);
  return id;
}

async function ensureExpenseCard(conn, name) {
  const [rows] = await conn.execute(
    "SELECT id FROM ak_expense_cards WHERE name = ? LIMIT 1", [name]
  );
  if (rows.length > 0) { console.log(`  ↳ expense card '${name}' already exists`); return rows[0].id; }
  const id = uuid();
  await conn.execute("INSERT INTO ak_expense_cards (id, name) VALUES (?, ?)", [id, name]);
  console.log(`  ↳ created expense card '${name}'`);
  return id;
}

// ── Idempotent financial-entry insert ─────────────────────────────────────────
// Dedup key: (ownerField = ownerValue) + title.  Date is excluded so re-runs on
// different days don't create duplicates.

async function insertEntry(conn, table, ownerField, ownerValue, projectId, e) {
  const [existing] = await conn.execute(
    `SELECT id FROM \`${table}\` WHERE \`${ownerField}\` = ? AND title = ? LIMIT 1`,
    [ownerValue, e.title]
  );
  if (existing.length > 0) return "skipped";

  const id        = uuid();
  const rate      = e.rate ?? 1;
  const amount    = e.amount ?? 0;
  const paid      = e.paid_amount ?? 0;
  const currency  = e.currency ?? "TRY";
  const amountTry = toTRY(amount, rate);
  const paidTry   = toTRY(paid, rate);
  const status    = autoStatus(amount, paid, e.entry_date);
  const overdue   = isOverdue(amount, paid, e.entry_date);
  const rateSource = (rate === 1 && currency === "TRY") ? "default" : "api";
  const acct      = e.account_type ?? "resmi";
  const method    = e.payment_method ?? "Banka Havalesi/EFT";

  await conn.execute(
    `INSERT INTO \`${table}\`
     (id, \`${ownerField}\`, project_id, entry_date, title, notes,
      amount, paid_amount, currency, exchange_rate_to_try, is_exchange_rate_manual, exchange_rate_source,
      amount_try, paid_amount_try, status, is_overdue, account_type, payment_method, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, ownerValue, projectId, e.entry_date, e.title,
     amount, paid, currency, rate, rateSource,
     amountTry, paidTry, status, overdue, acct, method]
  );
  return "inserted";
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const conn = await mysql.createConnection(DB);
  console.log("Connected to", DB.database);

  const tally = {};
  const track = (table, r) => {
    tally[table] = tally[table] ?? { inserted: 0, skipped: 0 };
    tally[table][r]++;
  };

  // ── 1. Projects (4) ─────────────────────────────────────────────────────────
  console.log("\n→ Ensuring projects...");
  const p1 = await ensureProject(conn, "demo-rezidans-atasehir", {
    title: "Ataşehir Rezidans Projesi",
    desc:  "Ataşehir'de kentsel dönüşüm kapsamında 48 daireli modern rezidans.",
    type:  "Konut", status: "Devam Ediyor",
    location: "Ataşehir, İstanbul", city: "İstanbul", district: "Ataşehir",
    start: "2024", end: "2026",
  });
  const p2 = await ensureProject(conn, "demo-kentsel-bayrampasa", {
    title: "Bayrampaşa Kentsel Dönüşüm",
    desc:  "Bayrampaşa'da 60 daireli kentsel dönüşüm projesi.",
    type:  "Kentsel Dönüşüm", status: "Devam Ediyor",
    location: "Bayrampaşa, İstanbul", city: "İstanbul", district: "Bayrampaşa",
    start: "2023", end: "2025",
  });
  const p3 = await ensureProject(conn, "demo-konut-kartal", {
    title: "Kartal Konut Kompleksi",
    desc:  "Kartal'da 3 blok, 120 daireli konut kompleksi.",
    type:  "Konut", status: "Tamamlandı",
    location: "Kartal, İstanbul", city: "İstanbul", district: "Kartal",
    start: "2022", end: "2024",
  });
  const p4 = await ensureProject(conn, "demo-villa-pendik", {
    title: "Pendik Villa Sitesi",
    desc:  "Pendik'te müstakil 12 villa sitesi.",
    type:  "Villa", status: "Devam Ediyor",
    location: "Pendik, İstanbul", city: "İstanbul", district: "Pendik",
    start: "2024", end: "2025",
  });

  // ── 2. Customers (4) ────────────────────────────────────────────────────────
  console.log("\n→ Ensuring customers...");
  const c1 = await ensureCustomer(conn, "Ahmet Yıldız",
    { phone: "0532 100 1122", city: "İstanbul", district: "Ataşehir",
      notes: "Proje yatırımcısı, 2 daire sahibi." });
  const c2 = await ensureCustomer(conn, "Fatma Kaya",
    { phone: "0533 200 3344", city: "İstanbul", district: "Pendik" });
  const c3 = await ensureCustomer(conn, "Murat Arslan",
    { phone: "0541 300 5566", city: "İstanbul", district: "Bayrampaşa" });
  const c4 = await ensureCustomer(conn, "Kaya Yapı Kooperatifi",
    { type: "Kurumsal", phone: "0212 400 7788", city: "İstanbul", district: "Kartal" });

  // ── 3. Employees (4) ────────────────────────────────────────────────────────
  console.log("\n→ Ensuring employees...");
  const em1 = await ensureEmployee(conn, "Mehmet Çelik",   { phone: "0535 111 2233", role: "Usta Başı" });
  const em2 = await ensureEmployee(conn, "Hasan Demir",    { phone: "0536 222 3344", role: "Elektrikçi" });
  const em3 = await ensureEmployee(conn, "Ali Kaya",       { phone: "0537 333 4455", role: "Kalıpçı Ustası" });
  const em4 = await ensureEmployee(conn, "İbrahim Yılmaz", { phone: "0538 444 5566", role: "İnşaat İşçisi" });

  // ── 4. Suppliers (5) ────────────────────────────────────────────────────────
  console.log("\n→ Ensuring suppliers...");
  const s1 = await ensureSupplier(conn, "Yılmaz Demir İnşaat Malzemeleri Ltd.",
    { type: "supplier",       contact: "Murat Yılmaz",  phone: "0532 111 2233", city: "İstanbul" });
  const s2 = await ensureSupplier(conn, "Ahsen Elektrik Taahhüt",
    { type: "subcontractor",  contact: "Ahsen Kaya",    phone: "0533 444 5566", city: "Ankara" });
  const s3 = await ensureSupplier(conn, "Kadir Vinç Kiralama",
    { type: "crane_rental",   contact: "Kadir Şahin",   phone: "0541 888 7766", city: "İstanbul" });
  const s4 = await ensureSupplier(conn, "Beton Plus A.Ş.",
    { type: "supplier",       contact: "Selim Aktaş",   phone: "0544 555 6677", city: "İstanbul" });
  const s5 = await ensureSupplier(conn, "Güven Nakliyat Kooperatifi",
    { type: "labor_service",  contact: "Tuncay Güven",  phone: "0545 666 7788", city: "İstanbul" });

  // ── 5. Expense cards (8) ────────────────────────────────────────────────────
  console.log("\n→ Ensuring expense cards...");
  const ec1 = await ensureExpenseCard(conn, "Demir");
  const ec2 = await ensureExpenseCard(conn, "Çimento");
  const ec3 = await ensureExpenseCard(conn, "Beton");
  const ec4 = await ensureExpenseCard(conn, "Nakliye");
  const ec5 = await ensureExpenseCard(conn, "Hafriyat");
  const ec6 = await ensureExpenseCard(conn, "Ruhsat ve Harçlar");
  const ec7 = await ensureExpenseCard(conn, "Elektrik İşleri");
  const ec8 = await ensureExpenseCard(conn, "İş Güvenliği");

  // ── 6. Customer financial entries — income (14) ──────────────────────────────
  console.log("\n→ Seeding ak_customer_financial_entries...");
  const custEntries = [
    // Ahmet Yıldız — Ataşehir Rezidans (4 entries, mixed statuses)
    { cid: c1, pid: p1, entry_date: dateOffset(-120), title: "Ön Kaparo — Ahmet Yıldız",        amount: 150000, paid_amount: 150000, currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { cid: c1, pid: p1, entry_date: dateOffset(-90),  title: "1. Taksit — Temel Atımı",          amount: 350000, paid_amount: 350000, currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { cid: c1, pid: p1, entry_date: dateOffset(-45),  title: "2. Taksit — Kaba İnşaat",          amount: 350000, paid_amount: 200000, currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Çek" },
    { cid: c1, pid: p1, entry_date: dateOffset(60),   title: "3. Taksit — Çatı Kapatma",         amount: 350000, paid_amount: 0,      currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    // Fatma Kaya — Pendik Villa (3 entries, USD)
    { cid: c2, pid: p4, entry_date: dateOffset(-100), title: "Kaparo — Fatma Kaya",              amount: 15000,  paid_amount: 15000,  currency: "USD", rate: 32.5, account_type: "gayri_resmi", payment_method: "Nakit" },
    { cid: c2, pid: p4, entry_date: dateOffset(-60),  title: "1. Ara Ödeme — İskelet",           amount: 30000,  paid_amount: 20000,  currency: "USD", rate: 33.0, account_type: "gayri_resmi", payment_method: "Nakit" },
    { cid: c2, pid: p4, entry_date: dateOffset(30),   title: "2. Ara Ödeme — Teslim Öncesi",     amount: 30000,  paid_amount: 0,      currency: "USD", rate: 33.0, account_type: "gayri_resmi", payment_method: "Banka Havalesi/EFT" },
    // Murat Arslan — Bayrampaşa (3 entries, partial + overdue)
    { cid: c3, pid: p2, entry_date: dateOffset(-80),  title: "Kaparo — Murat Arslan",            amount: 50000,  paid_amount: 50000,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { cid: c3, pid: p2, entry_date: dateOffset(-30),  title: "1. Taksit — Yıkım Sonrası",        amount: 120000, paid_amount: 60000,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Çek" },
    { cid: c3, pid: p2, entry_date: dateOffset(-10),  title: "2. Taksit — Gecikmiş",             amount: 120000, paid_amount: 0,      currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    // Kaya Yapı Kooperatifi — Kartal (4 entries, large values)
    { cid: c4, pid: p3, entry_date: dateOffset(-150), title: "1. Hakediş — Kaya Kooperatif",     amount: 500000, paid_amount: 500000, currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { cid: c4, pid: p3, entry_date: dateOffset(-90),  title: "2. Hakediş — Kaya Kooperatif",     amount: 450000, paid_amount: 450000, currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { cid: c4, pid: p3, entry_date: dateOffset(-20),  title: "3. Hakediş — Kaya Kooperatif",     amount: 400000, paid_amount: 200000, currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { cid: c4, pid: p3, entry_date: dateOffset(45),   title: "4. Hakediş — Teslim Öncesi",       amount: 350000, paid_amount: 0,      currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
  ];
  for (const e of custEntries) {
    track("ak_customer_financial_entries", await insertEntry(conn, "ak_customer_financial_entries", "customer_id", e.cid, e.pid, e));
  }
  const cc = tally["ak_customer_financial_entries"] ?? {};
  console.log(`  ${cc.inserted ?? 0} inserted, ${cc.skipped ?? 0} skipped`);

  // ── 7. Employee financial entries — expense (13) ──────────────────────────────
  console.log("\n→ Seeding ak_employee_financial_entries...");
  const empEntries = [
    // Mehmet Çelik (usta başı)
    { eid: em1, pid: p1, entry_date: dateOffset(-90),  title: "Nisan Maaşı — Mehmet Çelik",     amount: 42000, paid_amount: 42000, currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    { eid: em1, pid: p1, entry_date: dateOffset(-60),  title: "Mayıs Maaşı — Mehmet Çelik",     amount: 42000, paid_amount: 42000, currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    { eid: em1, pid: p2, entry_date: dateOffset(-30),  title: "Haziran Maaşı — Mehmet Çelik",   amount: 42000, paid_amount: 21000, currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    { eid: em1, pid: p1, entry_date: dateOffset(-15),  title: "Prim — Temel Teslim Ödülü",      amount: 8000,  paid_amount: 8000,  currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    // Hasan Demir (elektrikçi)
    { eid: em2, pid: p1, entry_date: dateOffset(-90),  title: "Nisan Maaşı — Hasan Demir",      amount: 38000, paid_amount: 38000, currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    { eid: em2, pid: p1, entry_date: dateOffset(-60),  title: "Mayıs Maaşı — Hasan Demir",      amount: 38000, paid_amount: 38000, currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    { eid: em2, pid: p3, entry_date: dateOffset(-20),  title: "Avans — Hasan Demir",             amount: 10000, paid_amount: 10000, currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    // Ali Kaya (kalıpçı)
    { eid: em3, pid: p2, entry_date: dateOffset(-90),  title: "Nisan Maaşı — Ali Kaya",         amount: 35000, paid_amount: 35000, currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    { eid: em3, pid: p2, entry_date: dateOffset(-60),  title: "Mayıs Maaşı — Ali Kaya",         amount: 35000, paid_amount: 35000, currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    { eid: em3, pid: p4, entry_date: dateOffset(-8),   title: "Haziran Maaşı — Ali Kaya",       amount: 35000, paid_amount: 0,     currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    // İbrahim Yılmaz (işçi)
    { eid: em4, pid: p3, entry_date: dateOffset(-90),  title: "Nisan Maaşı — İbrahim Yılmaz",   amount: 28000, paid_amount: 28000, currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    { eid: em4, pid: p3, entry_date: dateOffset(-60),  title: "Mayıs Maaşı — İbrahim Yılmaz",   amount: 28000, paid_amount: 28000, currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    { eid: em4, pid: p4, entry_date: dateOffset(-5),   title: "Fazla Mesai — İbrahim Yılmaz",   amount: 4500,  paid_amount: 0,     currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
  ];
  for (const e of empEntries) {
    track("ak_employee_financial_entries", await insertEntry(conn, "ak_employee_financial_entries", "employee_id", e.eid, e.pid, e));
  }
  const ec = tally["ak_employee_financial_entries"] ?? {};
  console.log(`  ${ec.inserted ?? 0} inserted, ${ec.skipped ?? 0} skipped`);

  // ── 8. Supplier financial entries — expense (12) ──────────────────────────────
  console.log("\n→ Seeding ak_supplier_financial_entries...");
  const supEntries = [
    // Yılmaz Demir
    { sid: s1, pid: p1, entry_date: dateOffset(-100), title: "Demir/Çelik Sevkiyatı #1 — Ataşehir",   amount: 280000, paid_amount: 280000, currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { sid: s1, pid: p1, entry_date: dateOffset(-50),  title: "Demir/Çelik Sevkiyatı #2 — Ataşehir",   amount: 220000, paid_amount: 110000, currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Çek" },
    { sid: s1, pid: p2, entry_date: dateOffset(-70),  title: "İnşaat Malzemesi — Bayrampaşa",          amount: 95000,  paid_amount: 95000,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    // Ahsen Elektrik
    { sid: s2, pid: p1, entry_date: dateOffset(-85),  title: "Elektrik Tesisat İşçilik #1",            amount: 78000,  paid_amount: 78000,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { sid: s2, pid: p3, entry_date: dateOffset(-40),  title: "Elektrik Tesisat — Kartal Proje",        amount: 55000,  paid_amount: 30000,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { sid: s2, pid: p4, entry_date: dateOffset(-12),  title: "Güç Dağıtım Tablosu — Pendik",           amount: 28000,  paid_amount: 0,      currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    // Kadir Vinç
    { sid: s3, pid: p1, entry_date: dateOffset(-60),  title: "Vinç Kiralama — 5 Gün Ataşehir",        amount: 18000,  paid_amount: 18000,  currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    { sid: s3, pid: p2, entry_date: dateOffset(-20),  title: "Vinç Kiralama — 3 Gün Bayrampaşa",      amount: 12000,  paid_amount: 0,      currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    // Beton Plus
    { sid: s4, pid: p1, entry_date: dateOffset(-80),  title: "Hazır Beton — Ataşehir 1. Döküm",       amount: 145000, paid_amount: 145000, currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { sid: s4, pid: p4, entry_date: dateOffset(-35),  title: "Hazır Beton — Pendik Villa",             amount: 62000,  paid_amount: 40000,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    // Güven Nakliyat
    { sid: s5, pid: p2, entry_date: dateOffset(-55),  title: "Hafriyat Nakliyesi — Bayrampaşa",        amount: 35000,  paid_amount: 35000,  currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    { sid: s5, pid: p3, entry_date: dateOffset(-8),   title: "Moloz Nakliyesi — Kartal",               amount: 18000,  paid_amount: 0,      currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
  ];
  for (const e of supEntries) {
    track("ak_supplier_financial_entries", await insertEntry(conn, "ak_supplier_financial_entries", "supplier_id", e.sid, e.pid, e));
  }
  const sc = tally["ak_supplier_financial_entries"] ?? {};
  console.log(`  ${sc.inserted ?? 0} inserted, ${sc.skipped ?? 0} skipped`);

  // ── 9. Expense card financial entries — expense (13) ──────────────────────────
  console.log("\n→ Seeding ak_expense_card_financial_entries...");
  const ecEntries = [
    // Demir
    { ecid: ec1, pid: p1, entry_date: dateOffset(-95),  title: "Demir Alımı — Ataşehir 1. Sevk",       amount: 185000, paid_amount: 185000, currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { ecid: ec1, pid: p2, entry_date: dateOffset(-55),  title: "Demir Alımı — Bayrampaşa",              amount: 120000, paid_amount: 80000,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Çek" },
    // Çimento
    { ecid: ec2, pid: p1, entry_date: dateOffset(-88),  title: "Çimento 500 Ton — Ataşehir",            amount: 95000,  paid_amount: 95000,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { ecid: ec2, pid: p4, entry_date: dateOffset(-40),  title: "Çimento — Pendik Villa",                amount: 28000,  paid_amount: 28000,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    // Beton
    { ecid: ec3, pid: p1, entry_date: dateOffset(-75),  title: "Hazır Beton Döküm #1 — Ataşehir",      amount: 110000, paid_amount: 110000, currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { ecid: ec3, pid: p3, entry_date: dateOffset(-40),  title: "Beton Döküm — Kartal Konut",            amount: 65000,  paid_amount: 65000,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    // Nakliye
    { ecid: ec4, pid: p2, entry_date: dateOffset(-50),  title: "Nakliye Hizmeti — Bayrampaşa",          amount: 22000,  paid_amount: 22000,  currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    { ecid: ec4, pid: p4, entry_date: dateOffset(-12),  title: "Nakliye — Pendik Malzeme",              amount: 9500,   paid_amount: 0,      currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    // Hafriyat
    { ecid: ec5, pid: p2, entry_date: dateOffset(-110), title: "Hafriyat Çalışması — Bayrampaşa",       amount: 48000,  paid_amount: 48000,  currency: "TRY", rate: 1, account_type: "gayri_resmi", payment_method: "Nakit" },
    // Ruhsat ve Harçlar
    { ecid: ec6, pid: p1, entry_date: dateOffset(-130), title: "İmar Ruhsatı Harcı — Ataşehir",        amount: 35000,  paid_amount: 35000,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { ecid: ec6, pid: p4, entry_date: dateOffset(-50),  title: "Yapı Denetim Harcı — Pendik",          amount: 14500,  paid_amount: 14500,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    // Elektrik İşleri
    { ecid: ec7, pid: p1, entry_date: dateOffset(-70),  title: "Elektrik Altyapı — Ataşehir",          amount: 42000,  paid_amount: 25000,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    // İş Güvenliği
    { ecid: ec8, pid: p1, entry_date: dateOffset(-60),  title: "İSG Malzemeleri — Ataşehir",           amount: 12000,  paid_amount: 12000,  currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
    { ecid: ec8, pid: p2, entry_date: dateOffset(-30),  title: "İSG Eğitimi ve Teçhizat — Bayrampaşa", amount: 8500,   paid_amount: 0,      currency: "TRY", rate: 1, account_type: "resmi",      payment_method: "Banka Havalesi/EFT" },
  ];
  for (const e of ecEntries) {
    track("ak_expense_card_financial_entries", await insertEntry(conn, "ak_expense_card_financial_entries", "expense_card_id", e.ecid, e.pid, e));
  }
  const ecc = tally["ak_expense_card_financial_entries"] ?? {};
  console.log(`  ${ecc.inserted ?? 0} inserted, ${ecc.skipped ?? 0} skipped`);

  // ── 10. Summary ───────────────────────────────────────────────────────────────
  console.log("\n── DB Totals After Seed ─────────────────────────────");
  const [[projR]]  = await conn.execute("SELECT COUNT(*) AS n FROM ak_projects");
  const [[custMR]] = await conn.execute("SELECT COUNT(*) AS n FROM ak_customers");
  const [[empMR]]  = await conn.execute("SELECT COUNT(*) AS n FROM ak_employees");
  const [[supMR]]  = await conn.execute("SELECT COUNT(*) AS n FROM ak_suppliers");
  const [[ecMR]]   = await conn.execute("SELECT COUNT(*) AS n FROM ak_expense_cards");
  const [[custR]]  = await conn.execute("SELECT COUNT(*) AS n, SUM(amount_try) AS total FROM ak_customer_financial_entries");
  const [[empR]]   = await conn.execute("SELECT COUNT(*) AS n, SUM(amount_try) AS total FROM ak_employee_financial_entries");
  const [[supR]]   = await conn.execute("SELECT COUNT(*) AS n, SUM(amount_try) AS total FROM ak_supplier_financial_entries");
  const [[ecR]]    = await conn.execute("SELECT COUNT(*) AS n, SUM(amount_try) AS total FROM ak_expense_card_financial_entries");

  const fmt = (v) => "₺" + Number(v || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 });
  console.log(`  Projects              : ${projR.n}`);
  console.log(`  Customers             : ${custMR.n}`);
  console.log(`  Employees             : ${empMR.n}`);
  console.log(`  Suppliers             : ${supMR.n}`);
  console.log(`  Expense cards         : ${ecMR.n}`);
  console.log(`  Customer entries      : ${custR.n} rows  — ${fmt(custR.total)} planned income`);
  console.log(`  Employee entries      : ${empR.n} rows  — ${fmt(empR.total)} planned expense`);
  console.log(`  Supplier entries      : ${supR.n} rows  — ${fmt(supR.total)} planned expense`);
  console.log(`  Expense card entries  : ${ecR.n} rows  — ${fmt(ecR.total)} planned expense`);

  const totalIncome  = Number(custR.total  || 0);
  const totalExpense = Number(empR.total   || 0)
                     + Number(supR.total   || 0)
                     + Number(ecR.total    || 0);
  console.log(`  Planned profit        : ${fmt(totalIncome - totalExpense)}`);

  console.log("\n── This Run ─────────────────────────────────────────");
  for (const [table, { inserted, skipped }] of Object.entries(tally)) {
    console.log(`  ${table.padEnd(42)} +${inserted} inserted, ${skipped} skipped`);
  }
  console.log("── Done ─────────────────────────────────────────────");

  await conn.end();
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
