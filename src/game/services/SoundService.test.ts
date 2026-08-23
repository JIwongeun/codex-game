import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEvent } from "../core/model";
import { SoundService } from "./SoundService";

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
