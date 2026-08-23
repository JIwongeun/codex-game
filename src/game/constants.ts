export const DEFAULT_GAME_WIDTH = 1280;
export const DEFAULT_GAME_HEIGHT = 720;

export const FIXED_STEP_MS = 1_000 / 60;
export const MAX_FRAME_DELTA_MS = 100;
export const MAX_STEPS_PER_FRAME = 6;

export const GAMEPLAY = {
  playerRadius: 5,
  playerSpeed: 440,
  projectileMargin: 150,
  toolCallHitboxHeight: 15,
  toolCallHitboxMinWidth: 68,
  toolCallHitboxMaxWidth: 158,
  approvalHitboxMinWidth: 118,
  approvalHitboxMaxWidth: 176,
  approvalHitboxHeight: 17,
  fragmentHitboxHeight: 15,
  maxProjectiles: 56,
  maxHazards: 4,
  maxSequences: 4,
  toolCallFirstSpawnMs: 850,
  approvalFirstSpawnMs: 12_000,
  compactionFirstSpawnMs: 24_000,
  retryLoopFirstSpawnMs: 36_000,
  reasoningFirstSpawnMs: 48_000,
  parallelAgentsFirstSpawnMs: 60_000,
  reviewLoopFirstSpawnMs: 72_000,
  usageLimitFirstSpawnMs: 84_000,
  toolCallTelegraphMs: 360,
  approvalTelegraphMs: 950,
  compactionTelegraphMs: 1_650,
  compactionActiveMs: 520,
  compactionStartSize: 255,
  compactionEndSize: 375,
  compactionMaxViewportRatio: 0.675,
  contextTokenHitboxWidth: 44,
  contextTokenHitboxHeight: 13,
  contextTokenBurstRadius: 24,
  reasoningTelegraphMs: 2_100,
  reviewLoopConvergeMs: 1_450,
  usageLimitConvergeMs: 1_800,
  stageDurationMs: 12_000,
  maxStage: 10,
  difficultyRampMs: 108_000,
} as const;
