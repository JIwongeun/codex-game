import {
  DEFAULT_GAME_HEIGHT,
  DEFAULT_GAME_WIDTH,
  GAMEPLAY,
} from "../constants";
import {
  circleOverlapsOrientedRectangle,
  directionBetween,
  normalize,
} from "./math";
import type {
  AreaHazardState,
  AttackSurface,
  AttackSequenceState,
  ArenaBounds,
  ApprovalLabel,
  GameEvent,
  GameState,
  HitSource,
  InputIntent,
  ProjectileLabel,
  ProjectileKind,
  ProjectileState,
  RectangleHitbox,
  SequenceResultLabel,
  ToolCallLabel,
  Vec2,
} from "./model";
import { nextRandom, normalizeSeed } from "./random";
import { difficultyAt } from "./rules";

const PLAYER_START_DIRECTION: Vec2 = { x: 1, y: 0 };
const TOOL_CALL_ENTRIES: readonly {
  label: ToolCallLabel;
  surface: AttackSurface;
}[] = [
  { label: "+ one more change", surface: "codex" },
  { label: "$ pnpm test --run", surface: "terminal" },
  { label: "$ pnpm check", surface: "terminal" },
  { label: "$ rg --files -g AGENTS.md", surface: "terminal" },
  { label: "$ rg -n TODO src", surface: "terminal" },
  { label: "$ git diff --check", surface: "terminal" },
  { label: "$ git diff --stat", surface: "terminal" },
  { label: "$ git status --short", surface: "terminal" },
  { label: "[tool] reading AGENTS.md", surface: "codex" },
  { label: "[tool] reading docs again", surface: "codex" },
  { label: "[tool] rereading same file", surface: "codex" },
  { label: "[tool] searching codebase", surface: "codex" },
  { label: "[tool] waiting for output", surface: "codex" },
  { label: "warning: CRLF incoming", surface: "terminal" },
  { label: "warning: tree is dirty", surface: "terminal" },
  { label: "error: command timed out", surface: "terminal" },
  { label: "error: exit code 1", surface: "terminal" },
  { label: "TS2322: not assignable", surface: "terminal" },
  { label: "ENOENT: file not found", surface: "terminal" },
  { label: "codex: checking diff again", surface: "codex" },
  { label: "codex: fixing one last test", surface: "codex" },
  { label: "codex: updating plan again", surface: "codex" },
  { label: "codex: one last check", surface: "codex" },
  { label: "404 Not Found", surface: "browser" },
  { label: "429 Too Many Requests", surface: "browser" },
  { label: "502 Bad Gateway", surface: "browser" },
  { label: "ERR_CONNECTION_REFUSED", surface: "browser" },
  { label: "ERR_NAME_NOT_RESOLVED", surface: "browser" },
  { label: "ERR_TIMED_OUT", surface: "browser" },
  { label: "PAGE_CRASHED", surface: "browser" },
  { label: "PAGE_UNRESPONSIVE", surface: "browser" },
  { label: "net::ERR_FAILED", surface: "browser" },
];
const APPROVAL_ENTRIES: readonly {
  label: ApprovalLabel;
  surface: "codex";
}[] = [
  { label: "[approval] allow full access?", surface: "codex" },
  { label: "[approval] run outside sandbox?", surface: "codex" },
  { label: "[approval] allow network?", surface: "codex" },
  { label: "[approval] approve session?", surface: "codex" },
  { label: "[approval] still waiting...", surface: "codex" },
  { label: "[approval] approve again?", surface: "codex" },
  { label: "[approval] full access again?", surface: "codex" },
];
const USAGE_LIMIT_RESULTS: readonly SequenceResultLabel[] = [
  "5H LIMIT REACHED",
  "WEEKLY LIMIT REACHED",
  "RESETS IN 4 DAYS",
];
const CONTEXT_TOKEN_LABELS = [
  "[tok] src/",
  "[tok] diff",
  "[tok] plan",
  "[tok] fix",
  "[tok] 128t",
  "[tok] {...}",
  "[tok] =>",
  "[tok] lost",
] as const;

export const EMPTY_INPUT: InputIntent = { direction: { x: 0, y: 0 } };

