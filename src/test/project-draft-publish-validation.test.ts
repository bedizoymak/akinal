import { describe, expect, it } from "vitest";
import { validateProjectSaveFields } from "@/pages/admin/AdminProjectEdit";

// P2-1 regression: draft saves must succeed without a cover image or short
// description; publishing (immediately or later) must still require both,
// with a message clarifying it's a publish requirement, not a blanket one.

describe("P2-1 draft vs publish field requirements", () => {
  it("allows a draft save with no image and no short description", () => {
    expect(validateProjectSaveFields({ cover_image_url: null, short_description: "" }, false)).toBeNull();
  });

  it("allows a draft save with only one of the two fields present", () => {
    expect(validateProjectSaveFields({ cover_image_url: "/uploads/x.jpg", short_description: "" }, false)).toBeNull();
    expect(validateProjectSaveFields({ cover_image_url: null, short_description: "Bir açıklama" }, false)).toBeNull();
  });

  it("rejects publishing without a cover image", () => {
    const error = validateProjectSaveFields({ cover_image_url: null, short_description: "Bir açıklama" }, true);
    expect(error).toMatch(/ana görsel/i);
  });

  it("rejects publishing without a short description", () => {
    const error = validateProjectSaveFields({ cover_image_url: "/uploads/x.jpg", short_description: "   " }, true);
    expect(error).toMatch(/kısa açıklama/i);
  });

  it("allows publishing once both fields are present", () => {
    expect(validateProjectSaveFields({ cover_image_url: "/uploads/x.jpg", short_description: "Bir açıklama" }, true)).toBeNull();
  });
});
