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
  | "tool-call"
  | "approval"
  | "context-token"
  | "retry"
  | "agent"
  | "finding"
  | "limit";
export type HazardKind = "compaction" | "full-access";
export type HazardPhase = "telegraph" | "active";
export type SequenceKind = "review-loop" | "usage-limit";
export type AttackPatternKind =
  | "tool-stream"
  | "approval-required"
  | "context-compaction"
  | "retry-loop"
  | "reasoning-xhigh"
  | "parallel-agents"
  | "review-fix-loop"
  | "usage-limit"
  | "wildcard-blackout";
export type HitSource = ProjectileKind | "reasoning";
export type AttackSurface = "terminal" | "browser" | "codex";

export type ToolCallLabel = string;

export type ApprovalLabel =
  | "[approval] allow full access?"
  | "[approval] run outside sandbox?"
  | "[approval] allow network?"
  | "[approval] approve session?"
  | "[approval] still waiting..."
  | "[approval] approve again?"
  | "[approval] full access again?";

export type SequenceResultLabel =
  | "ONE MORE ISSUE"
  | "5H LIMIT REACHED"
  | "WEEKLY LIMIT REACHED"
  | "RESETS IN 4 DAYS";

export type ProjectileLabel = ToolCallLabel | ApprovalLabel | string;
export type HazardLabel = "CONTEXT COMPACTION" | "FULL ACCESS";

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
  blackoutRevealGraceRemainingMs: number;
  gravityScale?: number;
  horizontalDragPerSecond?: number;
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

export interface ApprovalGateGap {
  center: number;
  size: number;
  label: "ALLOW ONCE" | "ALLOW SESSION" | "REVIEW" | "DENY";
}

export interface ApprovalGateState {
  id: number;
  position: Vec2;
  direction: Vec2;
  gaps: ApprovalGateGap[];
  thickness: number;
  speed: number;
  telegraphRemainingMs: number;
}

export interface RetryChainState {
  id: number;
  position: Vec2;
  target: Vec2;
  velocity: Vec2;
  hitbox: RectangleHitbox;
  speed: number;
  attempt: number;
  totalAttempts: number;
  telegraphRemainingMs: number;
  completionRemainingMs: number;
}

export interface ReasoningWaveState {
  id: number;
  center: Vec2;
  safeAngle: number;
  safeArc: number;
  radius: number;
  previousRadius: number;
  maxRadius: number;
  thickness: number;
  speed: number;
  collapseDurationMs: number;
  phase: "thinking" | "active";
  telegraphRemainingMs: number;
  telegraphDurationMs: number;
}

export interface BlackoutState {
  id: number;
  position: Vec2;
  hitbox: RectangleHitbox;
  telegraphRemainingMs: number;
  remainingMs: number;
  durationMs: number;
}

export interface EndingState {
  elapsedMs: number;
  durationMs: number;
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
  resultLabel: SequenceResultLabel;
}

export interface SpawnTimers {
  toolCallMs: number;
  approvalMs: number;
  compactionMs: number;
  retryLoopMs: number;
  reasoningMs: number;
  parallelAgentsMs: number;
  reviewLoopMs: number;
  usageLimitMs: number;
  blackoutMs: number;
  majorPatternCooldownMs: number;
  majorPatternCursor: number;
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
  approvalGates: ApprovalGateState[];
  retryChains: RetryChainState[];
  reasoningWaves: ReasoningWaveState[];
  blackouts: BlackoutState[];
  ending: EndingState | null;
  spawn: SpawnTimers;
}

export interface InputIntent {
  direction: Vec2;
}

export type GameEvent =
  | { type: "run-started" }
  | { type: "hazard-warning"; kind: HazardKind }
  | { type: "hazard-activated"; kind: HazardKind; position: Vec2 }
  | {
      type: "pattern-warning";
      kind:
        | SequenceKind
        | "approval-required"
        | "retry-loop"
        | "reasoning-xhigh"
        | "parallel-agents";
    }
  | {
      type: "pattern-burst";
      kind: SequenceKind | "reasoning-xhigh";
      position: Vec2;
    }
  | { type: "pattern-complete"; kind: "retry-loop"; position: Vec2 }
  | { type: "blackout-started"; position: Vec2 }
  | { type: "ending-started" }
  | { type: "player-hit"; source: HitSource }
  | { type: "run-ended"; finalScore: number; source: HitSource | null };
