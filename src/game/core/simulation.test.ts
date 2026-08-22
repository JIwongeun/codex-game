import { describe, expect, it } from "vitest";

import {
  FIXED_STEP_MS,
  GAMEPLAY,
  RUN_DURATION_MS,
  STARTING_LIVES,
} from "../constants";
import type { EnemyKind, EnemyState, GameState, Vec2 } from "./model";
import { compactScore } from "./rules";
import {
  createGameState,
  EMPTY_INPUT,
  restartRun,
  startRun,
  stepGame,
} from "./simulation";

function playingState(seed = 1): GameState {
  const state = createGameState(seed);
  startRun(state);
  state.enemySpawn = {
    tabMs: RUN_DURATION_MS * 2,
    leakMs: RUN_DURATION_MS * 2,
    notificationMs: RUN_DURATION_MS * 2,
  };
  return state;
}

function enemy(
  id: number,
  position: Vec2,
  kind: EnemyKind = "tab",
): EnemyState {
  return {
    id,
    kind,
    position: { ...position },
    velocity: { x: 1, y: 0 },
    radius: kind === "leak" ? 20 : 12,
    ageMs: 0,
    behaviorMs:
      kind === "notification" ? GAMEPLAY.notificationTelegraphMs : 10_000,
    notificationMode: kind === "notification" ? "telegraph" : null,
  };
}

