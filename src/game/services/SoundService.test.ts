import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEvent } from "../core/model";
import { musicBpmAt, SoundService } from "./SoundService";

class FakeAudioParam {
  readonly setValueAtTime = vi.fn();
  readonly exponentialRampToValueAtTime = vi.fn();
}

class FakeOscillator {
  readonly frequency = new FakeAudioParam();
  readonly connect = vi.fn();
  readonly start = vi.fn();
  readonly stop = vi.fn();
  readonly addEventListener = vi.fn();
  type: OscillatorType = "sine";
}

class FakeGain {
  readonly gain = new FakeAudioParam();
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
}

class FakeAudioContext {
  static readonly instances: FakeAudioContext[] = [];
  static nextState: AudioContextState = "running";

  readonly state = FakeAudioContext.nextState;
  readonly currentTime = 4;
  readonly destination = {} as AudioDestinationNode;
  readonly oscillators: FakeOscillator[] = [];
  readonly gains: FakeGain[] = [];
  readonly resume = vi.fn(() => Promise.resolve());
  readonly close = vi.fn(() => Promise.resolve());

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createOscillator(): OscillatorNode {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }

  createGain(): GainNode {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }
}

const RUN_STARTED: readonly GameEvent[] = [{ type: "run-started" }];

describe("SoundService", () => {
  beforeEach(() => {
    FakeAudioContext.instances.length = 0;
    FakeAudioContext.nextState = "running";
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not create or play audio while muted", () => {
    const sound = new SoundService();

    expect(sound.toggleMute()).toBe(true);
    sound.unlock();
    sound.consume(RUN_STARTED);

    expect(sound.isMuted).toBe(true);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("plays one procedural music step once and advances with game time", () => {
    const sound = new SoundService();

    sound.unlock();
    sound.syncMusic(true, 0);
    const context = FakeAudioContext.instances[0];
    const firstStepOscillators = context?.oscillators.length ?? 0;

    expect(firstStepOscillators).toBeGreaterThan(0);
    sound.syncMusic(true, 0);
    expect(context?.oscillators).toHaveLength(firstStepOscillators);

    sound.syncMusic(true, 500);
    sound.syncMusic(true, 1_000);
    expect(context?.oscillators.length).toBeGreaterThan(firstStepOscillators);
  });

  it("accelerates the music tempo at each stage up to stage ten", () => {
    expect(musicBpmAt(0)).toBe(132);
    expect(musicBpmAt(12_000)).toBe(136);
    expect(musicBpmAt(108_000)).toBe(168);
    expect(musicBpmAt(999_000)).toBe(168);
  });

  it("keeps the louder music bed below effect-level gain", () => {
    const sound = new SoundService();

    sound.unlock();
    sound.syncMusic(true, 0);
    const gains = FakeAudioContext.instances[0]?.gains.map(
      (gain) => gain.gain.setValueAtTime.mock.calls[0]?.[0],
    );

    expect(gains).toContain(0.016);
    expect(gains).toContain(0.013);
    expect(Math.max(...(gains ?? [0]))).toBeLessThan(0.025);
  });

  it("plays one original notification motif when the stage changes", () => {
    const sound = new SoundService();

    sound.unlock();
    sound.syncMusic(true, 0);
    const context = FakeAudioContext.instances[0];
    const beforeStageChange = context?.oscillators.length ?? 0;

    sound.syncMusic(true, 12_000);
    const afterStageChange = context?.oscillators.length ?? 0;
    expect(afterStageChange).toBeGreaterThanOrEqual(beforeStageChange + 2);

    sound.syncMusic(true, 12_000);
    expect(context?.oscillators).toHaveLength(afterStageChange);
  });

  it("disconnects music on pause and restarts the step after resume", () => {
    const sound = new SoundService();

    sound.unlock();
    sound.syncMusic(true, 0);
    const context = FakeAudioContext.instances[0];
    const firstStepGains = context?.gains.slice() ?? [];
    const firstStepOscillators = context?.oscillators.length ?? 0;

    sound.pauseMusic();
    expect(firstStepGains.every((gain) => gain.disconnect.mock.calls.length === 1)).toBe(
      true,
    );

    sound.syncMusic(true, 0);
    expect(context?.oscillators.length).toBeGreaterThan(firstStepOscillators);
  });

  it("plays a cue for every special pattern and the compaction burst", () => {
    const sound = new SoundService();
    const events: readonly GameEvent[] = [
      { type: "pattern-warning", kind: "approval-required" },
      { type: "hazard-warning", kind: "compaction" },
      {
        type: "hazard-activated",
        kind: "compaction",
        position: { x: 1, y: 1 },
      },
      { type: "pattern-warning", kind: "retry-loop" },
      { type: "pattern-complete", kind: "retry-loop", position: { x: 1, y: 1 } },
      { type: "pattern-warning", kind: "ultra-code" },
      {
        type: "pattern-burst",
        kind: "ultra-code",
        position: { x: 1, y: 1 },
      },
      { type: "pattern-warning", kind: "parallel-agents" },
      { type: "pattern-warning", kind: "review-loop" },
      { type: "pattern-burst", kind: "review-loop", position: { x: 1, y: 1 } },
      { type: "pattern-warning", kind: "usage-limit" },
      { type: "pattern-burst", kind: "usage-limit", position: { x: 1, y: 1 } },
    ];

    sound.unlock();
    const context = FakeAudioContext.instances[0];
    for (const event of events) {
      const before = context?.oscillators.length ?? 0;
      sound.consume([event]);
      expect(context?.oscillators.length).toBeGreaterThan(before);
    }
  });

  it("plays a separate two-note completion cue after the final retry", () => {
    const sound = new SoundService();

    sound.unlock();
    const context = FakeAudioContext.instances[0];
    sound.consume([
      {
        type: "pattern-complete",
        kind: "retry-loop",
        position: { x: 1, y: 1 },
      },
    ]);

    const completionTones = context?.oscillators.slice(-2) ?? [];
    expect(completionTones).toHaveLength(2);
    expect(
      completionTones.map(
        (oscillator) => oscillator.frequency.setValueAtTime.mock.calls[0]?.[0],
      ),
    ).toEqual([660, 990]);
  });

  it("separates ultra-code agent collection from the final answer snap", () => {
    const sound = new SoundService();

    sound.unlock();
    const context = FakeAudioContext.instances[0];
    sound.consume([{ type: "pattern-warning", kind: "ultra-code" }]);
    expect(context?.oscillators).toHaveLength(5);

    sound.consume([
      {
        type: "pattern-burst",
        kind: "ultra-code",
        position: { x: 1, y: 1 },
      },
    ]);
    expect(context?.oscillators).toHaveLength(7);
    expect(
      context?.oscillators
        .slice(-2)
        .map(
          (oscillator) =>
            oscillator.frequency.setValueAtTime.mock.calls[0]?.[0],
        ),
    ).toEqual([1_480, 310]);
  });

  it("layers notification-shaped cues onto error and delivery events", () => {
    const sound = new SoundService();

    sound.unlock();
    const context = FakeAudioContext.instances[0];
    sound.consume([
      {
        type: "hazard-activated",
        kind: "compaction",
        position: { x: 1, y: 1 },
      },
    ]);
    expect(context?.oscillators.length).toBeGreaterThanOrEqual(4);

    const afterError = context?.oscillators.length ?? 0;
    sound.consume([{ type: "pattern-warning", kind: "parallel-agents" }]);
    expect(context?.oscillators.length).toBeGreaterThanOrEqual(afterError + 4);
  });

  it("plays blackout and crash cues, then keeps music stopped until restart", () => {
    const sound = new SoundService();

    sound.unlock();
    sound.syncMusic(true, 108_000);
    const context = FakeAudioContext.instances[0];
    const beforeBlackout = context?.oscillators.length ?? 0;

    sound.consume([{ type: "blackout-started", position: { x: 1, y: 1 } }]);
    expect(context?.oscillators.length).toBeGreaterThanOrEqual(
      beforeBlackout + 2,
    );

    sound.consume([{ type: "ending-started" }]);
    const afterCrash = context?.oscillators.length ?? 0;
    expect(afterCrash).toBeGreaterThanOrEqual(beforeBlackout + 4);

    sound.syncMusic(true, 180_000);
    expect(context?.oscillators).toHaveLength(afterCrash);

    sound.consume(RUN_STARTED);
    sound.syncMusic(true, 0);
    expect(context?.oscillators.length).toBeGreaterThan(afterCrash);
  });

  it("plays after unmute and disconnects an active tone when muted again", () => {
    const sound = new SoundService();

    sound.toggleMute();
    expect(sound.toggleMute()).toBe(false);
    sound.consume(RUN_STARTED);

    const context = FakeAudioContext.instances[0];
    expect(context?.oscillators[0]?.start).toHaveBeenCalledOnce();
    expect(context?.oscillators[0]?.stop).toHaveBeenCalledOnce();
    expect(context?.gains[0]?.connect).toHaveBeenCalledOnce();

    sound.toggleMute();
    expect(context?.gains[0]?.disconnect).toHaveBeenCalledOnce();
  });

  it("resumes a suspended context and closes it on destroy", () => {
    FakeAudioContext.nextState = "suspended";
    const sound = new SoundService();

    sound.unlock();
    const context = FakeAudioContext.instances[0];
    expect(context?.resume).toHaveBeenCalledOnce();

    sound.destroy();
    expect(context?.close).toHaveBeenCalledOnce();
  });
});
