import { describe, expect, it, vi } from "vitest";

import {
  LOCAL_BEST_KEY,
  readLocalBest,
  saveLocalBest,
  type ScoreStorage,
} from "./localBest";

function memoryStorage(initial: string | null = null): ScoreStorage {
  let value = initial;

  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key, nextValue) => {
      value = nextValue;
    }),
  };
}

describe("local best score", () => {
  it.each([null, "broken", "-10", "Infinity", "NaN"])(
    "treats %s as an empty score",
    (stored) => {
      expect(readLocalBest(memoryStorage(stored))).toBe(0);
    },
  );

  it("loads a finite non-negative integer", () => {
    expect(readLocalBest(memoryStorage("1234.9"))).toBe(1_234);
  });

  it("writes only an improved score", () => {
    const storage = memoryStorage("900");

    expect(saveLocalBest(800, 900, storage)).toBe(900);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(saveLocalBest(1_200.8, 900, storage)).toBe(1_200);
    expect(storage.setItem).toHaveBeenCalledWith(LOCAL_BEST_KEY, "1200");
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

    expect(readLocalBest(storage)).toBe(0);
    expect(saveLocalBest(500, 0, storage)).toBe(500);
  });
});
