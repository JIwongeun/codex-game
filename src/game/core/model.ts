export interface Vec2 {
  x: number;
  y: number;
}

export interface ArenaBounds {
  width: number;
  height: number;
}

export type GamePhase = "ready" | "playing" | "results";
export type ProjectileKind = "tab" | "popup";
export type HazardKind = "memory-leak" | "context-sweep";
export type HazardPhase = "telegraph" | "active";
export type SweepAxis = "horizontal" | "vertical";
export type HitSource = ProjectileKind | HazardKind;

export interface PlayerState {
  position: Vec2;
  direction: Vec2;
}

export interface ProjectileState {
  id: number;
  kind: ProjectileKind;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  speed: number;
  ageMs: number;
  telegraphRemainingMs: number;
}

export interface AreaHazardState {
  id: number;
  kind: HazardKind;
  position: Vec2;
  radius: number;
  axis: SweepAxis | null;
  thickness: number;
  phase: HazardPhase;
  remainingMs: number;
}

export interface SpawnTimers {
  tabMs: number;
  popupMs: number;
  memoryLeakMs: number;
  contextSweepMs: number;
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
  spawn: SpawnTimers;
}

export interface InputIntent {
  position: Vec2 | null;
}

export type GameEvent =
  | { type: "run-started" }
  | { type: "hazard-warning"; kind: HazardKind }
  | { type: "hazard-activated"; kind: HazardKind }
  | { type: "player-hit"; source: HitSource }
  | { type: "run-ended"; finalScore: number; source: HitSource };