export function createGameState(
  seed: number,
  width = DEFAULT_GAME_WIDTH,
  height = DEFAULT_GAME_HEIGHT,
): GameState {
  const normalizedSeed = normalizeSeed(seed);
  const arena = createArena(width, height);

  return {
    phase: "ready",
    arena,
    seed: normalizedSeed,
    rngState: normalizedSeed,
    nextEntityId: 1,
    elapsedMs: 0,
    score: 0,
    attacksDodged: 0,
    hazardsSurvived: 0,
    lastHitSource: null,
    player: {
      position: { x: arena.width / 2, y: arena.height / 2 },
      direction: { ...PLAYER_START_DIRECTION },
    },
    projectiles: [],
    hazards: [],
    sequences: [],
    spawn: {
      toolCallMs: GAMEPLAY.toolCallFirstSpawnMs,
      approvalMs: GAMEPLAY.approvalFirstSpawnMs,
      compactionMs: GAMEPLAY.compactionFirstSpawnMs,
      retryLoopMs: GAMEPLAY.retryLoopFirstSpawnMs,
      reasoningMs: GAMEPLAY.reasoningFirstSpawnMs,
      parallelAgentsMs: GAMEPLAY.parallelAgentsFirstSpawnMs,
      reviewLoopMs: GAMEPLAY.reviewLoopFirstSpawnMs,
      usageLimitMs: GAMEPLAY.usageLimitFirstSpawnMs,
    },
  };
}

export function startRun(state: GameState): GameEvent[] {
  if (state.phase !== "ready") {
    return [];
  }

  state.phase = "playing";
  return [{ type: "run-started" }];
}

export function restartRun(
  seed: number,
  width = DEFAULT_GAME_WIDTH,
  height = DEFAULT_GAME_HEIGHT,
): GameState {
  const state = createGameState(seed, width, height);
  startRun(state);
  return state;
}

export function resizeArena(
  state: GameState,
  width: number,
  height: number,
): void {
  state.arena = createArena(width, height);
  state.player.position = clampPointToArena(
    state.player.position,
    state.arena,
    GAMEPLAY.playerRadius,
  );

  for (const hazard of state.hazards) {
    const size = fitSquareSize(hazard.hitbox.width, state.arena);
    hazard.hitbox = { width: size, height: size };
    hazard.position = clampRectangleCenter(
      hazard.position,
      hazard.hitbox,
      state.arena,
    );
  }

  for (const sequence of state.sequences) {
    sequence.position = clampPointToArena(sequence.position, state.arena, 36);
    sequence.origins = sequence.origins.map((origin) =>
      clampPointToArena(origin, state.arena, 0),
    );
  }
}

function movePlayer(
  state: GameState,
  requestedDirection: Vec2,
  stepSeconds: number,
): void {
  if (
    !Number.isFinite(requestedDirection.x) ||
    !Number.isFinite(requestedDirection.y)
  ) {
    return;
  }

  const magnitude = Math.hypot(requestedDirection.x, requestedDirection.y);
  if (magnitude <= Number.EPSILON) {
    return;
  }

  const direction = normalize(requestedDirection, state.player.direction);
  const nextPosition = clampPointToArena(
    {
      x: state.player.position.x + direction.x * GAMEPLAY.playerSpeed * stepSeconds,
      y: state.player.position.y + direction.y * GAMEPLAY.playerSpeed * stepSeconds,
    },
    state.arena,
    GAMEPLAY.playerRadius,
  );
  state.player.direction = direction;
  state.player.position = nextPosition;
}

export function stepGame(
  state: GameState,
  intent: InputIntent,
  stepMs: number,
): GameEvent[] {
  if (state.phase !== "playing" || !Number.isFinite(stepMs) || stepMs <= 0) {
    return [];
  }

  const events: GameEvent[] = [];
  const stepSeconds = stepMs / 1_000;
  state.elapsedMs += stepMs;
  state.score = Math.floor(state.elapsedMs);

  movePlayer(state, intent.direction, stepSeconds);
  updateProjectiles(state, stepMs, stepSeconds);
  updateHazards(state, stepMs, events);
  updateSequences(state, stepMs, events);
  spawnScheduledAttacks(state, stepMs, events);

  const hitSource = findHitSource(state);
  if (hitSource) {
    finishRun(state, hitSource, events);
  }

  return events;
}

function createArena(width: number, height: number): ArenaBounds {
  return {
    width: validDimension(width, DEFAULT_GAME_WIDTH),
    height: validDimension(height, DEFAULT_GAME_HEIGHT),
  };
}

function validDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampPointToArena(
  point: Vec2,
  arena: ArenaBounds,
  inset: number,
): Vec2 {
  return {
    x: clampAxis(point.x, arena.width, inset),
    y: clampAxis(point.y, arena.height, inset),
  };
}

function clampAxis(value: number, size: number, inset: number): number {
  if (size <= inset * 2) {
    return size / 2;
  }
  return Math.min(size - inset, Math.max(inset, value));
}

function updateProjectiles(
  state: GameState,
  stepMs: number,
  stepSeconds: number,
): void {
  const survivors: ProjectileState[] = [];

  for (const projectile of state.projectiles) {
    projectile.ageMs += stepMs;

    if (projectile.telegraphRemainingMs > 0) {
      projectile.telegraphRemainingMs = Math.max(
        0,
        projectile.telegraphRemainingMs - stepMs,
      );
    } else {
      projectile.position.x += projectile.velocity.x * projectile.speed * stepSeconds;
      projectile.position.y += projectile.velocity.y * projectile.speed * stepSeconds;
      if (projectile.kind === "context-token") {
        projectile.velocity.x *= Math.pow(
          GAMEPLAY.contextTokenHorizontalDragPerSecond,
          stepSeconds,
        );
        projectile.velocity.y +=
          GAMEPLAY.contextTokenGravityPerSecond * stepSeconds;
      }
    }

    if (isInsideProjectileBounds(state, projectile.position)) {
      survivors.push(projectile);
    } else if (projectile.telegraphRemainingMs <= 0) {
      state.attacksDodged += 1;
    }
  }

  state.projectiles = survivors;
}

function updateHazards(
  state: GameState,
  stepMs: number,
  events: GameEvent[],
): void {
  const survivors: AreaHazardState[] = [];

  for (const hazard of state.hazards) {
    hazard.remainingMs -= stepMs;

    if (hazard.remainingMs > 0) {
      survivors.push(hazard);
      continue;
    }

    if (hazard.phase === "telegraph") {
      hazard.phase = "active";
      hazard.remainingMs = GAMEPLAY.compactionActiveMs;
      survivors.push(hazard);
      const difficulty = difficultyAt(state.elapsedMs);
      spawnContextTokens(
        state,
        hazard.position,
        difficulty.compactionFragmentCount,
        difficulty.compactionFragmentSpeed,
      );
      events.push({
        type: "hazard-activated",
        kind: hazard.kind,
        position: { ...hazard.position },
      });
    } else {
      state.hazardsSurvived += 1;
    }
  }

  state.hazards = survivors;
}

function updateSequences(
  state: GameState,
  stepMs: number,
  events: GameEvent[],
): void {
  const survivors: AttackSequenceState[] = [];

  for (const sequence of state.sequences) {
    sequence.remainingMs -= stepMs;
    if (sequence.remainingMs > 0) {
      survivors.push(sequence);
      continue;
    }

    const projectileKind =
      sequence.kind === "review-loop" ? "finding" : "limit";
    spawnRadialProjectiles(
      state,
      projectileKind,
      sequence.resultLabel,
      sequence.position,
      sequence.projectileCount,
      sequence.projectileSpeed,
    );
    events.push({
      type: "pattern-burst",
      kind: sequence.kind,
      position: { ...sequence.position },
    });
  }

  state.sequences = survivors;
}

