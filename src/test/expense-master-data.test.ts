import { describe, expect, it } from "vitest";
import { getSelectableExpenseItemOptions, normalizeExpenseMasterDataName, resolveExpenseItemCategory } from "@/lib/expenseMasterData";

describe("expense master data helpers", () => {
  it("normalizes names consistently for uniqueness checks", () => {
    expect(normalizeExpenseMasterDataName("  Hazır Beton C30  ")).toBe("hazır beton c30");
    expect(normalizeExpenseMasterDataName("İnşaat Demiri")).toBe("inşaat demiri");
  });

  it("keeps new-entry item options limited to active items in the chosen category", () => {
    const categories = [
      { id: "cat-1", name: "Kaba İnşaat", is_active: 1 },
      { id: "cat-2", name: "Elektrik", is_active: 1 },
    ];
    const items = [
      { id: "item-1", name: "Hazır Beton C30", category_id: "cat-1", is_active: 1 },
      { id: "item-2", name: "Elektrik Tesisatı", category_id: "cat-2", is_active: 1 },
      { id: "item-3", name: "Pasif Kalem", category_id: "cat-1", is_active: 0 },
    ];

    const options = getSelectableExpenseItemOptions(items, categories, "cat-1", null);
    expect(options.map((item) => item.id)).toEqual(["item-1"]);
  });

  it("includes the current item when editing a record that uses an inactive item", () => {
    const categories = [{ id: "cat-1", name: "Kaba İnşaat", is_active: 1 }];
    const items = [{ id: "item-1", name: "Hazır Beton C30", category_id: "cat-1", is_active: 0 }];

    const options = getSelectableExpenseItemOptions(items, categories, "cat-1", "item-1");
    expect(options).toHaveLength(1);
    expect(options[0].id).toBe("item-1");
  });

  it("excludes items for inactive categories when creating a new expense", () => {
    const categories = [{ id: "cat-1", name: "Kaba İnşaat", is_active: 0 }];
    const items = [{ id: "item-1", name: "Hazır Beton C30", category_id: "cat-1", is_active: 1 }];

    const options = getSelectableExpenseItemOptions(items, categories, "cat-1", null);
    expect(options).toHaveLength(0);
  });

  it("keeps the current item selectable when editing a record tied to an inactive category", () => {
    const categories = [{ id: "cat-1", name: "Kaba İnşaat", is_active: 0 }];
    const items = [{ id: "item-1", name: "Hazır Beton C30", category_id: "cat-1", is_active: 1 }];

    const options = getSelectableExpenseItemOptions(items, categories, "cat-1", "item-1");
    expect(options).toHaveLength(1);
    expect(options[0].id).toBe("item-1");
  });

  it("resolves the category automatically from a selected item", () => {
    const categories = [{ id: "cat-1", name: "Kaba İnşaat", is_active: 1 }];
    const items = [{ id: "item-1", name: "Hazır Beton C30", category_id: "cat-1", is_active: 1 }];

    expect(resolveExpenseItemCategory("item-1", items, categories)).toBe("cat-1");
    expect(resolveExpenseItemCategory("missing", items, categories)).toBeNull();
  });
});
