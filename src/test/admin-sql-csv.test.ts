import { describe, expect, it } from "vitest";
import { serializeAdminSqlExecutionAsCsv } from "@/lib/adminSqlCsv";
import type { AdminSqlEditorResult } from "@/lib/apiTypes";

function selectResult(overrides: Partial<AdminSqlEditorResult> = {}): AdminSqlEditorResult {
  return {
    statement_type: "SELECT",
    is_select: true,
    destructive: false,
    columns: ["id", "name"],
    rows: [],
    row_count: 0,
    affected_rows: null,
    executed_at: "2026-06-18T12:00:00Z",
    ...overrides,
  };
}

describe("serializeAdminSqlExecutionAsCsv", () => {
  it("copies the executed SQL command and SELECT rows as CSV", () => {
    const output = serializeAdminSqlExecutionAsCsv({
      sql: "SELECT id, name FROM ak_projects",
      result: selectResult({
        rows: [{ id: 1, name: "Akin" }],
        row_count: 1,
      }),
    });

    expect(output).toBe(["SQL_COMMAND", '"SELECT id, name FROM ak_projects"', "", "SQL_OUTPUT", "id,name", "1,Akin"].join("\n"));
  });

  it("escapes commas, quotes, and newlines", () => {
    const output = serializeAdminSqlExecutionAsCsv({
      sql: 'SELECT "quoted"',
      result: selectResult({
        columns: ["note"],
        rows: [{ note: 'hello, "world"\nnext line' }],
        row_count: 1,
      }),
    });

    expect(output).toBe(["SQL_COMMAND", '"SELECT ""quoted"""', "", "SQL_OUTPUT", "note", '"hello, ""world""\nnext line"'].join("\n"));
  });

  it("includes a readable message when SELECT returns no rows", () => {
    const output = serializeAdminSqlExecutionAsCsv({
      sql: "SELECT * FROM ak_projects WHERE id = -1",
      result: selectResult({ columns: ["id", "name"] }),
    });

    expect(output).toBe(["SQL_COMMAND", "SELECT * FROM ak_projects WHERE id = -1", "", "SQL_OUTPUT", "NO_OUTPUT_ROWS"].join("\n"));
  });

  it("copies the executed SQL command and error message", () => {
    const output = serializeAdminSqlExecutionAsCsv({
      sql: "SELECT * FROM missing_table",
      error: 'Table "missing_table" does not exist',
    });

    expect(output).toBe(
      ["SQL_COMMAND", "SELECT * FROM missing_table", "", "SQL_OUTPUT", "ERROR", '"Table ""missing_table"" does not exist"'].join("\n"),
    );
  });

  it("includes a readable message for successful statements without an output table", () => {
    const output = serializeAdminSqlExecutionAsCsv({
      sql: "UPDATE ak_projects SET title = title WHERE id = 1",
      result: {
        statement_type: "UPDATE",
        is_select: false,
        destructive: false,
        columns: [],
        rows: [],
        row_count: 0,
        affected_rows: 1,
        executed_at: "2026-06-18T12:00:00Z",
      },
    });

    expect(output).toBe(
      ["SQL_COMMAND", "UPDATE ak_projects SET title = title WHERE id = 1", "", "SQL_OUTPUT", "NO_OUTPUT_ROWS", "AFFECTED_ROWS,1"].join("\n"),
    );
  });
});
