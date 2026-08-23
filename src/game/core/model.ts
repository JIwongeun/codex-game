export interface Vec2 {
  x: number;
  y: number;
}

export interface ArenaBounds {
  width: number;
  height: number;
}

export type GamePhase = "ready" | "playing" | "results";
export type ProjectileKind =
  | "log"
  | "review"
  | "retry"
  | "branch"
  | "race"
  | "bug";
export type HazardKind = "context-max";
export type HazardPhase = "telegraph" | "active";
export type SequenceKind = "fork-bomb" | "merge-bug";
export type AttackPatternKind =
  | "log-stream"
  | "review-request"
  | "context-max"
  | "retry-loop"
  | "fork-bomb"
  | "race-condition"
  | "merge-bug";
export type HitSource = ProjectileKind | HazardKind;

export type LogLabel =
  | "+ ONE MORE CHANGE"
  | "TESTS STILL RUNNING..."
  | "TOOL RETRY 3/3"
  | "WORKING TREE DIRTY"
  | "GIT COMMIT --AMEND"
  | "CI: FAILED"
  | "TS2322"
  | "CONTEXT LEFT: 12%"
  | "READING AGENTS.MD"
  | "CHECKING WORKSPACE..."
  | "FIXING ONE LAST TEST"
  | "PR #404"
  | "REBASE REQUIRED";

export type ReviewLabel =
  | "APPROVAL REQUIRED"
  | "REQUEST CHANGES"
  | "NEEDS REBASE"
  | "RUN COMMAND?";

export type ProjectileLabel = LogLabel | ReviewLabel | string;
export type HazardLabel = "CONTEXT MAX!";

export interface RectangleHitbox {
  width: number;
  height: number;
}

export interface PlayerState {
  position: Vec2;
  direction: Vec2;
}

export interface ProjectileState {
  id: number;
  kind: ProjectileKind;
  label: ProjectileLabel;
  position: Vec2;
  velocity: Vec2;
  hitbox: RectangleHitbox;
  speed: number;
  ageMs: number;
  telegraphRemainingMs: number;
}

export interface AreaHazardState {
  id: number;
  kind: HazardKind;
  label: HazardLabel;
  position: Vec2;
  hitbox: RectangleHitbox;
  phase: HazardPhase;
  remainingMs: number;
}

export interface AttackSequenceState {
  id: number;
  kind: SequenceKind;
  label: string;
  position: Vec2;
  origins: Vec2[];
  remainingMs: number;
  durationMs: number;
  projectileCount: number;
  projectileSpeed: number;
}

export interface SpawnTimers {
  logMs: number;
  reviewMs: number;
  contextMaxMs: number;
  retryLoopMs: number;
  forkBombMs: number;
  raceConditionMs: number;
  mergeBugMs: number;
}

export interface GameState {
  phase: GamePhase;
  arena: ArenaBounds;
  seed: number;
  rngState: number;
  nextEntityId: number;
  elapsedMs: number;
  score: number;
  attacksDodged: number;
  hazardsSurvived: number;
  lastHitSource: HitSource | null;
  player: PlayerState;
  projectiles: ProjectileState[];
  hazards: AreaHazardState[];
  sequences: AttackSequenceState[];
  spawn: SpawnTimers;
}

export interface InputIntent {
  direction: Vec2;
}

export type GameEvent =
  | { type: "run-started" }
  | { type: "hazard-warning"; kind: HazardKind }
  | { type: "hazard-activated"; kind: HazardKind }
  | { type: "pattern-warning"; kind: SequenceKind | "retry-loop" | "race-condition" }
  | { type: "pattern-burst"; kind: SequenceKind; position: Vec2 }
  | { type: "player-hit"; source: HitSource }
  | { type: "run-ended"; finalScore: number; source: HitSource };
