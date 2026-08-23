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
  | "reasoning"
  | "agent"
  | "finding"
  | "limit";
export type HazardKind = "compaction";
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
  | "usage-limit";
export type HitSource = ProjectileKind;
export type AttackSurface = "terminal" | "browser" | "codex";

export type ToolCallLabel =
  | "+ one more change"
  | "$ pnpm check"
  | "$ pnpm test --run"
  | "$ rg --files -g AGENTS.md"
  | "$ rg -n TODO src"
  | "$ git diff --check"
  | "$ git diff --stat"
  | "$ git status --short"
  | "[tool] reading AGENTS.md"
  | "[tool] reading docs again"
  | "[tool] rereading same file"
  | "[tool] searching codebase"
  | "[tool] waiting for output"
  | "warning: CRLF incoming"
  | "warning: tree is dirty"
  | "error: command timed out"
  | "error: exit code 1"
  | "TS2322: not assignable"
  | "ENOENT: file not found"
  | "codex: checking diff again"
  | "codex: fixing one last test"
  | "codex: updating plan again"
  | "codex: one last check"
  | "404 Not Found"
  | "429 Too Many Requests"
  | "502 Bad Gateway"
  | "ERR_CONNECTION_REFUSED"
  | "ERR_NAME_NOT_RESOLVED"
  | "ERR_TIMED_OUT"
  | "PAGE_CRASHED"
  | "PAGE_UNRESPONSIVE"
  | "net::ERR_FAILED";

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
export type HazardLabel = "CONTEXT COMPACTION";

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
  | { type: "pattern-burst"; kind: SequenceKind; position: Vec2 }
  | { type: "player-hit"; source: HitSource }
  | { type: "run-ended"; finalScore: number; source: HitSource };
