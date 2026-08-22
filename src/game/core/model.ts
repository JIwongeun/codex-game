export interface Vec2 {
  x: number;
  y: number;
}

export type GamePhase = "ready" | "playing" | "results";
export type RunEndReason = "time" | "lives";
export type EnemyKind = "tab" | "leak" | "notification";
export type NotificationMode = "telegraph" | "dash";

export interface PlayerState {
  position: Vec2;
  direction: Vec2;
  invulnerableMs: number;
}

export interface TrailPoint extends Vec2 {
  id: number;
}

export interface TokenState {
  id: number;
  position: Vec2;
  radius: number;
}

export interface EnemyState {
  id: number;
  kind: EnemyKind;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  ageMs: number;
  behaviorMs: number;
  notificationMode: NotificationMode | null;
}

export interface SpawnTimers {
  tabMs: number;
  leakMs: number;
  notificationMs: number;
}

export interface GameState {
  phase: GamePhase;
  endReason: RunEndReason | null;
  seed: number;
  rngState: number;
  nextEntityId: number;
  nextTrailId: number;
  elapsedMs: number;
  remainingMs: number;
  score: number;
  pendingTokens: number;
  overflowRemainingMs: number | null;
  lives: number;
  compactCount: number;
  tokensCollected: number;
  enemiesDestroyed: number;
  player: PlayerState;
  trail: TrailPoint[];
  tokens: TokenState[];
  enemies: EnemyState[];
  tokenSpawnRemainingMs: number;
  enemySpawn: SpawnTimers;
}

export interface InputIntent {
  direction: Vec2 | null;
  compactPressed: boolean;
}

export type GameEvent =
  | { type: "run-started" }
  | { type: "token-collected"; tokenId: number; pendingTokens: number }
  | { type: "overflow-started" }
  | {
      type: "compacted";
      bankedScore: number;
      tokenCount: number;
      radius: number;
      clearedEnemies: number;
    }
  | { type: "player-hit"; source: EnemyKind | "overflow"; lives: number }
  | { type: "enemy-destroyed"; enemyId: number; kind: EnemyKind }
  | {
      type: "run-ended";
      reason: RunEndReason;
      finalScore: number;
      survivalBonus: number;
    };