describe("game simulation", () => {
  it("starts anonymously with a deterministic token field", () => {
    const first = createGameState(42);
    const second = createGameState(42);

    expect(startRun(first)).toEqual([{ type: "run-started" }]);
    startRun(second);

    expect(first.phase).toBe("playing");
    expect(first.tokens).toHaveLength(GAMEPLAY.startingTokenCount);
    expect(first).toEqual(second);
    expect(startRun(first)).toEqual([]);
  });

  it("produces identical state for the same seed and fixed input stream", () => {
    const first = playingState(314_159);
    const second = playingState(314_159);

    for (let tick = 0; tick < 900; tick += 1) {
      const intent = {
        direction: { x: Math.cos(tick / 90), y: Math.sin(tick / 90) },
        compactPressed: tick > 0 && tick % 240 === 0,
      };
      stepGame(first, intent, FIXED_STEP_MS);
      stepGame(second, intent, FIXED_STEP_MS);
    }

    expect(first).toEqual(second);
  });

  it("ends exactly at the 90 second boundary and awards survival", () => {
    const state = playingState();
    let endEvents = [] as ReturnType<typeof stepGame>;

    for (let tick = 0; tick < 5_400; tick += 1) {
      endEvents = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    }

    expect(state.phase).toBe("results");
    expect(state.endReason).toBe("time");
    expect(state.remainingMs).toBe(0);
    expect(state.score).toBe(
      STARTING_LIVES * GAMEPLAY.survivalBonusPerLife,
    );
    expect(endEvents).toContainEqual({
      type: "run-ended",
      reason: "time",
      finalScore: state.score,
      survivalBonus: STARTING_LIVES * GAMEPLAY.survivalBonusPerLife,
    });
  });

  it("collects and compacts atomically before an enemy can collide", () => {
    const state = playingState();
    const nextPosition = {
      x: state.player.position.x +
        (GAMEPLAY.playerSpeed * FIXED_STEP_MS) / 1_000,
      y: state.player.position.y,
    };
    state.tokens = [{ id: 500, position: nextPosition, radius: GAMEPLAY.tokenRadius }];
    state.enemies = [enemy(600, { x: nextPosition.x + 40, y: nextPosition.y })];

    const events = stepGame(
      state,
      { direction: null, compactPressed: true },
      FIXED_STEP_MS,
    );

    expect(state.pendingTokens).toBe(0);
    expect(state.score).toBe(compactScore(1));
    expect(state.compactCount).toBe(1);
    expect(state.enemies).toHaveLength(0);
    expect(state.lives).toBe(STARTING_LIVES);
    expect(events.some((event) => event.type === "token-collected")).toBe(true);
    expect(events).toContainEqual({
      type: "compacted",
      bankedScore: compactScore(1),
      tokenCount: 1,
      radius: 120,
      clearedEnemies: 1,
    });
  });

  it("loses only pending context and one life during invulnerability", () => {
    const state = playingState();
    state.pendingTokens = 12;
    state.score = 2_000;
    state.enemies = [
      enemy(700, state.player.position),
      enemy(702, {
        x: state.player.position.x + GAMEPLAY.hitClearRadius - 40,
        y: state.player.position.y,
      }),
      enemy(703, {
        x: state.player.position.x + GAMEPLAY.hitClearRadius + 240,
        y: state.player.position.y,
      }),
    ];

    const firstHit = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    const livesAfterHit = state.lives;
    expect(state.enemies.some((candidate) => candidate.id === 702)).toBe(false);
    expect(state.enemies.some((candidate) => candidate.id === 703)).toBe(true);
    state.enemies.push(enemy(701, state.player.position));
    const ignoredHit = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    expect(livesAfterHit).toBe(STARTING_LIVES - 1);
    expect(state.lives).toBe(livesAfterHit);
    expect(state.pendingTokens).toBe(0);
    expect(state.score).toBe(2_000);
    expect(firstHit.some((event) => event.type === "player-hit")).toBe(true);
    expect(ignoredHit.some((event) => event.type === "player-hit")).toBe(false);
  });

  it("applies overflow damage once when the grace period expires", () => {
    const state = playingState();
    state.pendingTokens = GAMEPLAY.contextCapacity;
    state.overflowRemainingMs = FIXED_STEP_MS;

    const events = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    const nextEvents = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    expect(state.lives).toBe(STARTING_LIVES - 1);
    expect(state.pendingTokens).toBe(0);
    expect(state.overflowRemainingMs).toBeNull();
    expect(events).toContainEqual({
      type: "player-hit",
      source: "overflow",
      lives: STARTING_LIVES - 1,
    });
    expect(nextEvents.some((event) => event.type === "player-hit")).toBe(false);
  });

  it("keeps telegraphing notifications harmless", () => {
    const state = playingState();
    state.enemies = [enemy(800, state.player.position, "notification")];

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    expect(state.lives).toBe(STARTING_LIVES);
    expect(state.enemies).toHaveLength(1);
  });

  it("prioritizes depleted lives over a simultaneous timeout", () => {
    const state = playingState();
    state.lives = 1;
    state.elapsedMs = RUN_DURATION_MS - FIXED_STEP_MS;
    state.remainingMs = FIXED_STEP_MS;
    state.enemies = [enemy(900, state.player.position)];

    const events = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    expect(state.phase).toBe("results");
    expect(state.endReason).toBe("lives");
    expect(state.score).toBe(0);
    expect(events.at(-1)).toEqual({
      type: "run-ended",
      reason: "lives",
      finalScore: 0,
      survivalBonus: 0,
    });
  });

  it("freezes the simulation after results", () => {
    const state = playingState();
    state.lives = 1;
    state.enemies = [enemy(1_000, state.player.position)];
    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    const resultSnapshot = structuredClone(state);

    expect(stepGame(state, { direction: { x: 0, y: 1 }, compactPressed: true }, 5_000)).toEqual([]);
    expect(state).toEqual(resultSnapshot);
  });

  it("restarts with clean run state while changing the deterministic seed", () => {
    const state = restartRun(73);

    expect(state.phase).toBe("playing");
    expect(state.seed).toBe(73);
    expect(state.score).toBe(0);
    expect(state.pendingTokens).toBe(0);
    expect(state.lives).toBe(STARTING_LIVES);
    expect(state.tokens).toHaveLength(GAMEPLAY.startingTokenCount);
    expect(state.enemies).toHaveLength(0);
  });

  it("keeps all numeric and entity bounds valid across seeded soak runs", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const state = restartRun(seed);

      for (let tick = 0; tick < 5_400 && state.phase === "playing"; tick += 1) {
        stepGame(
          state,
          {
            direction: {
              x: Math.cos((tick + seed) / 75),
              y: Math.sin((tick + seed) / 75),
            },
            compactPressed: tick > 0 && tick % 300 === 0,
          },
          FIXED_STEP_MS,
        );

        expect(Number.isFinite(state.player.position.x)).toBe(true);
        expect(Number.isFinite(state.player.position.y)).toBe(true);
        expect(state.lives).toBeGreaterThanOrEqual(0);
        expect(state.pendingTokens).toBeGreaterThanOrEqual(0);
        expect(state.pendingTokens).toBeLessThanOrEqual(GAMEPLAY.contextCapacity);
        expect(state.tokens.length).toBeLessThanOrEqual(GAMEPLAY.tokenTargetCount);
        expect(state.enemies.length).toBeLessThanOrEqual(GAMEPLAY.maxEnemies);
        expect(state.trail.length).toBeLessThanOrEqual(
          GAMEPLAY.baseTrailPoints +
            GAMEPLAY.contextCapacity * GAMEPLAY.trailPointsPerToken,
        );
      }
    }
  });
});