function spawnScheduledAttacks(
  state: GameState,
  stepMs: number,
  events: GameEvent[],
): void {
  const difficulty = difficultyAt(state.elapsedMs);
  state.spawn.toolCallMs -= stepMs;
  state.spawn.approvalMs -= stepMs;
  state.spawn.compactionMs -= stepMs;
  state.spawn.retryLoopMs -= stepMs;
  state.spawn.reasoningMs -= stepMs;
  state.spawn.parallelAgentsMs -= stepMs;
  state.spawn.reviewLoopMs -= stepMs;
  state.spawn.usageLimitMs -= stepMs;

  if (state.spawn.toolCallMs <= 0) {
    spawnToolCallVolley(
      state,
      difficulty.toolCallBurst,
      difficulty.toolCallSpeed,
    );
    state.spawn.toolCallMs += difficulty.toolCallIntervalMs;
  }

  if (difficulty.approvalUnlocked && state.spawn.approvalMs <= 0) {
    if (spawnApproval(state, difficulty.approvalSpeed)) {
      events.push({ type: "pattern-warning", kind: "approval-required" });
    }
    state.spawn.approvalMs += difficulty.approvalIntervalMs;
  }

  if (difficulty.compactionUnlocked && state.spawn.compactionMs <= 0) {
    const available = Math.min(
      difficulty.compactionCount,
      GAMEPLAY.maxHazards - state.hazards.length,
    );
    for (let index = 0; index < available; index += 1) {
      const target =
        index === 0
          ? state.player.position
          : randomRectangleCenter(
              state,
              squareHitbox(difficulty.compactionSize, state.arena),
            );
      if (spawnCompaction(state, difficulty.compactionSize, target)) {
        events.push({ type: "hazard-warning", kind: "compaction" });
      }
    }
    state.spawn.compactionMs += difficulty.compactionIntervalMs;
  }

  if (difficulty.retryLoopUnlocked && state.spawn.retryLoopMs <= 0) {
    spawnRetryLoop(
      state,
      difficulty.retryLoopCount,
      difficulty.approvalSpeed * 0.94,
    );
    events.push({ type: "pattern-warning", kind: "retry-loop" });
    state.spawn.retryLoopMs += difficulty.retryLoopIntervalMs;
  }

  if (difficulty.reasoningUnlocked && state.spawn.reasoningMs <= 0) {
    if (spawnReasoningXhigh(state, difficulty.reasoningSpeed)) {
      events.push({ type: "pattern-warning", kind: "reasoning-xhigh" });
    }
    state.spawn.reasoningMs += difficulty.reasoningIntervalMs;
  }

  if (
    difficulty.parallelAgentsUnlocked &&
    state.spawn.parallelAgentsMs <= 0
  ) {
    spawnParallelAgents(
      state,
      difficulty.parallelAgentPairs,
      difficulty.parallelAgentSpeed,
    );
    events.push({ type: "pattern-warning", kind: "parallel-agents" });
    state.spawn.parallelAgentsMs += difficulty.parallelAgentsIntervalMs;
  }

  if (difficulty.reviewLoopUnlocked && state.spawn.reviewLoopMs <= 0) {
    if (
      spawnSequence(
        state,
        "review-loop",
        difficulty.reviewFindingCount,
        difficulty.reviewFindingSpeed,
      )
    ) {
      events.push({ type: "pattern-warning", kind: "review-loop" });
    }
    state.spawn.reviewLoopMs += difficulty.reviewLoopIntervalMs;
  }

  if (difficulty.usageLimitUnlocked && state.spawn.usageLimitMs <= 0) {
    if (
      spawnSequence(
        state,
        "usage-limit",
        difficulty.limitFragmentCount,
        difficulty.limitFragmentSpeed,
        difficulty.usageDrainCount,
      )
    ) {
      events.push({ type: "pattern-warning", kind: "usage-limit" });
    }
    state.spawn.usageLimitMs += difficulty.usageLimitIntervalMs;
  }
}

function spawnToolCallVolley(
  state: GameState,
  count: number,
  speed: number,
): void {
  const available = Math.min(
    count,
    GAMEPLAY.maxProjectiles - state.projectiles.length,
  );
  if (available <= 0) {
    return;
  }

  for (let index = 0; index < available; index += 1) {
    const sourceEdge = Math.floor(randomBetween(state, 0, 4));
    const targetEdge = sourceEdge ^ 1;
    const sourceAlongSize =
      sourceEdge < 2 ? state.arena.height : state.arena.width;
    const targetAlongSize =
      targetEdge < 2 ? state.arena.height : state.arena.width;
    const position = pointOnEdge(
      state.arena,
      sourceEdge,
      randomBetween(state, sourceAlongSize * 0.08, sourceAlongSize * 0.92),
      20,
    );
    const target = pointOnEdge(
      state.arena,
      targetEdge,
      randomBetween(state, targetAlongSize * 0.08, targetAlongSize * 0.92),
      20,
    );
    const entry = randomToolCallEntry(state);

    addProjectile(
      state,
      "tool-call",
      entry.surface,
      entry.label,
      position,
      target,
      toolCallHitbox(entry.label),
      speed,
      GAMEPLAY.toolCallTelegraphMs + index * 35,
    );
  }
}

