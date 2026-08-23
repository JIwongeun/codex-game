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
export type AttackSurface = "terminal" | "browser" | "codex";

export type LogLabel =
  | "+ one more change"
  | "$ pnpm test --watch"
  | "codex: retrying tool"
  | "warning: tree is dirty"
  | "$ git commit --amend"
  | "error: CI failed"
  | "error TS2322"
  | "[context] 12% left"
  | "$ cat AGENTS.md"
  | "codex: inspecting..."
  | "fixing one last test..."
  | "git: rebase required"
  | "404 Not Found"
  | "ERR_CONNECTION_REFUSED"
  | "PAGE_UNRESPONSIVE"
  | "net::ERR_FAILED";

export type ReviewLabel =
  | "[review] approval required"
  | "[review] changes requested"
  | "git: needs rebase"
  | "run command? [y/N]";

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
  surface: AttackSurface;
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
