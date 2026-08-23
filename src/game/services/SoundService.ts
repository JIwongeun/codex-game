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
          frequency: event.kind === "context-sweep" ? 180 : 240,
          endFrequency: event.kind === "context-sweep" ? 120 : 180,
          durationSeconds: 0.12,
          gain: 0.025,
          wave: "triangle",
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
    oscillator.start(now);
    oscillator.stop(now + tone.durationSeconds);
  }
}