function spawnApproval(state: GameState, speed: number): boolean {
  if (state.projectiles.length >= GAMEPLAY.maxProjectiles) {
    return false;
  }

  const edge = Math.floor(randomBetween(state, 0, 4));
  const alongSize = edge < 2 ? state.arena.height : state.arena.width;
  const position = pointOnEdge(
    state.arena,
    edge,
    randomBetween(state, alongSize * 0.12, alongSize * 0.88),
    18,
  );
  const target = { ...state.player.position };
  const entry = randomApprovalEntry(state);

  addProjectile(
    state,
    "approval",
    entry.surface,
    entry.label,
    position,
    target,
    {
      width: labelHitboxWidth(
        entry.label,
        GAMEPLAY.approvalHitboxMinWidth,
        GAMEPLAY.approvalHitboxMaxWidth,
      ),
      height: GAMEPLAY.approvalHitboxHeight,
    },
    speed,
    GAMEPLAY.approvalTelegraphMs,
  );
  return true;
}

function spawnRetryLoop(state: GameState, count: number, speed: number): void {
  const available = Math.min(
    count,
    GAMEPLAY.maxProjectiles - state.projectiles.length,
  );
  if (available <= 0) {
    return;
  }

  const edge = Math.floor(randomBetween(state, 0, 4));
  const alongSize = edge < 2 ? state.arena.height : state.arena.width;
  const baseAlong = randomBetween(state, alongSize * 0.2, alongSize * 0.8);
  const target = { ...state.player.position };

  for (let index = 0; index < available; index += 1) {
    const label = `[tool] retry ${index + 1}/${available}`;
    const offset = (index - (available - 1) / 2) * 24;
    const position = pointOnEdge(
      state.arena,
      edge,
      Math.min(alongSize - 20, Math.max(20, baseAlong + offset)),
      24,
    );
    addProjectile(
      state,
      "retry",
      "codex",
      label,
      position,
      target,
      { width: 70, height: 15 },
      speed,
      520 + index * 260,
    );
  }
}

function spawnReasoningXhigh(state: GameState, speed: number): boolean {
  if (state.projectiles.length >= GAMEPLAY.maxProjectiles) {
    return false;
  }

  const edge = Math.floor(randomBetween(state, 0, 4));
  const alongSize = edge < 2 ? state.arena.height : state.arena.width;
  const position = pointOnEdge(
    state.arena,
    edge,
    randomBetween(state, alongSize * 0.16, alongSize * 0.84),
    24,
  );
  const label = "[effort] xhigh · thinking...";
  addProjectile(
    state,
    "reasoning",
    "codex",
    label,
    position,
    { ...state.player.position },
    { width: 154, height: 17 },
    speed,
    GAMEPLAY.reasoningTelegraphMs,
  );
  return true;
}

function spawnParallelAgents(
  state: GameState,
  pairCount: number,
  speed: number,
): void {
  const availablePairs = Math.min(
    pairCount,
    Math.floor((GAMEPLAY.maxProjectiles - state.projectiles.length) / 2),
  );
  const target = { ...state.player.position };

  for (let index = 0; index < availablePairs; index += 1) {
    const horizontal = index % 2 === 0;
    const offset = (index - (availablePairs - 1) / 2) * 34;
    const pairTarget = horizontal
      ? {
          x: target.x,
          y: clampAxis(target.y + offset, state.arena.height, 36),
        }
      : {
          x: clampAxis(target.x + offset, state.arena.width, 36),
          y: target.y,
        };
    const positions = horizontal
      ? [
          { x: -24, y: pairTarget.y },
          { x: state.arena.width + 24, y: pairTarget.y },
        ]
      : [
          { x: pairTarget.x, y: -24 },
          { x: pairTarget.x, y: state.arena.height + 24 },
        ];

    addProjectile(
      state,
      "agent",
      "codex",
      `[agent ${index * 2 + 1}] working`,
      positions[0]!,
      pairTarget,
      { width: 92, height: 15 },
      speed,
      760 + index * 100,
    );
    addProjectile(
      state,
      "agent",
      "codex",
      `[agent ${index * 2 + 2}] working`,
      positions[1]!,
      pairTarget,
      { width: 92, height: 15 },
      speed,
      760 + index * 100,
    );
  }
}

