import { describe, expect, it, vi } from "vitest";

import {
  GUEST_SESSION_BEST_KEY,
  readGuestSessionBest,
  saveGuestSessionBest,
  type ScoreStorage,
} from "./localBest";

function memoryStorage(initial: string | null = null): ScoreStorage {
  let value = initial;

  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, nextValue: string) => {
      value = nextValue;
    }),
  };
}

describe("guest session best", () => {
  it.each([null, "broken", "-10", "Infinity", "NaN"])(
    "treats %s as an empty score",
    (stored) => {
      expect(readGuestSessionBest(memoryStorage(stored))).toBe(0);
    },
  );

  it("loads a finite non-negative integer", () => {
    expect(readGuestSessionBest(memoryStorage("1234.9"))).toBe(1_234);
  });

  it("writes only an improved score", () => {
    const storage = memoryStorage("900");

    expect(saveGuestSessionBest(800, 900, storage)).toBe(900);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(saveGuestSessionBest(1_200.8, 900, storage)).toBe(1_200);
    expect(storage.setItem).toHaveBeenCalledWith(
      GUEST_SESSION_BEST_KEY,
      "1200",
    );
  });

  it("survives storage access failures", () => {
    const storage: ScoreStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };

    expect(readGuestSessionBest(storage)).toBe(0);
    expect(saveGuestSessionBest(500, 0, storage)).toBe(500);
  });

  it("uses sessionStorage instead of persistent localStorage", () => {
    const sessionStorage = memoryStorage();
    const localStorage = memoryStorage();
    vi.stubGlobal("window", { sessionStorage, localStorage });

    try {
      expect(saveGuestSessionBest(700, 0)).toBe(700);
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        GUEST_SESSION_BEST_KEY,
        "700",
      );
      expect(localStorage.setItem).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
