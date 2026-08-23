export const DEFAULT_GAME_WIDTH = 1280;
export const DEFAULT_GAME_HEIGHT = 720;

export const FIXED_STEP_MS = 1_000 / 60;
export const MAX_FRAME_DELTA_MS = 100;
export const MAX_STEPS_PER_FRAME = 6;

export const GAMEPLAY = {
  playerRadius: 6,
  projectileMargin: 88,
  projectileRadius: 8,
  popupRadius: 14,
  maxProjectiles: 140,
  maxHazards: 8,
  tabFirstSpawnMs: 850,
  popupFirstSpawnMs: 12_000,
  memoryLeakFirstSpawnMs: 24_000,
  contextSweepFirstSpawnMs: 42_000,
  tabTelegraphMs: 150,
  popupTelegraphMs: 900,
  memoryLeakTelegraphMs: 1_200,
  memoryLeakActiveMs: 700,
  contextSweepTelegraphMs: 1_400,
  contextSweepActiveMs: 600,
  difficultyRampMs: 120_000,
  levelDurationMs: 15_000,
} as const;
