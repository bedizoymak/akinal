#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tableMap = JSON.parse(fs.readFileSync(path.join(__dirname, "supabase-table-map.json"), "utf8"));

const importOrder = [
  "site_settings",
  "projects",
  "project_images",
  "media_library",
  "contact_requests",
  "cookie_consents",
  "customers",
  "customer_projects",
  "employees",
  "expense_cards",
  "payment_plans",
  "payments",
  "expenses",
  "customer_notes",
  "documents",
  "notifications",
  "financial_entries",
  "admin_users",
  "profiles",
  "user_roles",
];

const productionExcludedTables = new Set(["admin_users", "profiles", "user_roles"]);

const tableColumns = {
  admin_users: ["id", "email", "email_lower", "password_hash", "role", "is_active", "created_at"],
  profiles: ["id", "user_id", "email", "display_name", "created_at"],
  user_roles: ["id", "user_id", "role", "created_at"],
  projects: [
    "id", "title", "slug", "short_description", "detailed_description", "project_type", "project_status",
    "location", "city", "district", "start_year", "delivery_year", "land_area", "construction_area",
    "apartment_count", "floor_count", "block_count", "cover_image_url", "is_featured", "is_published",
    "sort_order", "seo_title", "seo_description", "created_at", "updated_at",
  ],
  project_images: ["id", "project_id", "image_url", "thumbnail_url", "title", "alt_text", "sort_order", "created_at"],
  media_library: ["id", "image_url", "thumbnail_url", "file_name", "title", "alt_text", "related_project_id", "created_at"],
  site_settings: [
    "id", "company_name", "phone", "whatsapp_number", "email", "address", "map_embed_url", "instagram_url",
    "facebook_url", "linkedin_url", "footer_description", "hero_title", "hero_subtitle", "whatsapp_message",
    "seo_title", "seo_description", "updated_at",
  ],
  contact_requests: ["id", "full_name", "phone", "email", "service_type", "message", "status", "created_at"],
  cookie_consents: ["id", "consent_status", "necessary", "analytics", "marketing", "user_agent", "created_at"],
  customers: [
    "id", "customer_type", "full_name", "company_name", "phone", "whatsapp", "email", "tax_or_identity_number",
    "address", "city", "district", "status", "notes", "created_at", "updated_at",
  ],
  customer_projects: ["id", "customer_id", "project_id", "created_at"],
  employees: ["id", "full_name", "phone", "role", "notes", "status", "created_at", "updated_at"],
  expense_cards: ["id", "name", "category", "description", "status", "created_at", "updated_at"],
  payment_plans: ["id", "customer_id", "project_id", "title", "description", "amount", "due_date", "status", "notes", "created_at", "updated_at"],
  payments: ["id", "customer_id", "project_id", "payment_plan_id", "amount", "payment_date", "payment_method", "description", "document_url", "created_at", "updated_at"],
  expenses: ["id", "project_id", "customer_id", "title", "category", "amount", "expense_date", "description", "document_url", "created_at", "updated_at"],
  customer_notes: ["id", "customer_id", "note", "created_at"],
  documents: ["id", "customer_id", "project_id", "title", "document_type", "file_url", "notes", "created_at"],
  notifications: ["id", "title", "message", "type", "priority", "related_customer_id", "related_project_id", "related_payment_plan_id", "is_read", "created_at"],
  financial_entries: [
    "id", "project_id", "entry_date", "card_type", "customer_id", "employee_id", "expense_card_id", "title",
    "description", "amount", "currency_tag", "group_tag", "direction", "status", "document_url", "created_at", "updated_at",
  ],
};

const requiredDefaults = {
  projects: { short_description: "", project_type: "", project_status: "", location: "", is_featured: 0, is_published: 0, sort_order: 0 },
  project_images: { sort_order: 0 },
  contact_requests: { status: "Yeni" },
  cookie_consents: { necessary: 1, analytics: 0, marketing: 0 },
  customers: { customer_type: "Bireysel", phone: "", status: "Aktif" },
  employees: { status: "Aktif" },
  expense_cards: { status: "Aktif" },
  payment_plans: { amount: 0, status: "Bekliyor" },
  payments: { amount: 0, payment_method: "Nakit" },
  expenses: { category: "Diğer", amount: 0 },
  documents: { document_type: "Diğer" },
  notifications: { type: "Genel", priority: "Orta", is_read: 0 },
  financial_entries: { amount: 0, currency_tag: "TRY", group_tag: "Resmi", status: "Gerçekleşti" },
  admin_users: { role: "admin", is_active: 1, password_hash: null },
};

