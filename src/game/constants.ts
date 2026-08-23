export const DEFAULT_GAME_WIDTH = 1280;
export const DEFAULT_GAME_HEIGHT = 720;

export const FIXED_STEP_MS = 1_000 / 60;
export const MAX_FRAME_DELTA_MS = 100;
export const MAX_STEPS_PER_FRAME = 6;

export const GAMEPLAY = {
  playerRadius: 3,
  playerSpeed: 440,
  projectileMargin: 88,
  logHitboxHeight: 18,
  logHitboxMinWidth: 54,
  logHitboxMaxWidth: 148,
  reviewHitboxMinWidth: 80,
  reviewHitboxMaxWidth: 144,
  reviewHitboxHeight: 34,
  maxProjectiles: 28,
  maxHazards: 8,
  logFirstSpawnMs: 850,
  reviewFirstSpawnMs: 12_000,
  contextMaxFirstSpawnMs: 24_000,
  mergeConflictFirstSpawnMs: 42_000,
  logTelegraphMs: 280,
  reviewTelegraphMs: 950,
  contextMaxTelegraphMs: 1_500,
  contextMaxActiveMs: 500,
  mergeConflictTelegraphMs: 1_400,
  mergeConflictActiveMs: 600,
  difficultyRampMs: 120_000,
  levelDurationMs: 15_000,
} as const;
