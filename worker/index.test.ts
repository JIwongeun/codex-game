import { describe, expect, it } from "vitest";

import worker from "./index";

describe("site worker", () => {
  it("marks every response as unavailable for search indexing", async () => {
    const response = await worker.fetch(new Request("https://example.com/"), {
      ASSETS: {
        fetch: async () => new Response("game"),
      },
    });

    expect(response.headers.get("X-Robots-Tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    expect(await response.text()).toBe("game");
  });
});
