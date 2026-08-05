import { describe, expect, it } from "vitest";
import { isMediaImageMissing } from "@/pages/admin/AdminMedia";

// P1-5 regression: "in use" (is_protected, checked separately in the
// component) and "file physically exists" (this helper) must stay
// independent. A row can be referenced by a project/setting while its file
// is gone — the two must never be conflated into a single "healthy" signal.

describe("P1-5 isMediaImageMissing", () => {
  it("valid image: not missing when server confirms existence and no client error", () => {
    expect(isMediaImageMissing({ file_missing: false, image_url: "/uploads/project-images/a.jpg" }, new Set())).toBe(false);
  });

  it("referenced-but-missing local file: server-confirmed missing, independent of is_protected", () => {
    expect(isMediaImageMissing({ file_missing: true, image_url: "/uploads/project-images/photo.png.jpg" }, new Set())).toBe(true);
  });

  it("external/unknown URL: server leaves file_missing null (unchecked) — relies on client-side detection", () => {
    const url = "https://cdn.example.com/photo.jpg";
    expect(isMediaImageMissing({ file_missing: null, image_url: url }, new Set())).toBe(false);
    // Once the <img> onError fires (e.g. the SPA's index.html masquerading
    // as the image, or a genuine 404), the client-side set catches it.
    expect(isMediaImageMissing({ file_missing: null, image_url: url }, new Set([url]))).toBe(true);
  });

  it("SPA HTML fallback for a local file the server check missed: client onError still catches it", () => {
    const url = "/uploads/project-images/legacy.png.jpg";
    // Simulates: server said file_missing=false (e.g. stale cache) but the
    // browser's actual <img> load failed because the path resolves to HTML.
    expect(isMediaImageMissing({ file_missing: false, image_url: url }, new Set([url]))).toBe(true);
  });

  it("path-traversal-style URLs are never treated as healthy by omission", () => {
    // The backend's local_upload_file_exists() rejects these outright
    // (verify-media-file-health.php); if one ever slipped through as
    // file_missing=true, the frontend must still surface it as missing.
    expect(isMediaImageMissing({ file_missing: true, image_url: "/uploads/project-images/../../config.php" }, new Set())).toBe(true);
  });
});