function spawnSequence(
  state: GameState,
  kind: "review-loop" | "usage-limit",
  projectileCount: number,
  projectileSpeed: number,
  mergeIncomingCount = 4,
): boolean {
  if (state.sequences.length >= GAMEPLAY.maxSequences) {
    return false;
  }

  const position =
    kind === "review-loop"
      ? randomRectangleCenter(state, { width: 220, height: 220 })
      : clampPointToArena(state.player.position, state.arena, 90);
  const originCount = kind === "review-loop" ? 4 : mergeIncomingCount;
  const origins: Vec2[] = [];

  for (let index = 0; index < originCount; index += 1) {
    const edge =
      index % 4;
    const alongSize = edge < 2 ? state.arena.height : state.arena.width;
    origins.push(
      pointOnEdge(
        state.arena,
        edge,
        randomBetween(state, alongSize * 0.12, alongSize * 0.88),
        28,
      ),
    );
  }

  const durationMs =
    kind === "review-loop"
      ? GAMEPLAY.reviewLoopConvergeMs
      : GAMEPLAY.usageLimitConvergeMs;
  state.sequences.push({
    id: takeEntityId(state),
    kind,
    label:
      kind === "review-loop"
        ? "[review] fixing findings"
        : "[usage] limit draining",
    position,
    origins,
    remainingMs: durationMs,
    durationMs,
    projectileCount,
    projectileSpeed,
    resultLabel:
      kind === "review-loop"
        ? "ONE MORE ISSUE"
        : randomUsageLimitResult(state),
  });
  return true;
}

function spawnRadialProjectiles(
  state: GameState,
  kind: "finding" | "limit",
  label: string,
  center: Vec2,
  count: number,
  speed: number,
): void {
  const available = Math.min(
    count,
    GAMEPLAY.maxProjectiles - state.projectiles.length,
  );
  if (available <= 0) {
    return;
  }

  const phase = randomBetween(state, 0, Math.PI * 2);
  for (let index = 0; index < available; index += 1) {
    const angle = phase + (Math.PI * 2 * index) / available;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const position = {
      x: center.x + direction.x * 56,
      y: center.y + direction.y * 56,
    };
    const target = {
      x: position.x + direction.x * 100,
      y: position.y + direction.y * 100,
    };
    addProjectile(
      state,
      kind,
      "codex",
      label,
      position,
      target,
      {
        width: kind === "finding" ? 86 : 78,
        height: GAMEPLAY.fragmentHitboxHeight,
      },
      speed,
      0,
    );
  }
}

function spawnContextTokens(
  state: GameState,
  center: Vec2,
  count: number,
  speed: number,
): void {
  const available = Math.min(
    count,
    GAMEPLAY.maxProjectiles - state.projectiles.length,
  );
  if (available <= 0) {
    return;
  }

  const phase = randomBetween(state, 0, Math.PI * 2);
  for (let index = 0; index < available; index += 1) {
    const angle = phase + (Math.PI * 2 * index) / available;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const position = {
      x: center.x + direction.x * GAMEPLAY.contextTokenBurstRadius,
      y: center.y + direction.y * GAMEPLAY.contextTokenBurstRadius,
    };
    const target = {
      x: position.x + direction.x * 100,
      y: position.y + direction.y * 100,
    };
    addProjectile(
      state,
      "context-token",
      "codex",
      CONTEXT_TOKEN_LABELS[index % CONTEXT_TOKEN_LABELS.length]!,
      position,
      target,
      {
        width: GAMEPLAY.contextTokenHitboxWidth,
        height: GAMEPLAY.contextTokenHitboxHeight,
      },
      speed * (0.76 + (index % 5) * 0.07),
      0,
    );
  }
}

function addProjectile(
  state: GameState,
  kind: ProjectileKind,
  surface: AttackSurface,
  label: ProjectileLabel,
  position: Vec2,
  target: Vec2,
  hitbox: RectangleHitbox,
  speed: number,
  telegraphMs: number,
): void {
  state.projectiles.push({
    id: takeEntityId(state),
    kind,
    surface,
    label,
    position,
    velocity: directionBetween(position, target),
    hitbox,
    speed,
    ageMs: 0,
    telegraphRemainingMs: telegraphMs,
  });
}

function randomToolCallEntry(
  state: GameState,
): (typeof TOOL_CALL_ENTRIES)[number] {
  const index = Math.floor(randomBetween(state, 0, TOOL_CALL_ENTRIES.length));
  return TOOL_CALL_ENTRIES[index] ?? TOOL_CALL_ENTRIES[0];
}

function randomApprovalEntry(
  state: GameState,
): (typeof APPROVAL_ENTRIES)[number] {
  const index = Math.floor(randomBetween(state, 0, APPROVAL_ENTRIES.length));
  return APPROVAL_ENTRIES[index] ?? APPROVAL_ENTRIES[0];
}

