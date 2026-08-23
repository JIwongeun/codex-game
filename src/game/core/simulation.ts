import {
  DEFAULT_GAME_HEIGHT,
  DEFAULT_GAME_WIDTH,
  GAMEPLAY,
} from "../constants";
import { circlesOverlap, directionBetween, normalize } from "./math";
import type {
  AreaHazardState,
  ArenaBounds,
  GameEvent,
  GameState,
  HitSource,
  InputIntent,
  ProjectileKind,
  ProjectileState,
  SweepAxis,
  Vec2,
} from "./model";
import { nextRandom, normalizeSeed } from "./random";
import { difficultyAt } from "./rules";

const PLAYER_START_DIRECTION: Vec2 = { x: 1, y: 0 };

export const EMPTY_INPUT: InputIntent = { position: null };

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
      tabMs: GAMEPLAY.tabFirstSpawnMs,
      popupMs: GAMEPLAY.popupFirstSpawnMs,
      memoryLeakMs: GAMEPLAY.memoryLeakFirstSpawnMs,
      contextSweepMs: GAMEPLAY.contextSweepFirstSpawnMs,
    },
  };
}

export function startRun(
  state: GameState,
  initialPosition: Vec2 | null = null,
): GameEvent[] {
  if (state.phase !== "ready") {
    return [];
  }

  placePlayer(state, initialPosition);
  state.phase = "playing";
  return [{ type: "run-started" }];
}

export function restartRun(
  seed: number,
  width = DEFAULT_GAME_WIDTH,
  height = DEFAULT_GAME_HEIGHT,
  initialPosition: Vec2 | null = null,
): GameState {
  const state = createGameState(seed, width, height);
  startRun(state, initialPosition);
  return state;
}

export function resizeArena(
  state: GameState,
  width: number,
  height: number,
): void {
  state.arena = createArena(width, height);
  placePlayer(state, state.player.position);

  for (const hazard of state.hazards) {
    if (hazard.kind === "memory-leak") {
      hazard.radius = fitCircleRadius(hazard.radius, state.arena);
      hazard.position = clampCircleCenter(
        hazard.position,
        hazard.radius,
        state.arena,
      );
      continue;
    }

    const crossAxisSize =
      hazard.axis === "horizontal" ? state.arena.height : state.arena.width;
    hazard.thickness = Math.min(hazard.thickness, crossAxisSize * 0.45);
    hazard.position = clampSweepCenter(hazard, state.arena);
  }
}

