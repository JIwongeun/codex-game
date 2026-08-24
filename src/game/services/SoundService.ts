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
const DEFAULT_SFX_VOLUME = 0.2;
const DEFAULT_MUSIC_VOLUME = 0.2;
const CHANNEL_GAIN_AT_MAX_VOLUME = 5;
const MUSIC_GAIN = {
  lead: 0.016,
  bass: 0.013,
  pulse: 0.005,
} as const;
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
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private readonly activeGains = new Set<GainNode>();
  private readonly activeMusicGains = new Set<GainNode>();
  private musicStep = 0;
  private musicStage = 1;
  private nextMusicStepMs = 0;
  private musicRunning = false;
  private endingActive = false;
  private muted = false;
  private sfxVolumeValue = DEFAULT_SFX_VOLUME;
  private musicVolumeValue = DEFAULT_MUSIC_VOLUME;

  get isMuted(): boolean {
    return this.muted;
  }

  get sfxVolume(): number {
    return this.sfxVolumeValue;
  }

  get musicVolume(): number {
    return this.musicVolumeValue;
  }

  syncMusic(playing: boolean, elapsedMs: number): void {
    if (!playing || this.muted || this.endingActive) {
      this.pauseMusic();
      return;
    }

    if (!this.context || this.context.state !== "running") {
      return;
    }

    const safeElapsedMs = Math.max(0, elapsedMs);
    const stage = musicStageAt(safeElapsedMs);
    if (!this.musicRunning) {
      this.musicRunning = true;
      this.musicStep = 0;
      this.musicStage = stage;
      this.nextMusicStepMs = safeElapsedMs;
    } else if (stage > this.musicStage) {
      this.musicStage = stage;
      this.playStageNotification(stage);
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
          gain: MUSIC_GAIN.lead,
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
          gain: MUSIC_GAIN.bass,
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
          gain: MUSIC_GAIN.pulse,
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
    this.musicStage = 1;
    this.nextMusicStepMs = 0;
    this.musicRunning = false;
  }

  unlock(): void {
    if (this.muted) {
      return;
    }

    try {
      this.context ??= new AudioContext();
      if (!this.sfxGain) {
        this.sfxGain = this.context.createGain();
        this.updateSfxGain();
        this.sfxGain.connect(this.context.destination);
      }
      if (!this.musicGain) {
        this.musicGain = this.context.createGain();
        this.updateMusicGain();
        this.musicGain.connect(this.context.destination);
      }

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

  setSfxVolume(volume: number): void {
    this.sfxVolumeValue = Math.min(1, Math.max(0, volume));
    this.updateSfxGain();
  }

  setMusicVolume(volume: number): void {
    this.musicVolumeValue = Math.min(1, Math.max(0, volume));
    this.updateMusicGain();
  }

  consume(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === "run-started") {
        this.endingActive = false;
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
        this.playErrorPopupNotification();
      } else if (event.type === "pattern-warning") {
        this.playPatternWarning(event.kind);
      } else if (event.type === "pattern-complete") {
        this.play({
          frequency: 660,
          endFrequency: 660,
          durationSeconds: 0.075,
          gain: 0.019,
          wave: "sine",
        });
        this.play({
          frequency: 990,
          endFrequency: 990,
          durationSeconds: 0.085,
          gain: 0.019,
          wave: "sine",
          delaySeconds: 0.085,
        });
      } else if (event.type === "pattern-burst") {
        if (event.kind === "ultra-code") {
          this.playUltraCodeResponse();
          continue;
        }
        this.play({
          frequency: event.kind === "usage-limit" ? 92 : 150,
          endFrequency: event.kind === "usage-limit" ? 46 : 80,
          durationSeconds: 0.16,
          gain: 0.04,
          wave: "square",
        });
        if (event.kind === "review-loop") {
          this.playErrorPopupNotification(0.04);
        }
      } else if (event.type === "player-hit") {
        this.play({
          frequency: 110,
          endFrequency: 48,
          durationSeconds: 0.22,
          gain: 0.06,
          wave: "square",
        });
      } else if (event.type === "blackout-started") {
        this.play({
          frequency: 210,
          endFrequency: 74,
          durationSeconds: 0.12,
          gain: 0.028,
          wave: "square",
        });
        this.play({
          frequency: 1_100,
          endFrequency: 820,
          durationSeconds: 0.04,
          gain: 0.01,
          wave: "triangle",
          delaySeconds: 0.1,
        });
      } else if (event.type === "ending-started") {
        this.endingActive = true;
        this.pauseMusic();
        this.play({
          frequency: 164,
          endFrequency: 164,
          durationSeconds: 0.42,
          gain: 0.035,
          wave: "square",
        });
        this.play({
          frequency: 123,
          endFrequency: 92,
          durationSeconds: 0.62,
          gain: 0.032,
          wave: "square",
          delaySeconds: 0.18,
        });
      }
    }
  }

  destroy(): void {
    this.stopActiveTones();
    this.sfxGain?.disconnect();
    this.musicGain?.disconnect();
    this.sfxGain = null;
    this.musicGain = null;

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

    if (
      !this.context ||
      !this.sfxGain ||
      !this.musicGain ||
      this.context.state !== "running"
    ) {
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
    gain.connect(music ? this.musicGain : this.sfxGain);
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

    if (kind === "ultra-code") {
      this.play({
        frequency: 150,
        endFrequency: 420,
        durationSeconds: 0.42,
        gain: 0.014,
        wave: "triangle",
      });
      for (let index = 0; index < 4; index += 1) {
        const frequency = 920 - index * 120;
        this.play({
          frequency,
          endFrequency: frequency * 0.96,
          durationSeconds: 0.026,
          gain: 0.007,
          wave: "square",
          delaySeconds: [0.04, 0.11, 0.2, 0.31][index] ?? 0,
        });
      }
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
      this.playDeliveryNotification(0.16);
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

  private playUltraCodeResponse(): void {
    this.play({
      frequency: 1_480,
      endFrequency: 820,
      durationSeconds: 0.038,
      gain: 0.022,
      wave: "square",
    });
    this.play({
      frequency: 310,
      endFrequency: 138,
      durationSeconds: 0.09,
      gain: 0.018,
      wave: "triangle",
      delaySeconds: 0.012,
    });
  }

  private playStageNotification(stage: number): void {
    if (stage === GAMEPLAY.maxStage) {
      this.playTaskCompleteNotification(0.22, true, true);
      return;
    }

    if (stage % 2 === 0) {
      this.playDeliveryNotification(0.22, true);
    } else {
      this.playTaskCompleteNotification(0.22, true);
    }
  }

  private playDeliveryNotification(delaySeconds = 0, music = false): void {
    this.play(
      {
        frequency: midiFrequency(76),
        endFrequency: midiFrequency(76),
        durationSeconds: 0.065,
        gain: 0.022,
        wave: "sine",
        delaySeconds,
      },
      music,
    );
    this.play(
      {
        frequency: midiFrequency(83),
        endFrequency: midiFrequency(83),
        durationSeconds: 0.075,
        gain: 0.022,
        wave: "sine",
        delaySeconds: delaySeconds + 0.085,
      },
      music,
    );
    this.play(
      {
        frequency: 2_200,
        endFrequency: 1_500,
        durationSeconds: 0.025,
        gain: 0.005,
        wave: "square",
        delaySeconds,
      },
      music,
    );
  }

  private playTaskCompleteNotification(
    delaySeconds = 0,
    music = false,
    extended = false,
  ): void {
    const notes = extended ? [76, 79, 83, 88] : [76, 79, 83];
    const delays = [0, 0.075, 0.16, 0.25];

    for (let index = 0; index < notes.length; index += 1) {
      const note = notes[index];
      if (note === undefined) {
        continue;
      }
      this.play(
        {
          frequency: midiFrequency(note),
          endFrequency: midiFrequency(note),
          durationSeconds: 0.08,
          gain: 0.02,
          wave: "sine",
          delaySeconds: delaySeconds + (delays[index] ?? 0),
        },
        music,
      );
    }
  }

  private playErrorPopupNotification(delaySeconds = 0): void {
    this.play({
      frequency: midiFrequency(84),
      endFrequency: midiFrequency(80),
      durationSeconds: 0.055,
      gain: 0.02,
      wave: "triangle",
      delaySeconds,
    });
    this.play({
      frequency: midiFrequency(72),
      endFrequency: midiFrequency(67),
      durationSeconds: 0.12,
      gain: 0.018,
      wave: "square",
      delaySeconds: delaySeconds + 0.055,
    });
  }

  private stopActiveTones(): void {
    for (const gain of this.activeGains) {
      gain.disconnect();
    }
    this.activeGains.clear();
    this.activeMusicGains.clear();
    this.musicStep = 0;
    this.musicStage = 1;
    this.nextMusicStepMs = 0;
    this.musicRunning = false;
  }

  private updateSfxGain(): void {
    if (!this.context || !this.sfxGain) {
      return;
    }

    this.sfxGain.gain.setValueAtTime(
      this.sfxVolumeValue * CHANNEL_GAIN_AT_MAX_VOLUME,
      this.context.currentTime,
    );
  }

  private updateMusicGain(): void {
    if (!this.context || !this.musicGain) {
      return;
    }

    this.musicGain.gain.setValueAtTime(
      this.musicVolumeValue * CHANNEL_GAIN_AT_MAX_VOLUME,
      this.context.currentTime,
    );
  }
}

export function musicBpmAt(elapsedMs: number): number {
  return MUSIC_BASE_BPM + (musicStageAt(elapsedMs) - 1) * MUSIC_BPM_PER_STAGE;
}

function musicStageAt(elapsedMs: number): number {
  return Math.min(
    GAMEPLAY.maxStage,
    Math.floor(Math.max(0, elapsedMs) / GAMEPLAY.stageDurationMs) + 1,
  );
}

function midiFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}