const importantTextFields = [
  "title", "slug", "short_description", "detailed_description", "full_name", "company_name", "email", "phone",
  "notes", "message", "description", "seo_title", "seo_description", "file_url", "image_url", "cover_image_url",
  "document_url", "name", "category",
];

const booleanColumns = new Set(["is_featured", "is_published", "is_read", "is_active", "necessary", "analytics", "marketing"]);
const dateTimeColumns = new Set(["created_at", "updated_at"]);
const dateColumns = new Set(["due_date", "payment_date", "expense_date", "entry_date"]);
const urlColumns = new Set(["cover_image_url", "image_url", "thumbnail_url", "file_url", "document_url"]);

const args = parseArgs(process.argv.slice(2));
const mode = args.mode || (args.includeDemo ? "full-with-demo" : "production-clean");

if (!args.input || (!args.dryRun && !args.output)) {
  fail("Usage: node migration-tools/convert-supabase-json-to-mysql.mjs --input <file-or-folder> --mode production-clean --dry-run\n   or: node migration-tools/convert-supabase-json-to-mysql.mjs --input <file-or-folder> --mode production-clean --output <file.sql>");
}

if (!["production-clean", "full-with-demo"].includes(mode)) {
  fail(`Unknown mode "${mode}". Use production-clean or full-with-demo.`);
}

const exportPayload = loadInput(args.input);
const tables = exportPayload.tables;
const warnings = [];
const report = buildEmptyReport(exportPayload);
const includedRows = {};
const includedIds = {};

for (const sourceTable of Object.keys(tableMap)) {
  const rows = Array.isArray(tables[sourceTable]) ? tables[sourceTable] : [];
  report.tables[sourceTable] = {
    target_table: tableMap[sourceTable],
    source_row_count: rows.length,
    imported_row_count: 0,
    skipped_demo_count: 0,
    skipped_orphan_fk_count: 0,
    warnings_count: 0,
  };
}

selectRowsForImport();

const sqlLines = buildSql();
const summaryMarkdown = buildSummaryMarkdown(report, args, mode);

if (args.dryRun) {
  console.log(summaryMarkdown);
  if (warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of warnings) console.log(`- ${warning.message}`);
  }
} else {
  writeOutputs(args.output, sqlLines.join("\n") + "\n", report, summaryMarkdown);
}

function parseArgs(argv) {
  const parsed = { dryRun: false, includeDemo: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--include-demo") parsed.includeDemo = true;
    else if (arg === "--input") parsed.input = argv[++index];
    else if (arg === "--output") parsed.output = argv[++index];
    else if (arg === "--mode") parsed.mode = argv[++index];
  }
  return parsed;
}

function loadInput(inputPath) {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) fail(`Input path does not exist: ${inputPath}`);

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    const tablesFromDir = {};
    for (const sourceTable of Object.keys(tableMap)) {
      const file = path.join(resolved, `${sourceTable}.json`);
      if (fs.existsSync(file)) tablesFromDir[sourceTable] = readJson(file);
    }
    return { shape: "folder-per-table", metadata: {}, tables: tablesFromDir };
  }

  const payload = readJson(resolved);
  return extractTables(payload);
}

function extractTables(payload) {
  if (Array.isArray(payload) && payload.length === 1 && payload[0]?.full_export?.tables) {
    return { shape: "array[0].full_export.tables", metadata: omitTables(payload[0].full_export), tables: payload[0].full_export.tables };
  }
  if (!Array.isArray(payload) && payload?.full_export?.tables) {
    return { shape: "full_export.tables", metadata: omitTables(payload.full_export), tables: payload.full_export.tables };
  }
  if (!Array.isArray(payload) && payload?.tables) {
    return { shape: "tables", metadata: omitTables(payload), tables: payload.tables };
  }
  if (!Array.isArray(payload) && payload?.data && typeof payload.data === "object") {
    return { shape: "data", metadata: omitTables(payload), tables: payload.data };
  }
  if (!Array.isArray(payload) && Object.keys(tableMap).some((table) => Array.isArray(payload[table]))) {
    return { shape: "table-map-object", metadata: {}, tables: payload };
  }

  fail("Unknown JSON export shape. Expected array[0].full_export.tables, full_export.tables, tables, data, folder-per-table, or object with table arrays.");
}

function omitTables(value) {
  const copy = { ...value };
  delete copy.tables;
  delete copy.data;
  return copy;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`Failed to read JSON ${file}: ${error.message}`);
  }
}