export function placePlayer(
  state: GameState,
  requestedPosition: Vec2 | null,
): void {
  if (!requestedPosition) {
    return;
  }

  const nextPosition = clampPointToArena(
    requestedPosition,
    state.arena,
    GAMEPLAY.playerRadius,
  );
  const movement = {
    x: nextPosition.x - state.player.position.x,
    y: nextPosition.y - state.player.position.y,
  };

  if (Math.hypot(movement.x, movement.y) > Number.EPSILON) {
    state.player.direction = normalize(movement, state.player.direction);
  }

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

  placePlayer(state, intent.position);
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
      projectile.velocity = directionBetween(
        projectile.position,
        state.player.position,
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
        hazard.kind === "memory-leak"
          ? GAMEPLAY.memoryLeakActiveMs
          : GAMEPLAY.contextSweepActiveMs;
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
  state.spawn.tabMs -= stepMs;
  state.spawn.popupMs -= stepMs;
  state.spawn.memoryLeakMs -= stepMs;
  state.spawn.contextSweepMs -= stepMs;

  if (state.spawn.tabMs <= 0) {
    spawnTabVolley(state, difficulty.tabBurst, difficulty.tabSpeed);
    state.spawn.tabMs += difficulty.tabIntervalMs;
  }

  if (difficulty.popupUnlocked && state.spawn.popupMs <= 0) {
    spawnPopup(state, difficulty.popupSpeed);
    state.spawn.popupMs += difficulty.popupIntervalMs;
  }

  if (difficulty.memoryLeakUnlocked && state.spawn.memoryLeakMs <= 0) {
    if (spawnMemoryLeak(state, difficulty.memoryLeakRadius)) {
      events.push({ type: "hazard-warning", kind: "memory-leak" });
    }
    state.spawn.memoryLeakMs += difficulty.memoryLeakIntervalMs;
  }

  if (difficulty.contextSweepUnlocked && state.spawn.contextSweepMs <= 0) {
    if (spawnContextSweep(state, difficulty.contextSweepThickness)) {
      events.push({ type: "hazard-warning", kind: "context-sweep" });
    }
    state.spawn.contextSweepMs += difficulty.contextSweepIntervalMs;
  }
}

function spawnTabVolley(state: GameState, count: number, speed: number): void {
  const available = Math.min(
    count,
    GAMEPLAY.maxProjectiles - state.projectiles.length,
  );
  if (available <= 0) {
    return;
  }

  const edge = Math.floor(randomBetween(state, 0, 4));
  const alongSize = edge < 2 ? state.arena.height : state.arena.width;
  const base = randomBetween(state, alongSize * 0.18, alongSize * 0.82);
  const spacing = Math.min(38, Math.max(22, alongSize / 18));

  for (let index = 0; index < available; index += 1) {
    const centeredIndex = index - (available - 1) / 2;
    const along = clampAxis(base + centeredIndex * spacing, alongSize, 12);
    const position = pointOnEdge(state.arena, edge, along, 20);
    const target = {
      x: clampAxis(
        state.player.position.x +
          (edge < 2 ? randomBetween(state, -32, 32) : centeredIndex * 18),
        state.arena.width,
        0,
      ),
      y: clampAxis(
        state.player.position.y +
          (edge < 2 ? centeredIndex * 18 : randomBetween(state, -32, 32)),
        state.arena.height,
        0,
      ),
    };

    addProjectile(
      state,
      "tab",
      position,
      target,
      speed,
      GAMEPLAY.tabTelegraphMs + index * 35,
    );
  }
}

function spawnPopup(state: GameState, speed: number): boolean {
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
  const target = {
    x: clampAxis(
      state.player.position.x + randomBetween(state, -24, 24),
      state.arena.width,
      0,
    ),
    y: clampAxis(
      state.player.position.y + randomBetween(state, -24, 24),
      state.arena.height,
      0,
    ),
  };

  addProjectile(
    state,
    "popup",
    position,
    target,
    speed,
    GAMEPLAY.popupTelegraphMs,
  );
  return true;
}

function addProjectile(
  state: GameState,
  kind: ProjectileKind,
  position: Vec2,
  target: Vec2,
  speed: number,
  telegraphMs: number,
): void {
  state.projectiles.push({
    id: takeEntityId(state),
    kind,
    position,
    velocity: directionBetween(position, target),
    radius: kind === "tab" ? GAMEPLAY.projectileRadius : GAMEPLAY.popupRadius,
    speed,
    ageMs: 0,
    telegraphRemainingMs: telegraphMs,
  });
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

function spawnMemoryLeak(state: GameState, requestedRadius: number): boolean {
  if (state.hazards.length >= GAMEPLAY.maxHazards) {
    return false;
  }

  const radius = fitCircleRadius(requestedRadius, state.arena);
  const position = clampCircleCenter(
    {
      x: state.player.position.x + randomBetween(state, -150, 150),
      y: state.player.position.y + randomBetween(state, -125, 125),
    },
    radius,
    state.arena,
  );

  state.hazards.push({
    id: takeEntityId(state),
    kind: "memory-leak",
    position,
    radius,
    axis: null,
    thickness: 0,
    phase: "telegraph",
    remainingMs: GAMEPLAY.memoryLeakTelegraphMs,
  });
  return true;
}

function fitCircleRadius(radius: number, arena: ArenaBounds): number {
  return Math.min(radius, Math.max(18, Math.min(arena.width, arena.height) * 0.34));
}

function clampCircleCenter(
  position: Vec2,
  radius: number,
  arena: ArenaBounds,
): Vec2 {
  return {
    x: clampAxis(position.x, arena.width, radius),
    y: clampAxis(position.y, arena.height, radius),
  };
}

function spawnContextSweep(state: GameState, requestedThickness: number): boolean {
  if (state.hazards.length >= GAMEPLAY.maxHazards) {
    return false;
  }

  const axis: SweepAxis = randomBetween(state, 0, 1) < 0.5 ? "horizontal" : "vertical";
  const crossAxisSize = axis === "horizontal" ? state.arena.height : state.arena.width;
  const thickness = Math.min(requestedThickness, crossAxisSize * 0.45);
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
    kind: "context-sweep",
    position,
    radius: 0,
    axis,
    thickness,
    phase: "telegraph",
    remainingMs: GAMEPLAY.contextSweepTelegraphMs,
  });
  return true;
}

function clampSweepCenter(
  hazard: AreaHazardState,
  arena: ArenaBounds,
): Vec2 {
  return hazard.axis === "horizontal"
    ? {
        x: arena.width / 2,
        y: clampAxis(hazard.position.y, arena.height, hazard.thickness / 2),
      }
    : {
        x: clampAxis(hazard.position.x, arena.width, hazard.thickness / 2),
        y: arena.height / 2,
      };
}

function findHitSource(state: GameState): HitSource | null {
  for (const projectile of state.projectiles) {
    if (
      projectile.telegraphRemainingMs <= 0 &&
      circlesOverlap(
        state.player.position,
        GAMEPLAY.playerRadius,
        projectile.position,
        projectile.radius,
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
      hazard.kind === "memory-leak" &&
      circlesOverlap(
        state.player.position,
        GAMEPLAY.playerRadius,
        hazard.position,
        hazard.radius,
      )
    ) {
      return hazard.kind;
    }

    if (hazard.kind === "context-sweep" && sweepTouchesPlayer(hazard, state.player.position)) {
      return hazard.kind;
    }
  }

  return null;
}

function sweepTouchesPlayer(hazard: AreaHazardState, player: Vec2): boolean {
  const halfThickness = hazard.thickness / 2;

  return hazard.axis === "horizontal"
    ? Math.abs(player.y - hazard.position.y) <= halfThickness + GAMEPLAY.playerRadius
    : Math.abs(player.x - hazard.position.x) <= halfThickness + GAMEPLAY.playerRadius;
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
