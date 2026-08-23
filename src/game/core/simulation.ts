import {
  DEFAULT_GAME_HEIGHT,
  DEFAULT_GAME_WIDTH,
  GAMEPLAY,
} from "../constants";
import { circleOverlapsRectangle, directionBetween, normalize } from "./math";
import type {
  AreaHazardState,
  ArenaBounds,
  GameEvent,
  GameState,
  HitSource,
  InputIntent,
  LogLabel,
  ProjectileLabel,
  ProjectileKind,
  ProjectileState,
  RectangleHitbox,
  ReviewLabel,
  SweepAxis,
  Vec2,
} from "./model";
import { nextRandom, normalizeSeed } from "./random";
import { difficultyAt } from "./rules";

const PLAYER_START_DIRECTION: Vec2 = { x: 1, y: 0 };
const LOG_LABELS: readonly LogLabel[] = [
  "+ ONE MORE CHANGE",
  "TESTS STILL RUNNING...",
  "TOOL RETRY 3/3",
  "WORKING TREE DIRTY",
  "GIT COMMIT --AMEND",
  "CI: FAILED",
  "TS2322",
  "CONTEXT LEFT: 12%",
  "READING AGENTS.MD",
  "CHECKING WORKSPACE...",
  "FIXING ONE LAST TEST",
  "PR #404",
  "REBASE REQUIRED",
];
const REVIEW_LABELS: readonly ReviewLabel[] = [
  "APPROVAL REQUIRED",
  "REQUEST CHANGES",
  "NEEDS REBASE",
  "RUN COMMAND?",
];

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
    spawn: {
      logMs: GAMEPLAY.logFirstSpawnMs,
      reviewMs: GAMEPLAY.reviewFirstSpawnMs,
      contextMaxMs: GAMEPLAY.contextMaxFirstSpawnMs,
      mergeConflictMs: GAMEPLAY.mergeConflictFirstSpawnMs,
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
    if (hazard.kind === "context-max") {
      const size = fitSquareSize(hazard.hitbox.width, state.arena);
      hazard.hitbox = { width: size, height: size };
      hazard.position = clampRectangleCenter(
        hazard.position,
        hazard.hitbox,
        state.arena,
      );
      continue;
    }

    const crossAxisSize =
      hazard.axis === "horizontal" ? state.arena.height : state.arena.width;
    const currentThickness =
      hazard.axis === "horizontal"
        ? hazard.hitbox.height
        : hazard.hitbox.width;
    const thickness = Math.min(currentThickness, crossAxisSize * 0.45);
    hazard.hitbox = mergeConflictHitbox(
      hazard.axis ?? "horizontal",
      thickness,
      state.arena,
    );
    hazard.position = clampMergeConflictCenter(hazard, state.arena);
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
      hazard.remainingMs =
        hazard.kind === "context-max"
          ? GAMEPLAY.contextMaxActiveMs
          : GAMEPLAY.mergeConflictActiveMs;
      survivors.push(hazard);
      events.push({ type: "hazard-activated", kind: hazard.kind });
    } else {
      state.hazardsSurvived += 1;
    }
  }

  state.hazards = survivors;
}

function spawnScheduledAttacks(
  state: GameState,
  stepMs: number,
  events: GameEvent[],
): void {
  const difficulty = difficultyAt(state.elapsedMs);
  state.spawn.logMs -= stepMs;
  state.spawn.reviewMs -= stepMs;
  state.spawn.contextMaxMs -= stepMs;
  state.spawn.mergeConflictMs -= stepMs;

  if (state.spawn.logMs <= 0) {
    spawnLogVolley(state, difficulty.logBurst, difficulty.logSpeed);
    state.spawn.logMs += difficulty.logIntervalMs;
  }

  if (difficulty.reviewUnlocked && state.spawn.reviewMs <= 0) {
    spawnReview(state, difficulty.reviewSpeed);
    state.spawn.reviewMs += difficulty.reviewIntervalMs;
  }

  if (difficulty.contextMaxUnlocked && state.spawn.contextMaxMs <= 0) {
    if (spawnContextMax(state, difficulty.contextMaxSize)) {
      events.push({ type: "hazard-warning", kind: "context-max" });
    }
    state.spawn.contextMaxMs += difficulty.contextMaxIntervalMs;
  }

  if (
    difficulty.mergeConflictUnlocked &&
    state.spawn.mergeConflictMs <= 0
  ) {
    if (
      spawnMergeConflict(state, difficulty.mergeConflictThickness)
    ) {
      events.push({ type: "hazard-warning", kind: "merge-conflict" });
    }
    state.spawn.mergeConflictMs += difficulty.mergeConflictIntervalMs;
  }
}

function spawnLogVolley(state: GameState, count: number, speed: number): void {
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
    const label = randomLogLabel(state);

    addProjectile(
      state,
      "log",
      label,
      position,
      target,
      logHitbox(label),
      speed,
      GAMEPLAY.logTelegraphMs + index * 35,
    );
  }
}

