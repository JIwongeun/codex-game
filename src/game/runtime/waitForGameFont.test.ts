import { afterEach, describe, expect, it, vi } from "vitest";

import { waitForGameFont } from "./waitForGameFont";

describe("waitForGameFont", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads the local game font before boot when available", async () => {
    const load = vi.fn(() => Promise.resolve([]));

    await waitForGameFont({ load });

    expect(load).toHaveBeenCalledWith(
      '500 16px "Pretendard Variable"',
      "await CODEX Pointer crashed 포인터",
    );
  });

  it("continues boot when the font API is missing or rejects", async () => {
    await expect(waitForGameFont(undefined)).resolves.toBeUndefined();
    await expect(
      waitForGameFont({ load: () => Promise.reject(new Error("font failed")) }),
    ).resolves.toBeUndefined();
    await expect(
      waitForGameFont({
        load: () => {
          throw new Error("font API failed");
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("continues boot after the bounded timeout when loading never settles", async () => {
    vi.useFakeTimers();
    const waiting = waitForGameFont(
      { load: () => new Promise(() => undefined) },
      1_500,
    );

    await vi.advanceTimersByTimeAsync(1_499);
    let completed = false;
    void waiting.then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(waiting).resolves.toBeUndefined();
  });
});
