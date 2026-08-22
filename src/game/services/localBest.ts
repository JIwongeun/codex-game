export const LOCAL_BEST_KEY = "await-codex.best-score.v1";

export interface ScoreStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): ScoreStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sanitizeScore(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export function readLocalBest(storage = browserStorage()): number {
  if (!storage) {
    return 0;
  }

  try {
    return sanitizeScore(storage.getItem(LOCAL_BEST_KEY));
  } catch {
    return 0;
  }
}

export function saveLocalBest(
  score: number,
  currentBest: number,
  storage = browserStorage(),
): number {
  const safeScore = sanitizeScore(score);
  const safeBest = sanitizeScore(currentBest);
  const nextBest = Math.max(safeBest, safeScore);

  if (!storage || nextBest <= safeBest) {
    return nextBest;
  }

  try {
    storage.setItem(LOCAL_BEST_KEY, String(nextBest));
  } catch {
    return nextBest;
  }

  return nextBest;
}
