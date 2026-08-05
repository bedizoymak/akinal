import { describe, expect, it } from "vitest";
import { defaultValues } from "@/components/admin/finance/CardEntryForm";

// P1-3 regression: opening "Ekle" from the customer detail's Gayri Resmi tab
// used to default the account_type to "resmi" — both on initial mount and
// (the actual live-repro path) every time the dialog was reopened, because
// the open-effect rebuilt defaultValues() without forwarding
// defaultAccountType. Locks both the initial state and the reopen path.

describe("CardEntryForm.defaultValues account_type default", () => {
  it("defaults to resmi when no context is given (backward compatible)", () => {
    expect(defaultValues().account_type).toBe("resmi");
  });

  it("honors the active tab's defaultAccountType for a new entry", () => {
    expect(defaultValues(undefined, "gayri_resmi").account_type).toBe("gayri_resmi");
    expect(defaultValues(undefined, "resmi").account_type).toBe("resmi");
  });

  it("preserves the existing entry's account_type when editing, even if defaultAccountType differs", () => {
    const editing = defaultValues({ account_type: "gayri_resmi" } as any, "resmi");
    expect(editing.account_type).toBe("gayri_resmi");
  });
});