function selectRowsForImport() {
  for (const sourceTable of importOrder) {
    if (!tableMap[sourceTable]) continue;
    const rows = Array.isArray(tables[sourceTable]) ? tables[sourceTable] : [];
    const selected = [];
    const idSet = new Set();

    if (mode === "production-clean" && productionExcludedTables.has(sourceTable)) {
      continue;
    }

    const rowsToEvaluate = sourceTable === "site_settings" ? latestRows(rows) : rows;
    for (const row of rowsToEvaluate) {
      if (!isPlainObject(row)) {
        warn(sourceTable, "Skipped malformed row.");
        continue;
      }

      if (mode === "production-clean" && sourceTable !== "site_settings" && isDemoRow(row)) {
        report.tables[sourceTable].skipped_demo_count++;
        continue;
      }

      if (mode === "production-clean" && !passesFkRules(sourceTable, row)) {
        report.tables[sourceTable].skipped_orphan_fk_count++;
        continue;
      }

      selected.push(row);
      if (row.id !== undefined && row.id !== null) idSet.add(String(row.id));
    }

    includedRows[sourceTable] = selected;
    includedIds[sourceTable] = idSet;
    report.tables[sourceTable].imported_row_count = selected.length;
  }
}

function latestRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const sorted = rows
    .filter(isPlainObject)
    .sort((a, b) => comparableDate(b.updated_at ?? b.created_at) - comparableDate(a.updated_at ?? a.created_at));
  return sorted[0] ? [sorted[0]] : [];
}

