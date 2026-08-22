export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const RUN_DURATION_SECONDS = 90;
export const RUN_DURATION_MS = RUN_DURATION_SECONDS * 1_000;
export const STARTING_LIVES = 3;

export const FIXED_STEP_MS = 1_000 / 60;
export const MAX_FRAME_DELTA_MS = 100;
export const MAX_STEPS_PER_FRAME = 6;

export const ARENA = {
  left: 24,
  right: GAME_WIDTH - 24,
  top: 88,
  bottom: GAME_HEIGHT - 24,
} as const;

export const GAMEPLAY = {
  playerSpeed: 250,
  playerTurnSpeed: 6,
  playerRadius: 14,
  pointerDeadZone: 24,
  startingTokenCount: 18,
  tokenTargetCount: 24,
  tokenRadius: 8,
  tokenSpawnIntervalMs: 650,
  tokenValue: 100,
  contextCapacity: 24,
  contextWarningAt: 18,
  overflowGraceMs: 2_000,
  baseTrailPoints: 8,
  trailPointsPerToken: 2,
  trailSampleDistance: 10,
  invulnerabilityMs: 1_200,
  compactBaseRadius: 110,
  compactRadiusPerToken: 10,
  compactMaxRadius: 350,
  survivalBonusPerLife: 500,
  maxEnemies: 28,
  enemySpawnSafeDistance: 300,
  enemySpawnAttempts: 16,
  tabFirstSpawnMs: 4_000,
  leakFirstSpawnMs: 25_000,
  notificationFirstSpawnMs: 40_000,
  leakSplitMs: 6_000,
  notificationTelegraphMs: 900,
  notificationDashMs: 2_500,
} as const;
