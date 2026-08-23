export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const FIXED_STEP_MS = 1_000 / 60;
export const MAX_FRAME_DELTA_MS = 100;
export const MAX_STEPS_PER_FRAME = 6;

export const ARENA = {
  left: 24,
  right: GAME_WIDTH - 24,
  top: 82,
  bottom: GAME_HEIGHT - 24,
} as const;

export const GAMEPLAY = {
  playerSpeed: 460,
  playerRadius: 8,
  pointerDeadZone: 7,
  projectileMargin: 72,
  projectileRadius: 7,
  popupRadius: 12,
  maxProjectiles: 140,
  maxHazards: 8,
  tabFirstSpawnMs: 850,
  popupFirstSpawnMs: 12_000,
  memoryLeakFirstSpawnMs: 24_000,
  contextSweepFirstSpawnMs: 42_000,
  popupTelegraphMs: 720,
  memoryLeakTelegraphMs: 1_050,
  memoryLeakActiveMs: 620,
  contextSweepTelegraphMs: 1_250,
  contextSweepActiveMs: 520,
  difficultyRampMs: 120_000,
  levelDurationMs: 15_000,
} as const;