function comparableDate(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function passesFkRules(sourceTable, row) {
  const checks = {
    project_images: [["project_id", "projects", false]],
    media_library: [["related_project_id", "projects", true]],
    customer_projects: [["customer_id", "customers", false], ["project_id", "projects", false]],
    payment_plans: [["customer_id", "customers", true], ["project_id", "projects", true]],
    payments: [["customer_id", "customers", true], ["project_id", "projects", true], ["payment_plan_id", "payment_plans", true]],
    expenses: [["customer_id", "customers", true], ["project_id", "projects", true]],
    customer_notes: [["customer_id", "customers", false]],
    documents: [["customer_id", "customers", true], ["project_id", "projects", true]],
    notifications: [["related_customer_id", "customers", true], ["related_project_id", "projects", true], ["related_payment_plan_id", "payment_plans", true]],
    financial_entries: [["project_id", "projects", true], ["customer_id", "customers", true], ["employee_id", "employees", true], ["expense_card_id", "expense_cards", true]],
  }[sourceTable] || [];

  for (const [field, parentTable, nullable] of checks) {
    const value = row[field];
    if (value === null || value === undefined || value === "") {
      if (nullable) continue;
      warn(sourceTable, `Skipped row ${row.id ?? "(no id)"} because ${field} is required.`);
      return false;
    }
    if (!includedIds[parentTable]?.has(String(value))) {
      warn(sourceTable, `Skipped row ${row.id ?? "(no id)"} because ${field}=${value} is not included in ${parentTable}.`);
      return false;
    }
  }
  return true;
}

function buildSql() {
  const lines = [
    "-- Generated by migration-tools/convert-supabase-json-to-mysql.mjs",
    "-- Mode: " + mode,
    "-- Review manually before production import. Do not commit this file.",
    "SET NAMES utf8mb4;",
    "-- Foreign keys should remain valid because rows are filtered and ordered by dependency.",
    "",
  ];

  for (const sourceTable of importOrder) {
    const targetTable = tableMap[sourceTable];
    if (!targetTable) continue;
    if (mode === "production-clean" && productionExcludedTables.has(sourceTable)) continue;

    const rows = includedRows[sourceTable] || [];
    const columns = tableColumns[sourceTable];
    if (!columns) {
      warn(sourceTable, `No target column list for ${sourceTable}; skipped SQL generation.`);
      continue;
    }

    lines.push(`-- ${sourceTable} -> ${targetTable}: ${rows.length} imported rows`);
    for (const row of rows) {
      const normalized = normalizeRow(sourceTable, row, columns);
      lines.push(buildUpsert(targetTable, columns, normalized));
    }
    lines.push("");
  }

  return lines;
}

function normalizeRow(sourceTable, originalRow, columns) {
  const row = {};
  for (const column of columns) {
    let value;
    if (sourceTable === "admin_users" && column === "email_lower") {
      value = originalRow.email ? String(originalRow.email).toLowerCase() : null;
    } else if (sourceTable === "admin_users" && column === "password_hash") {
      value = null;
    } else {
      value = originalRow[column] ?? requiredDefaults[sourceTable]?.[column] ?? null;
    }

    if (booleanColumns.has(column)) value = normalizeBoolean(value);
    else if (dateTimeColumns.has(column)) value = normalizeDateTime(value);
    else if (dateColumns.has(column)) value = normalizeDate(value);
    else if (typeof value === "object" && value !== null) value = JSON.stringify(value);

    if (urlColumns.has(column)) value = normalizePathValue(sourceTable, column, value, originalRow);
    row[column] = value;
  }
  return row;
}

function normalizeBoolean(value) {
  if (value === true) return 1;
  if (value === false || value === null || value === undefined) return 0;
  if (typeof value === "number") return value === 1 ? 1 : 0;
  return ["1", "true", "yes", "evet"].includes(String(value).toLowerCase()) ? 1 : 0;
}

function normalizeDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeDate(value) {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizePathValue(sourceTable, column, value, row) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const trimmed = value.trim();
  const rowId = row.id ?? row.slug ?? "unknown";
  if (trimmed.startsWith("/src/assets/")) {
    warn(sourceTable, `${column} for row ${rowId} used ${trimmed}; converted to NULL.`);
    return null;
  }
  if (trimmed.startsWith("/uploads/")) return trimmed;
  if (isSupabaseStorageUrl(trimmed)) {
    warn(sourceTable, `${column} for row ${rowId}: Storage file must be downloaded and URL rewritten later.`);
  }
  return trimmed;
}

function isSupabaseStorageUrl(value) {
  return /^https?:\/\/[^/]*supabase\.[^/]+\/storage\/v1\/object\//.test(value) ||
    value.includes("/storage/v1/object/public/");
}

function isDemoRow(row) {
  return importantTextFields.some((field) => {
    const value = row[field];
    return typeof value === "string" && value.includes("DEMO_DATA");
  });
}

function buildUpsert(targetTable, columns, row) {
  const quotedColumns = columns.map((column) => `\`${column}\``).join(", ");
  const values = columns.map((column) => sqlValue(row[column])).join(", ");
  const updates = columns
    .filter((column) => column !== "id")
    .map((column) => `\`${column}\` = VALUES(\`${column}\`)`)
    .join(", ");
  return `INSERT INTO \`${targetTable}\` (${quotedColumns}) VALUES (${values}) ON DUPLICATE KEY UPDATE ${updates};`;
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function buildEmptyReport(exportPayload) {
  return {
    mode,
    dry_run: args.dryRun,
    input: args.input,
    output: args.output || null,
    export_shape_detected: exportPayload.shape,
    export_metadata: exportPayload.metadata,
    generated_at: new Date().toISOString(),
    intentionally_not_imported_in_production_clean: mode === "production-clean" ? Array.from(productionExcludedTables) : [],
    tables: {},
    warnings: warnings,
  };
}

function buildSummaryMarkdown(data, cliArgs, selectedMode) {
  const lines = [
    "# Supabase JSON Migration Summary",
    "",
    `- Mode: ${selectedMode}`,
    `- Dry run: ${cliArgs.dryRun ? "yes" : "no"}`,
    `- Export shape detected: ${data.export_shape_detected}`,
    "",
    "| Source table | Target table | Source rows | Imported | Skipped demo | Skipped orphan FK | Warnings |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const sourceTable of Object.keys(tableMap)) {
    const row = data.tables[sourceTable];
    if (!row) continue;
    lines.push(`| ${sourceTable} | ${row.target_table} | ${row.source_row_count} | ${row.imported_row_count} | ${row.skipped_demo_count} | ${row.skipped_orphan_fk_count} | ${row.warnings_count} |`);
  }

  lines.push("");
  lines.push("Generated SQL and reports may contain production data. Do not commit them.");
  return lines.join("\n");
}

function writeOutputs(sqlPath, sqlBody, data, summaryMarkdown) {
  const resolvedSqlPath = path.resolve(sqlPath);
  fs.mkdirSync(path.dirname(resolvedSqlPath), { recursive: true });
  fs.writeFileSync(resolvedSqlPath, sqlBody, "utf8");

  const base = resolvedSqlPath.endsWith(".sql") ? resolvedSqlPath.slice(0, -4) : resolvedSqlPath;
  const reportPath = `${base}-report.json`;
  const summaryPath = `${base}-summary.md`;
  fs.writeFileSync(reportPath, JSON.stringify(data, null, 2), "utf8");
  fs.writeFileSync(summaryPath, summaryMarkdown + "\n", "utf8");

  console.log(`Wrote ${path.relative(process.cwd(), resolvedSqlPath)}`);
  console.log(`Wrote ${path.relative(process.cwd(), reportPath)}`);
  console.log(`Wrote ${path.relative(process.cwd(), summaryPath)}`);
}

function warn(sourceTable, message) {
  warnings.push({ table: sourceTable, message });
  if (report.tables[sourceTable]) report.tables[sourceTable].warnings_count++;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(message) {
  console.error(`Migration converter error: ${message}`);
  process.exit(1);
}
