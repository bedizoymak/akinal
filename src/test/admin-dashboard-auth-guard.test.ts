import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getAdminDashboard } from "@/lib/apiClient";

describe("admin dashboard auth guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps 401 dashboard responses distinguishable for login redirect", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, message: "Authentication required." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getAdminDashboard()).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
    } satisfies Partial<ApiError>);
  });
});
