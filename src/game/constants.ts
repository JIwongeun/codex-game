export const DEFAULT_GAME_WIDTH = 1280;
export const DEFAULT_GAME_HEIGHT = 720;

export const FIXED_STEP_MS = 1_000 / 60;
export const MAX_FRAME_DELTA_MS = 100;
export const MAX_STEPS_PER_FRAME = 6;

export const GAMEPLAY = {
  playerRadius: 5,
  playerSpeed: 440,
  projectileMargin: 150,
  logHitboxHeight: 15,
  logHitboxMinWidth: 68,
  logHitboxMaxWidth: 158,
  reviewHitboxMinWidth: 96,
  reviewHitboxMaxWidth: 158,
  reviewHitboxHeight: 17,
  fragmentHitboxWidth: 40,
  fragmentHitboxHeight: 15,
  maxProjectiles: 48,
  maxHazards: 4,
  maxSequences: 4,
  logFirstSpawnMs: 850,
  reviewFirstSpawnMs: 12_000,
  contextMaxFirstSpawnMs: 24_000,
  retryLoopFirstSpawnMs: 36_000,
  forkBombFirstSpawnMs: 48_000,
  raceConditionFirstSpawnMs: 60_000,
  mergeBugFirstSpawnMs: 72_000,
  logTelegraphMs: 360,
  reviewTelegraphMs: 950,
  contextMaxTelegraphMs: 1_500,
  contextMaxActiveMs: 500,
  forkBombConvergeMs: 1_250,
  mergeBugConvergeMs: 1_650,
  stageDurationMs: 12_000,
  maxStage: 10,
  difficultyRampMs: 108_000,
} as const;
