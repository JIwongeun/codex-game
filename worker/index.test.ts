import { describe, expect, it } from "vitest";

import worker from "./index";

describe("site worker", () => {
  it("adds security headers while preserving the asset response", async () => {
    const response = await worker.fetch(new Request("https://example.com/"), {
      ASSETS: {
        fetch: async () => new Response("game", {
          status: 201,
          headers: { "Cache-Control": "public, max-age=60" },
        }),
      },
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(response.headers.get("X-Robots-Tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Permissions-Policy")).toContain(
      "microphone=()",
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "script-src 'self'",
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "object-src 'none'",
    );
    expect(await response.text()).toBe("game");
  });
});
