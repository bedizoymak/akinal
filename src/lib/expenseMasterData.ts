export interface ExpenseCategoryMasterRecord {
  id: string;
  name: string;
  description?: string | null;
  is_active: number | boolean;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ExpenseItemMasterRecord {
  id: string;
  name: string;
  category_id: string | null;
  description?: string | null;
  default_unit?: string | null;
  default_vat_rate?: number | null;
  is_active: number | boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export function normalizeExpenseMasterDataName(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}

export function getSelectableExpenseItemOptions(
  items: ExpenseItemMasterRecord[],
  categories: ExpenseCategoryMasterRecord[],
  categoryId: string | null,
  currentItemId: string | null,
): ExpenseItemMasterRecord[] {
  const activeCategoryIds = new Set(
    categories
      .filter((category) => Number(category.is_active) === 1)
      .map((category) => category.id),
  );

  const selectedCategoryActive = categoryId ? activeCategoryIds.has(categoryId) : false;

  return items.filter((item) => {
    if (Number(item.is_active) !== 1 && item.id !== currentItemId) {
      return false;
    }
    if (categoryId && item.category_id !== categoryId) {
      return false;
    }
    if (categoryId && !selectedCategoryActive && item.id !== currentItemId) {
      return false;
    }
    return true;
  });
}

export function resolveExpenseItemCategory(
  itemId: string | null,
  items: ExpenseItemMasterRecord[],
  categories: ExpenseCategoryMasterRecord[],
): string | null {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item?.category_id) return null;
  return categories.some((category) => category.id === item.category_id) ? item.category_id : null;
}
