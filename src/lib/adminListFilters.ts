// Shared client-side sort/URL-param helpers for the Gelenler and Gidenler list pages.
// Both pages fetch pre-filtered rows from their own endpoint (status/date_from/date_to/q/etc.
// are real API params); "sort" has no backend equivalent and is applied here after fetch.

export type ListSortOrder = "date_asc" | "date_desc" | "amount_asc" | "amount_desc";

export const LIST_SORT_OPTIONS: { value: ListSortOrder; label: string }[] = [
  { value: "date_asc", label: "Tarih (Eskiden Yeniye)" },
  { value: "date_desc", label: "Tarih (Yeniden Eskiye)" },
  { value: "amount_asc", label: "Tutar (Artan)" },
  { value: "amount_desc", label: "Tutar (Azalan)" },
];

// Default (no "sort" param in the URL) is date_desc — newest first. An explicit value in the
// URL (including "date_asc", used by the dashboard's Beklenen Tahsilat card link) is preserved.
export function parseSortOrder(value: string | null): ListSortOrder {
  if (value === "date_asc" || value === "date_desc" || value === "amount_asc" || value === "amount_desc") return value;
  return "date_desc";
}

interface SortableEntry {
  id: string;
  entry_date: string;
  amount_try: number | string;
}

// Stable tie-breaker: date sorts fall back to id, amount sorts fall back to entry_date then id.
export function sortListEntries<T extends SortableEntry>(entries: T[], sort: ListSortOrder): T[] {
  const sorted = [...entries];
  sorted.sort((a, b) => {
    const dateAsc = String(a.entry_date || "").localeCompare(String(b.entry_date || ""));
    const idAsc = String(a.id).localeCompare(String(b.id));
    switch (sort) {
      case "date_desc":
        return dateAsc !== 0 ? -dateAsc : -idAsc;
      case "amount_asc": {
        const cmp = Number(a.amount_try) - Number(b.amount_try);
        return cmp !== 0 ? cmp : (dateAsc !== 0 ? dateAsc : idAsc);
      }
      case "amount_desc": {
        const cmp = Number(b.amount_try) - Number(a.amount_try);
        return cmp !== 0 ? cmp : (dateAsc !== 0 ? -dateAsc : -idAsc);
      }
      case "date_asc":
      default:
        return dateAsc !== 0 ? dateAsc : idAsc;
    }
  });
  return sorted;
}

// Sets or removes a URL query param depending on whether it differs from the "no filter" default.
export function applyParam(params: URLSearchParams, key: string, value: string, defaultValue: string): void {
  if (!value || value === defaultValue) params.delete(key);
  else params.set(key, value);
}