function spawnReview(state: GameState, speed: number): boolean {
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
  const label = randomReviewLabel(state);

  addProjectile(
    state,
    "review",
    label,
    position,
    target,
    {
      width: labelHitboxWidth(
        label,
        GAMEPLAY.reviewHitboxMinWidth,
        GAMEPLAY.reviewHitboxMaxWidth,
      ),
      height: GAMEPLAY.reviewHitboxHeight,
    },
    speed,
    GAMEPLAY.reviewTelegraphMs,
  );
  return true;
}

function addProjectile(
  state: GameState,
  kind: ProjectileKind,
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
    label,
    position,
    velocity: directionBetween(position, target),
    hitbox,
    speed,
    ageMs: 0,
    telegraphRemainingMs: telegraphMs,
  });
}

function randomLogLabel(state: GameState): LogLabel {
  const index = Math.floor(randomBetween(state, 0, LOG_LABELS.length));
  return LOG_LABELS[index] ?? LOG_LABELS[0];
}

function randomReviewLabel(state: GameState): ReviewLabel {
  const index = Math.floor(randomBetween(state, 0, REVIEW_LABELS.length));
  return REVIEW_LABELS[index] ?? REVIEW_LABELS[0];
}

function logHitbox(label: LogLabel): RectangleHitbox {
  return {
    width: labelHitboxWidth(
      label,
      GAMEPLAY.logHitboxMinWidth,
      GAMEPLAY.logHitboxMaxWidth,
    ),
    height: GAMEPLAY.logHitboxHeight,
  };
}

function labelHitboxWidth(
  label: ProjectileLabel,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, 18 + label.length * 6));
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

function spawnContextMax(state: GameState, requestedSize: number): boolean {
  if (state.hazards.length >= GAMEPLAY.maxHazards) {
    return false;
  }

  const size = fitSquareSize(requestedSize, state.arena);
  const hitbox = { width: size, height: size };
  const position = clampRectangleCenter(
    state.player.position,
    hitbox,
    state.arena,
  );

  state.hazards.push({
    id: takeEntityId(state),
    kind: "context-max",
    label: "CONTEXT MAX!",
    position,
    hitbox,
    axis: null,
    phase: "telegraph",
    remainingMs: GAMEPLAY.contextMaxTelegraphMs,
  });
  return true;
}

function fitSquareSize(size: number, arena: ArenaBounds): number {
  return Math.max(
    1,
    Math.min(size, Math.min(arena.width, arena.height) * 0.45),
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

function spawnMergeConflict(
  state: GameState,
  requestedThickness: number,
): boolean {
  if (state.hazards.length >= GAMEPLAY.maxHazards) {
    return false;
  }

  const axis: SweepAxis = randomBetween(state, 0, 1) < 0.5 ? "horizontal" : "vertical";
  const crossAxisSize = axis === "horizontal" ? state.arena.height : state.arena.width;
  const thickness = Math.min(requestedThickness, crossAxisSize * 0.45);
  const hitbox = mergeConflictHitbox(axis, thickness, state.arena);
  const position =
    axis === "horizontal"
      ? {
          x: state.arena.width / 2,
          y: randomBetween(state, thickness / 2, state.arena.height - thickness / 2),
        }
      : {
          x: randomBetween(state, thickness / 2, state.arena.width - thickness / 2),
          y: state.arena.height / 2,
        };

  state.hazards.push({
    id: takeEntityId(state),
    kind: "merge-conflict",
    label: "MERGE CONFLICT",
    position,
    hitbox,
    axis,
    phase: "telegraph",
    remainingMs: GAMEPLAY.mergeConflictTelegraphMs,
  });
  return true;
}

function mergeConflictHitbox(
  axis: SweepAxis,
  thickness: number,
  arena: ArenaBounds,
): RectangleHitbox {
  return axis === "horizontal"
    ? { width: arena.width, height: thickness }
    : { width: thickness, height: arena.height };
}

function clampMergeConflictCenter(
  hazard: AreaHazardState,
  arena: ArenaBounds,
): Vec2 {
  return hazard.axis === "horizontal"
    ? {
        x: arena.width / 2,
        y: clampAxis(
          hazard.position.y,
          arena.height,
          hazard.hitbox.height / 2,
        ),
      }
    : {
        x: clampAxis(
          hazard.position.x,
          arena.width,
          hazard.hitbox.width / 2,
        ),
        y: arena.height / 2,
      };
}

function findHitSource(state: GameState): HitSource | null {
  for (const projectile of state.projectiles) {
    if (
      projectile.telegraphRemainingMs <= 0 &&
      circleOverlapsRectangle(
        state.player.position,
        GAMEPLAY.playerRadius,
        projectile.position,
        projectile.hitbox,
      )
    ) {
      return projectile.kind;
    }
  }

  for (const hazard of state.hazards) {
    if (hazard.phase !== "active") {
      continue;
    }

    if (
      circleOverlapsRectangle(
        state.player.position,
        GAMEPLAY.playerRadius,
        hazard.position,
        hazard.hitbox,
      )
    ) {
      return hazard.kind;
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
