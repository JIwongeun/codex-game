import type { GameEvent } from "../core/model";

interface Tone {
  frequency: number;
  endFrequency: number;
  durationSeconds: number;
  gain: number;
  wave: OscillatorType;
}

export class SoundService {
  private context: AudioContext | null = null;
  private readonly activeGains = new Set<GainNode>();
  private muted = false;

  get isMuted(): boolean {
    return this.muted;
  }

  unlock(): void {
    if (this.muted) {
      return;
    }

    try {
      this.context ??= new AudioContext();

      if (this.context.state === "suspended") {
        void this.context.resume().catch(() => undefined);
      }
    } catch {
      this.context = null;
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;

    if (this.muted) {
      this.stopActiveTones();
    }

    return this.muted;
  }

  consume(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === "run-started") {
        this.play({
          frequency: 260,
          endFrequency: 520,
          durationSeconds: 0.08,
          gain: 0.025,
          wave: "sine",
        });
      } else if (event.type === "hazard-warning") {
        this.play({
          frequency: 240,
          endFrequency: 180,
          durationSeconds: 0.12,
          gain: 0.025,
          wave: "triangle",
        });
      } else if (event.type === "pattern-warning") {
        this.play({
          frequency: event.kind === "usage-limit" ? 170 : 220,
          endFrequency: event.kind === "usage-limit" ? 110 : 160,
          durationSeconds: 0.1,
          gain: 0.02,
          wave: "triangle",
        });
      } else if (event.type === "pattern-burst") {
        this.play({
          frequency: event.kind === "usage-limit" ? 92 : 150,
          endFrequency: event.kind === "usage-limit" ? 46 : 80,
          durationSeconds: 0.16,
          gain: 0.04,
          wave: "square",
        });
      } else if (event.type === "player-hit") {
        this.play({
          frequency: 110,
          endFrequency: 48,
          durationSeconds: 0.22,
          gain: 0.06,
          wave: "square",
        });
      }
    }
  }

  destroy(): void {
    this.stopActiveTones();

    if (this.context) {
      const context = this.context;
      this.context = null;
      void context.close().catch(() => undefined);
    }
  }

  private play(tone: Tone): void {
    if (this.muted) {
      return;
    }

    this.unlock();

    if (!this.context || this.context.state !== "running") {
      return;
    }

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = tone.wave;
    oscillator.frequency.setValueAtTime(tone.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, tone.endFrequency),
      now + tone.durationSeconds,
    );
    gain.gain.setValueAtTime(tone.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.durationSeconds);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    this.activeGains.add(gain);
    oscillator.addEventListener(
      "ended",
      () => {
        if (this.activeGains.delete(gain)) {
          gain.disconnect();
        }
      },
      { once: true },
    );
    oscillator.start(now);
    oscillator.stop(now + tone.durationSeconds);
  }

  private stopActiveTones(): void {
    for (const gain of this.activeGains) {
      gain.disconnect();
    }
    this.activeGains.clear();
  }
}
