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
      if (event.type === "token-collected") {
        this.play({
          frequency: 520 + Math.min(event.pendingTokens, 12) * 18,
          endFrequency: 760,
          durationSeconds: 0.045,
          gain: 0.025,
          wave: "sine",
        });
      } else if (event.type === "compacted") {
        this.play({
          frequency: 240,
          endFrequency: 70,
          durationSeconds: 0.18,
          gain: 0.05,
          wave: "sawtooth",
        });
      } else if (event.type === "player-hit") {
        this.play({
          frequency: 110,
          endFrequency: 48,
          durationSeconds: 0.22,
          gain: 0.06,
          wave: "square",
        });
      } else if (event.type === "run-ended") {
        this.play({
          frequency: event.reason === "time" ? 330 : 150,
          endFrequency: event.reason === "time" ? 660 : 70,
          durationSeconds: 0.35,
          gain: 0.04,
          wave: "triangle",
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
