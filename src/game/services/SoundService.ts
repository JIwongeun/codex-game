import type { GameEvent } from "../core/model";
import { GAMEPLAY } from "../constants";

interface Tone {
  frequency: number;
  endFrequency: number;
  durationSeconds: number;
  gain: number;
  wave: OscillatorType;
  delaySeconds?: number;
}

const MUSIC_BASE_BPM = 132;
const MUSIC_BPM_PER_STAGE = 4;
const MUSIC_LEAD_MIDI: readonly (number | null)[] = [
  64,
  null,
  71,
  67,
  74,
  null,
  71,
  67,
  64,
  67,
  71,
  74,
  76,
  null,
  74,
  71,
  64,
  null,
  71,
  67,
  74,
  76,
  78,
  76,
  71,
  67,
  69,
  71,
  74,
  null,
  71,
  null,
];
const MUSIC_BASS_MIDI = [40, 40, 43, 38, 40, 43, 45, 47] as const;

export class SoundService {
  private context: AudioContext | null = null;
  private readonly activeGains = new Set<GainNode>();
  private readonly activeMusicGains = new Set<GainNode>();
  private musicStep = 0;
  private nextMusicStepMs = 0;
  private musicRunning = false;
  private muted = false;

  get isMuted(): boolean {
    return this.muted;
  }

  syncMusic(playing: boolean, elapsedMs: number): void {
    if (!playing || this.muted) {
      this.pauseMusic();
      return;
    }

    if (!this.context || this.context.state !== "running") {
      return;
    }

    const safeElapsedMs = Math.max(0, elapsedMs);
    if (!this.musicRunning) {
      this.musicRunning = true;
      this.musicStep = 0;
      this.nextMusicStepMs = safeElapsedMs;
    }

    if (safeElapsedMs < this.nextMusicStepMs) {
      return;
    }

    const step = this.musicStep;
    this.musicStep += 1;
    const stepDurationMs = 60_000 / musicBpmAt(safeElapsedMs) / 4;
    this.nextMusicStepMs += stepDurationMs;
    if (this.nextMusicStepMs <= safeElapsedMs) {
      this.nextMusicStepMs = safeElapsedMs + stepDurationMs;
    }

    const leadMidi = MUSIC_LEAD_MIDI[step % MUSIC_LEAD_MIDI.length];
    if (leadMidi !== null && leadMidi !== undefined) {
      const frequency = midiFrequency(leadMidi);
      this.play(
        {
          frequency,
          endFrequency: frequency,
          durationSeconds: 0.085,
          gain: 0.008,
          wave: "triangle",
        },
        true,
      );
    }

    if (step % 4 === 0) {
      const bassMidi = MUSIC_BASS_MIDI[
        Math.floor(step / 4) % MUSIC_BASS_MIDI.length
      ];
      const frequency = midiFrequency(bassMidi);
      this.play(
        {
          frequency,
          endFrequency: frequency * 0.98,
          durationSeconds: 0.18,
          gain: 0.007,
          wave: "square",
        },
        true,
      );
    } else if (step % 4 === 2) {
      this.play(
        {
          frequency: 1_800,
          endFrequency: 800,
          durationSeconds: 0.025,
          gain: 0.0025,
          wave: "square",
        },
        true,
      );
    }
  }

  pauseMusic(): void {
    for (const gain of this.activeMusicGains) {
      this.activeGains.delete(gain);
      gain.disconnect();
    }
    this.activeMusicGains.clear();
    this.musicStep = 0;
    this.nextMusicStepMs = 0;
    this.musicRunning = false;
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
      } else if (event.type === "hazard-activated") {
        this.play({
          frequency: 120,
          endFrequency: 48,
          durationSeconds: 0.24,
          gain: 0.045,
          wave: "square",
        });
        this.play({
          frequency: 920,
          endFrequency: 140,
          durationSeconds: 0.1,
          gain: 0.018,
          wave: "triangle",
        });
      } else if (event.type === "pattern-warning") {
        this.playPatternWarning(event.kind);
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

  private play(tone: Tone, music = false): void {
    if (this.muted) {
      return;
    }

    this.unlock();

    if (!this.context || this.context.state !== "running") {
      return;
    }

    const startTime = this.context.currentTime + (tone.delaySeconds ?? 0);
    const endTime = startTime + tone.durationSeconds;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = tone.wave;
    oscillator.frequency.setValueAtTime(tone.frequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, tone.endFrequency),
      endTime,
    );
    gain.gain.setValueAtTime(tone.gain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    this.activeGains.add(gain);
    if (music) {
      this.activeMusicGains.add(gain);
    }
    oscillator.addEventListener(
      "ended",
      () => {
        this.activeMusicGains.delete(gain);
        if (this.activeGains.delete(gain)) {
          gain.disconnect();
        }
      },
      { once: true },
    );
    oscillator.start(startTime);
    oscillator.stop(endTime);
  }

  private playPatternWarning(
    kind: Extract<GameEvent, { type: "pattern-warning" }>["kind"],
  ): void {
    if (kind === "approval-required") {
      this.play({
        frequency: 660,
        endFrequency: 660,
        durationSeconds: 0.055,
        gain: 0.018,
        wave: "sine",
      });
      this.play({
        frequency: 880,
        endFrequency: 880,
        durationSeconds: 0.055,
        gain: 0.018,
        wave: "sine",
        delaySeconds: 0.08,
      });
      return;
    }

    if (kind === "retry-loop") {
      for (let index = 0; index < 3; index += 1) {
        this.play({
          frequency: 420 + index * 90,
          endFrequency: 420 + index * 90,
          durationSeconds: 0.035,
          gain: 0.014,
          wave: "square",
          delaySeconds: index * 0.065,
        });
      }
      return;
    }

    if (kind === "reasoning-xhigh") {
      this.play({
        frequency: 170,
        endFrequency: 680,
        durationSeconds: 0.34,
        gain: 0.018,
        wave: "triangle",
      });
      return;
    }

    if (kind === "parallel-agents") {
      this.play({
        frequency: 360,
        endFrequency: 540,
        durationSeconds: 0.14,
        gain: 0.014,
        wave: "triangle",
      });
      this.play({
        frequency: 540,
        endFrequency: 360,
        durationSeconds: 0.14,
        gain: 0.014,
        wave: "triangle",
      });
      return;
    }

    if (kind === "review-loop") {
      this.play({
        frequency: 760,
        endFrequency: 520,
        durationSeconds: 0.08,
        gain: 0.016,
        wave: "sine",
      });
      this.play({
        frequency: 920,
        endFrequency: 620,
        durationSeconds: 0.08,
        gain: 0.016,
        wave: "sine",
        delaySeconds: 0.11,
      });
      return;
    }

    this.play({
      frequency: 170,
      endFrequency: 105,
      durationSeconds: 0.2,
      gain: 0.025,
      wave: "square",
    });
  }

  private stopActiveTones(): void {
    for (const gain of this.activeGains) {
      gain.disconnect();
    }
    this.activeGains.clear();
    this.activeMusicGains.clear();
    this.musicStep = 0;
    this.nextMusicStepMs = 0;
    this.musicRunning = false;
  }
}

export function musicBpmAt(elapsedMs: number): number {
  const stage = Math.min(
    GAMEPLAY.maxStage,
    Math.floor(Math.max(0, elapsedMs) / GAMEPLAY.stageDurationMs) + 1,
  );
  return MUSIC_BASE_BPM + (stage - 1) * MUSIC_BPM_PER_STAGE;
}

function midiFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}
