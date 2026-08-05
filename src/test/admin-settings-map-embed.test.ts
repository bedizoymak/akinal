import { describe, expect, it } from "vitest";
import { extractMapEmbedSrc, isValidGoogleMapsEmbedUrl } from "@/pages/admin/AdminSettings";

// P1-4 regression: pasting a full <iframe> snippet (or a bare URL with the
// iframe's other attributes glued on after it) used to store the entire
// string, producing a malformed encoded iframe src while Settings still
// reported the map as "Aktif". extractMapEmbedSrc must always reduce either
// input to just the URL; isValidGoogleMapsEmbedUrl must reject anything that
// isn't a clean https://www.google.com (or maps.google.com) embed link.

const CLEAN_URL = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1234!2d29!3d41";
const PASTED_IFRAME = `<iframe src="${CLEAN_URL}" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
const BARE_URL_WITH_GLUED_ATTRS = `${CLEAN_URL}" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"`;

describe("P1-4 Google Maps embed normalization", () => {
  it("passes a clean URL through unchanged", () => {
    expect(extractMapEmbedSrc(CLEAN_URL)).toBe(CLEAN_URL);
  });

  it("extracts only the src from a pasted <iframe> snippet", () => {
    expect(extractMapEmbedSrc(PASTED_IFRAME)).toBe(CLEAN_URL);
  });

  it("cuts a bare URL with glued-on iframe attributes at the first quote", () => {
    expect(extractMapEmbedSrc(BARE_URL_WITH_GLUED_ATTRS)).toBe(CLEAN_URL);
  });

  it("validates the clean Google Maps URL and rejects non-Google/script-bearing values", () => {
    expect(isValidGoogleMapsEmbedUrl(CLEAN_URL)).toBe(true);
    expect(isValidGoogleMapsEmbedUrl("https://evil.example.com/maps/embed")).toBe(false);
    expect(isValidGoogleMapsEmbedUrl("https://www.google.com/maps/embed?x=<script>alert(1)</script>")).toBe(false);
    expect(isValidGoogleMapsEmbedUrl(`${CLEAN_URL}" onerror="alert(1)`)).toBe(false);
  });

  it("both entry paths converge on the same clean, valid stored URL", () => {
    const fromClean = extractMapEmbedSrc(CLEAN_URL);
    const fromIframe = extractMapEmbedSrc(PASTED_IFRAME);
    expect(fromClean).toBe(fromIframe);
    expect(isValidGoogleMapsEmbedUrl(fromClean)).toBe(true);
    expect(isValidGoogleMapsEmbedUrl(fromIframe)).toBe(true);
  });
});
