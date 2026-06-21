import type { AdminSqlEditorResult } from "@/lib/apiTypes";

export type AdminSqlExecutionSnapshot =
  | {
      sql: string;
      result: AdminSqlEditorResult;
      error?: never;
    }
  | {
      sql: string;
      result?: never;
      error: string;
    };

export function escapeCsvValue(value: unknown): string {
  const text = value === null || value === undefined ? "NULL" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function serializeRows(columns: string[], rows: Record<string, unknown>[]): string[] {
  if (!columns.length || !rows.length) return ["NO_OUTPUT_ROWS"];

  return [
    columns.map(escapeCsvValue).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(",")),
  ];
}

export function serializeAdminSqlExecutionAsCsv(snapshot: AdminSqlExecutionSnapshot): string {
  const lines = ["SQL_COMMAND", escapeCsvValue(snapshot.sql), "", "SQL_OUTPUT"];

  if ("error" in snapshot) {
    return [...lines, "ERROR", escapeCsvValue(snapshot.error)].join("\n");
  }

  if (!snapshot.result.is_select) {
    return [...lines, "NO_OUTPUT_ROWS", ["AFFECTED_ROWS", escapeCsvValue(snapshot.result.affected_rows ?? 0)].join(",")].join("\n");
  }

  return [...lines, ...serializeRows(snapshot.result.columns, snapshot.result.rows)].join("\n");
}
