import { describe, expect, it } from "vitest";

import { ARENA, FIXED_STEP_MS, GAMEPLAY } from "../constants";
import type {
  AreaHazardState,
  GameState,
  ProjectileState,
} from "./model";
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
  state.spawn = {
    tabMs: 1_000_000,
    popupMs: 1_000_000,
    memoryLeakMs: 1_000_000,
    contextSweepMs: 1_000_000,
  };
  return state;
}

function projectile(
  state: GameState,
  overrides: Partial<ProjectileState> = {},
): ProjectileState {
  return {
    id: 100,
    kind: "tab",
    position: { ...state.player.position },
    velocity: { x: 1, y: 0 },
    radius: GAMEPLAY.projectileRadius,
    speed: 0,
    ageMs: 0,
    telegraphRemainingMs: 0,
    ...overrides,
  };
}

function hazard(
  state: GameState,
  overrides: Partial<AreaHazardState> = {},
): AreaHazardState {
  return {
    id: 200,
    kind: "memory-leak",
    position: { ...state.player.position },
    radius: 90,
    axis: null,
    thickness: 0,
    phase: "telegraph",
    remainingMs: FIXED_STEP_MS * 2,
    ...overrides,
  };
}

describe("survival simulation", () => {
  it("starts anonymously with an empty deterministic arena", () => {
    const first = createGameState(42);
    const second = createGameState(42);

    expect(startRun(first)).toEqual([{ type: "run-started" }]);
    startRun(second);

    expect(first.phase).toBe("playing");
    expect(first.projectiles).toEqual([]);
    expect(first.hazards).toEqual([]);
    expect(first).toEqual(second);
    expect(startRun(first)).toEqual([]);
  });

  it("produces identical state for the same seed and fixed input stream", () => {
    const first = restartRun(314_159);
    const second = restartRun(314_159);

    for (let tick = 0; tick < 900 && first.phase === "playing"; tick += 1) {
      const intent = {
        direction: { x: Math.cos(tick / 90), y: Math.sin(tick / 90) },
      };
      stepGame(first, intent, FIXED_STEP_MS);
      stepGame(second, intent, FIXED_STEP_MS);
    }

    expect(first).toEqual(second);
  });

  it("stops without input and clamps pointer movement inside the arena", () => {
    const state = playingState();
    const start = { ...state.player.position };

    stepGame(state, EMPTY_INPUT, 1_000);
    expect(state.player.position).toEqual(start);

    for (let index = 0; index < 10; index += 1) {
      stepGame(state, { direction: { x: 1, y: 1 } }, 1_000);
    }

    expect(state.player.position.x).toBeLessThanOrEqual(
      ARENA.right - GAMEPLAY.playerRadius,
    );
    expect(state.player.position.y).toBeLessThanOrEqual(
      ARENA.bottom - GAMEPLAY.playerRadius,
    );
  });

  it("ends the run on the first projectile-tip collision", () => {
    const state = playingState();
    state.projectiles = [projectile(state)];

    const events = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    expect(state.phase).toBe("results");
    expect(state.lastHitSource).toBe("tab");
    expect(events).toContainEqual({ type: "player-hit", source: "tab" });
    expect(events.at(-1)).toEqual({
      type: "run-ended",
      finalScore: state.score,
      source: "tab",
    });
  });

  it("keeps a pop-up harmless while telegraphing, then makes it lethal", () => {
    const state = playingState();
    state.projectiles = [
      projectile(state, {
        kind: "popup",
        radius: GAMEPLAY.popupRadius,
        telegraphRemainingMs: FIXED_STEP_MS * 2,
      }),
    ];

    expect(stepGame(state, EMPTY_INPUT, FIXED_STEP_MS)).toEqual([]);
    expect(state.phase).toBe("playing");
    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(state.phase).toBe("results");
    expect(state.lastHitSource).toBe("popup");
  });

  it("makes a memory leak lethal only after its warning expires", () => {
    const state = playingState();
    state.hazards = [hazard(state)];

    expect(stepGame(state, EMPTY_INPUT, FIXED_STEP_MS)).toEqual([]);
    expect(state.phase).toBe("playing");
    const events = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    expect(events).toContainEqual({
      type: "hazard-activated",
      kind: "memory-leak",
    });
    expect(state.phase).toBe("results");
    expect(state.lastHitSource).toBe("memory-leak");
  });

  it("detects active horizontal and vertical context sweep bands", () => {
    for (const axis of ["horizontal", "vertical"] as const) {
      const state = playingState();
      state.hazards = [
        hazard(state, {
          kind: "context-sweep",
          radius: 0,
          axis,
          thickness: 100,
          phase: "active",
          remainingMs: 1_000,
        }),
      ];

      stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
      expect(state.phase).toBe("results");
      expect(state.lastHitSource).toBe("context-sweep");
    }
  });

  it("spawns all attack families after the late-game threshold", () => {
    const state = playingState(77);
    state.elapsedMs = GAMEPLAY.contextSweepFirstSpawnMs;
    state.spawn = {
      tabMs: 0,
      popupMs: 0,
      memoryLeakMs: 0,
      contextSweepMs: 0,
    };

    const events = stepGame(state, { direction: { x: 1, y: 0 } }, FIXED_STEP_MS);

    expect(state.projectiles.some((candidate) => candidate.kind === "tab")).toBe(
      true,
    );
    expect(state.projectiles.some((candidate) => candidate.kind === "popup")).toBe(
      true,
    );
    expect(state.hazards.some((candidate) => candidate.kind === "memory-leak")).toBe(
      true,
    );
    expect(
      state.hazards.some((candidate) => candidate.kind === "context-sweep"),
    ).toBe(true);
    expect(events.filter((event) => event.type === "hazard-warning")).toHaveLength(
      2,
    );
  });

  it("freezes the simulation after results and restarts cleanly", () => {
    const state = playingState();
    state.projectiles = [projectile(state)];
    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    const resultSnapshot = structuredClone(state);

    expect(stepGame(state, { direction: { x: 0, y: 1 } }, 5_000)).toEqual([]);
    expect(state).toEqual(resultSnapshot);

    const restarted = restartRun(73);
    expect(restarted.phase).toBe("playing");
    expect(restarted.seed).toBe(73);
    expect(restarted.score).toBe(0);
    expect(restarted.projectiles).toEqual([]);
    expect(restarted.hazards).toEqual([]);
  });

  it("keeps numeric values and entity counts valid across seeded runs", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const state = restartRun(seed);

      for (let tick = 0; tick < 7_200 && state.phase === "playing"; tick += 1) {
        stepGame(
          state,
          {
            direction: {
              x: Math.cos((tick + seed) / 75),
              y: Math.sin((tick + seed) / 75),
            },
          },
          FIXED_STEP_MS,
        );

        expect(Number.isFinite(state.player.position.x)).toBe(true);
        expect(Number.isFinite(state.player.position.y)).toBe(true);
        expect(Number.isFinite(state.elapsedMs)).toBe(true);
        expect(state.projectiles.length).toBeLessThanOrEqual(
          GAMEPLAY.maxProjectiles,
        );
        expect(state.hazards.length).toBeLessThanOrEqual(GAMEPLAY.maxHazards);
      }
    }
  });
});