function randomUsageLimitResult(state: GameState): SequenceResultLabel {
  const index = Math.floor(randomBetween(state, 0, USAGE_LIMIT_RESULTS.length));
  return USAGE_LIMIT_RESULTS[index] ?? USAGE_LIMIT_RESULTS[0];
}

function toolCallHitbox(label: ToolCallLabel): RectangleHitbox {
  return {
    width: labelHitboxWidth(
      label,
      GAMEPLAY.toolCallHitboxMinWidth,
      GAMEPLAY.toolCallHitboxMaxWidth,
    ),
    height: GAMEPLAY.toolCallHitboxHeight,
  };
}

function labelHitboxWidth(
  label: ProjectileLabel,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, 14 + label.length * 6));
}

function pointOnEdge(
  arena: ArenaBounds,
  edge: number,
  along: number,
  margin: number,
): Vec2 {
  if (edge === 0) {
    return { x: -margin, y: along };
  }
  if (edge === 1) {
    return { x: arena.width + margin, y: along };
  }
  if (edge === 2) {
    return { x: along, y: -margin };
  }
  return { x: along, y: arena.height + margin };
}

function spawnCompaction(
  state: GameState,
  requestedSize: number,
  target: Vec2,
): boolean {
  if (state.hazards.length >= GAMEPLAY.maxHazards) {
    return false;
  }

  const hitbox = squareHitbox(requestedSize, state.arena);
  const position = clampRectangleCenter(
    target,
    hitbox,
    state.arena,
  );

  state.hazards.push({
    id: takeEntityId(state),
    kind: "compaction",
    label: "CONTEXT COMPACTION",
    position,
    hitbox,
    phase: "telegraph",
    remainingMs: GAMEPLAY.compactionTelegraphMs,
  });
  return true;
}

function squareHitbox(size: number, arena: ArenaBounds): RectangleHitbox {
  const fittedSize = fitSquareSize(size, arena);
  return { width: fittedSize, height: fittedSize };
}

function fitSquareSize(size: number, arena: ArenaBounds): number {
  return Math.max(
    1,
    Math.min(
      size,
      Math.min(arena.width, arena.height) *
        GAMEPLAY.compactionMaxViewportRatio,
    ),
  );
}

function clampRectangleCenter(
  position: Vec2,
  hitbox: RectangleHitbox,
  arena: ArenaBounds,
): Vec2 {
  return {
    x: clampAxis(position.x, arena.width, hitbox.width / 2),
    y: clampAxis(position.y, arena.height, hitbox.height / 2),
  };
}

function randomRectangleCenter(
  state: GameState,
  hitbox: RectangleHitbox,
): Vec2 {
  const halfWidth = Math.min(hitbox.width / 2, state.arena.width / 2);
  const halfHeight = Math.min(hitbox.height / 2, state.arena.height / 2);
  return {
    x: randomBetween(
      state,
      halfWidth,
      state.arena.width - halfWidth,
    ),
    y: randomBetween(
      state,
      halfHeight,
      state.arena.height - halfHeight,
    ),
  };
}

function findHitSource(state: GameState): HitSource | null {
  for (const projectile of state.projectiles) {
    if (
      projectile.telegraphRemainingMs <= 0 &&
      circleOverlapsOrientedRectangle(
        state.player.position,
        GAMEPLAY.playerRadius,
        projectile.position,
        projectile.hitbox,
        projectile.velocity,
      )
    ) {
      return projectile.kind;
    }
  }

  return null;
}

function isInsideProjectileBounds(state: GameState, position: Vec2): boolean {
  const margin = GAMEPLAY.projectileMargin;
  return (
    position.x >= -margin &&
    position.x <= state.arena.width + margin &&
    position.y >= -margin &&
    position.y <= state.arena.height + margin
  );
}

function randomBetween(state: GameState, minimum: number, maximum: number): number {
  const random = nextRandom(state.rngState);
  state.rngState = random.state;
  return minimum + random.value * (maximum - minimum);
}

function takeEntityId(state: GameState): number {
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  return id;
}

function finishRun(
  state: GameState,
  source: HitSource,
  events: GameEvent[],
): void {
  if (state.phase !== "playing") {
    return;
  }

  state.phase = "results";
  state.lastHitSource = source;
  events.push({ type: "player-hit", source });
  events.push({ type: "run-ended", finalScore: state.score, source });
}
