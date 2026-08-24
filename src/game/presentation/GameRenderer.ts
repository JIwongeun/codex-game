import Phaser from "phaser";

import { GAMEPLAY } from "../constants";
import {
  approvalGateLabelPlacement,
  approvalGateLabelText,
  approvalGateDisplayPosition,
  approvalGateSegments,
} from "../core/approvalGate";
import type {
  AttackSurface,
  AreaHazardState,
  GameEvent,
  GameState,
  ProjectileState,
  ReasoningWaveState,
  Vec2,
} from "../core/model";
import {
  attackTextColor,
  attackTextTokens,
  layoutAttackTextTokens,
} from "./attackText";
import {
  blackoutVisualState,
  pointInsideVisibleBlackout,
} from "./blackoutPresentation";
import { BlueScreenOverlay } from "./BlueScreenOverlay";
import { overflowPresentationAt } from "./overflowPresentation";
import {
  ATTACK_TONES,
  COLORS,
  FONTS,
  RENDER_DEPTHS,
  TEXT_COLORS,
} from "./theme";

type AttackTone = (typeof ATTACK_TONES)[keyof typeof ATTACK_TONES];
const RICH_LABEL_STROKE_THICKNESS = 2;

interface ParticleEffect extends Vec2 {
  velocity: Vec2;
  ageMs: number;
  durationMs: number;
  size: number;
  gravity: number;
  color: number;
}

interface RichLabelView {
  readonly container: Phaser.GameObjects.Container;
  signature: string;
}

interface RichLabelStyle {
  surface: AttackSurface;
  label: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: string;
  letterSpacing?: number;
}

interface BlackoutView {
  readonly command: Phaser.GameObjects.Text;
  readonly status: Phaser.GameObjects.Text;
}

function directionBetweenPoints(from: Vec2, to: Vec2): Vec2 {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const magnitude = Math.hypot(deltaX, deltaY) || 1;
  return { x: deltaX / magnitude, y: deltaY / magnitude };
}

function seededUnit(value: number): number {
  const noise = Math.sin(value * 12.9898) * 43_758.5453;
  return noise - Math.floor(noise);
}

function ultraWorkingAgentCount(progress: number): 8 | 4 | 2 | 1 {
  return progress < 0.25 ? 8 : progress < 0.5 ? 4 : progress < 0.75 ? 2 : 1;
}

function ultraWorkingAgentIndices(count: 8 | 4 | 2 | 1): readonly number[] {
  if (count === 8) {
    return [0, 1, 2, 3, 4, 5, 6, 7];
  }
  if (count === 4) {
    return [0, 2, 4, 6];
  }
  if (count === 2) {
    return [0, 4];
  }
  return [0];
}

function ultraAgentCompletionThreshold(index: number): number {
  if (index % 2 === 1) {
    return 0.25;
  }
  if (index === 2 || index === 6) {
    return 0.5;
  }
  if (index === 4) {
    return 0.75;
  }
  return 1;
}

export class GameRenderer {
  private readonly scene: Phaser.Scene;
  private readonly textResolution: number;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly world: Phaser.GameObjects.Graphics;
  private readonly blackoutLayer: Phaser.GameObjects.Graphics;
  private readonly playerLayer: Phaser.GameObjects.Graphics;
  private readonly effectsLayer: Phaser.GameObjects.Graphics;
  private readonly overflowTransitionLayer: Phaser.GameObjects.Graphics;
  private readonly endingOverlay: BlueScreenOverlay;
  private readonly projectileLabels = new Map<number, RichLabelView>();
  private readonly hazardLabels = new Map<number, RichLabelView>();
  private readonly sequenceLabels = new Map<number, RichLabelView>();
  private readonly approvalGateLabels = new Map<number, RichLabelView>();
  private readonly retryChainLabels = new Map<number, RichLabelView>();
  private readonly reasoningWaveLabels = new Map<number, RichLabelView>();
  private readonly blackoutViews = new Map<number, BlackoutView>();
  private readonly particles: ParticleEffect[] = [];
  private hitFlashMs = 0;

  constructor(scene: Phaser.Scene, textResolution: number) {
    this.scene = scene;
    this.textResolution = textResolution;
    this.background = scene.add.graphics().setDepth(RENDER_DEPTHS.background);
    this.world = scene.add.graphics().setDepth(RENDER_DEPTHS.world);
    this.effectsLayer = scene.add.graphics().setDepth(RENDER_DEPTHS.effects);
    this.blackoutLayer = scene.add.graphics().setDepth(RENDER_DEPTHS.blackout);
    this.playerLayer = scene.add.graphics().setDepth(RENDER_DEPTHS.player);
    this.overflowTransitionLayer = scene.add
      .graphics()
      .setDepth(RENDER_DEPTHS.overflowTransition);
    const parent = scene.game.canvas.parentElement ?? document.body;
    this.endingOverlay = new BlueScreenOverlay(parent);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.endingOverlay.destroy();
      this.destroyBlackoutViews();
    });
  }

  consume(events: readonly GameEvent[], state: GameState): void {
    for (const event of events) {
      if (event.type === "hazard-activated") {
        if (event.kind === "compaction") {
          this.addContextBurst(event.position, state.elapsedMs);
        }
      } else if (event.type === "pattern-burst") {
        if (event.kind === "ultra-code") {
          continue;
        }
        this.addBurst(
          event.position,
          event.kind === "usage-limit" ? 36 : 24,
          state.elapsedMs,
        );
      } else if (event.type === "player-hit") {
        this.hitFlashMs = 180;
        this.addBurst(state.player.position, 22, state.elapsedMs);
      }
    }
  }

  render(state: GameState, frameDeltaMs: number): void {
    this.advanceEffects(frameDeltaMs);
    this.drawBackground(state);
    this.world.clear();
    this.blackoutLayer.clear();
    this.playerLayer.clear();
    this.effectsLayer.clear();
    this.overflowTransitionLayer.clear();

    this.drawHazards(state);
    this.drawSequences(state);
    this.drawProjectiles(state);
    this.drawApprovalGates(state);
    this.drawRetryChains(state);
    this.drawReasoningWaves(state);
    this.syncProjectileLabels(state);
    this.syncHazardLabels(state);
    this.syncSequenceLabels(state);
    this.syncApprovalGateLabels(state);
    this.syncRetryChainLabels(state);
    this.syncReasoningWaveLabels(state);
    this.drawBlackouts(state);
    this.syncBlackoutViews(state);
    this.drawPlayer(state);
    this.drawEffects();
    this.drawOverflowTransition(state);
    this.endingOverlay.render(state.ending);

    if (this.hitFlashMs > 0) {
      const strength = this.hitFlashMs / 180;
      this.effectsLayer.fillStyle(COLORS.black, 0.14 * strength);
      this.effectsLayer.fillRect(0, 0, state.arena.width, state.arena.height);
    }
  }

  resetEffects(): void {
    this.particles.length = 0;
    this.destroyRichLabelMap(this.projectileLabels);
    this.destroyRichLabelMap(this.hazardLabels);
    this.destroyRichLabelMap(this.sequenceLabels);
    this.destroyRichLabelMap(this.approvalGateLabels);
    this.destroyRichLabelMap(this.retryChainLabels);
    this.destroyRichLabelMap(this.reasoningWaveLabels);
    this.destroyBlackoutViews();
    this.hitFlashMs = 0;
  }

  private drawBackground(state: GameState): void {
    const overflow = overflowPresentationAt(state.elapsedMs);
    const active = state.phase === "playing" && overflow.active;
    this.background.clear();
    this.background.fillStyle(
      active ? COLORS.overflowWash : COLORS.background,
      1,
    );
    this.background.fillRect(0, 0, state.arena.width, state.arena.height);

    if (!active) {
      return;
    }

    const { width, height } = state.arena;
    const inset = 2;
    const cornerLength = Math.min(34, Math.max(22, height * 0.028));
    const tickLength = Math.min(12, Math.max(7, height * 0.008));
    this.background.lineStyle(2, COLORS.overflowDanger, overflow.frameAlpha);
    this.background.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    this.background.lineStyle(
      2,
      COLORS.overflowDanger,
      Math.min(0.62, overflow.frameAlpha + 0.2),
    );

    for (const x of [inset, width - inset]) {
      const direction = x === inset ? 1 : -1;
      this.background.lineBetween(x, inset, x + cornerLength * direction, inset);
      this.background.lineBetween(
        x,
        height - inset,
        x + cornerLength * direction,
        height - inset,
      );
    }
    for (const y of [inset, height - inset]) {
      const direction = y === inset ? 1 : -1;
      this.background.lineBetween(inset, y, inset, y + cornerLength * direction);
      this.background.lineBetween(
        width - inset,
        y,
        width - inset,
        y + cornerLength * direction,
      );
    }

    this.background.lineStyle(1, COLORS.overflowDanger, overflow.frameAlpha + 0.08);
    for (const ratio of [0.18, 0.32, 0.68, 0.82]) {
      const x = width * ratio;
      const y = height * ratio;
      this.background.lineBetween(x, inset, x + tickLength, inset);
      this.background.lineBetween(x, height - inset, x + tickLength, height - inset);
      this.background.lineBetween(inset, y, inset, y + tickLength);
      this.background.lineBetween(width - inset, y, width - inset, y + tickLength);
    }
  }

  private drawOverflowTransition(state: GameState): void {
    if (state.phase !== "playing") {
      return;
    }

    const overflow = overflowPresentationAt(state.elapsedMs);
    if (overflow.emergencyAlpha <= 0) {
      return;
    }

    this.overflowTransitionLayer.fillStyle(
      COLORS.overflowDanger,
      overflow.emergencyAlpha,
    );
    this.overflowTransitionLayer.fillRect(
      0,
      0,
      state.arena.width,
      state.arena.height,
    );
  }

  private drawHazards(state: GameState): void {
    for (const hazard of state.hazards) {
      if (hazard.kind === "compaction") {
        this.drawCompaction(hazard);
      } else {
        this.drawDownloadAccess(hazard);
      }
    }
  }

  private drawCompaction(hazard: AreaHazardState): void {
    const { x, y, width, height } = this.hazardRect(hazard);
    const active = hazard.phase === "active";
    const progress = active
      ? 1
      : Phaser.Math.Clamp(
          1 - hazard.remainingMs / GAMEPLAY.compactionTelegraphMs,
          0,
          1,
        );
    const tone = ATTACK_TONES.codex.value;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    if (!active) {
      const compression = Phaser.Math.Easing.Cubic.In(progress);
      const startSize = Math.min(width, height) * 0.74;
      const frameSize = Math.max(
        8,
        Phaser.Math.Linear(startSize, 8, compression),
      );

      this.world.lineStyle(1, tone, 0.34 + progress * 0.56);
      this.world.strokeRect(
        centerX - frameSize / 2,
        centerY - frameSize / 2,
        frameSize,
        frameSize,
      );
      return;
    }

    const burstProgress = Phaser.Math.Clamp(
      1 - hazard.remainingMs / GAMEPLAY.compactionActiveMs,
      0,
      1,
    );
    const frameFade = 1 - burstProgress;

    for (let index = 0; index < 7; index += 1) {
      const noise = seededUnit(hazard.id * 31 + index * 17);
      const angle = noise * Math.PI * 2;
      const length = (12 + seededUnit(hazard.id * 47 + index * 23) * 42) *
        Phaser.Math.Easing.Quadratic.Out(burstProgress);
      this.world.lineStyle(1, index % 3 === 0 ? COLORS.ink : tone, frameFade * 0.6);
      this.world.lineBetween(
        centerX + Math.cos(angle) * 4,
        centerY + Math.sin(angle) * 3,
        centerX + Math.cos(angle) * length,
        centerY + Math.sin(angle) * length * 0.72,
      );
    }

    const failedCoreSize = Math.max(2, Math.round(10 * frameFade));
    this.world.fillStyle(COLORS.ink, 0.92 * frameFade);
    this.world.fillRect(
      Math.round(centerX - failedCoreSize / 2),
      Math.round(centerY - failedCoreSize / 2),
      failedCoreSize,
      failedCoreSize,
    );
  }

  private drawDownloadAccess(hazard: AreaHazardState): void {
    const { x, y, width, height } = this.hazardRect(hazard);
    const active = hazard.phase === "active";
    const progress = active
      ? 1
      : Phaser.Math.Clamp(
          1 - hazard.remainingMs / GAMEPLAY.downloadAccessTelegraphMs,
          0,
          1,
        );
    const tone = ATTACK_TONES.downloadAccess.value;

    this.world.fillStyle(tone, active ? 0.13 : 0.014);
    this.world.fillRect(x, y, width, height);

    if (!active) {
      const sector = hazard.accessSector ?? "left";
      let fillX = x;
      let fillY = y;
      let fillWidth = width;
      let fillHeight = height;
      if (sector === "left") {
        fillWidth = width * progress;
      } else if (sector === "right") {
        fillWidth = width * progress;
        fillX = x + width - fillWidth;
      } else if (sector === "top") {
        fillHeight = height * progress;
      } else {
        fillHeight = height * progress;
        fillY = y + height - fillHeight;
      }
      this.world.fillStyle(tone, 0.035 + progress * 0.075);
      this.world.fillRect(fillX, fillY, fillWidth, fillHeight);
      this.world.lineStyle(2, tone, 0.64 + progress * 0.28);
      if (sector === "left" || sector === "right") {
        const scanX = sector === "left" ? fillX + fillWidth : fillX;
        this.world.lineBetween(scanX, y, scanX, y + height);
      } else {
        const scanY = sector === "top" ? fillY + fillHeight : fillY;
        this.world.lineBetween(x, scanY, x + width, scanY);
      }
      return;
    }

    const sector = hazard.accessSector ?? "left";
    this.world.lineStyle(3, tone, 0.96);
    if (sector === "left") {
      this.world.lineBetween(x + width, y, x + width, y + height);
    } else if (sector === "right") {
      this.world.lineBetween(x, y, x, y + height);
    } else if (sector === "top") {
      this.world.lineBetween(x, y + height, x + width, y + height);
    } else {
      this.world.lineBetween(x, y, x + width, y);
    }
  }

  private drawProjectiles(state: GameState): void {
    for (const projectile of state.projectiles) {
      if (projectile.kind === "tool-call") {
        continue;
      }
      if (projectile.telegraphRemainingMs > 0) {
        const tone = this.projectileTone(projectile);
        const progress = Phaser.Math.Clamp(
          1 - projectile.telegraphRemainingMs / 1_300,
          0,
          1,
        );
        this.drawDottedRay(
          projectile.position,
          projectile.velocity,
          Math.min(112, Math.max(60, projectile.hitbox.width * 0.68)),
          tone.value,
          0.12 + progress * 0.28,
          14,
        );
        continue;
      }

      if (projectile.kind === "context-token") {
        continue;
      }

      const length =
        projectile.kind === "approval" || projectile.kind === "agent"
            ? 28
            : projectile.kind === "retry"
              ? 24
              : projectile.kind === "finding" || projectile.kind === "limit"
                ? 14
                : 20;
      const alpha = projectile.kind === "limit" ? 0.48 : 0.28;
      this.drawMotionRail(projectile, length, alpha);
    }

    for (const projectile of state.projectiles) {
      this.drawProjectileSurfaceMark(projectile);
    }
  }

  private drawSequences(state: GameState): void {
    for (const sequence of state.sequences) {
      const progress = Phaser.Math.Clamp(
        1 - sequence.remainingMs / sequence.durationMs,
        0,
        1,
      );
      for (const origin of sequence.origins) {
        const tone = ATTACK_TONES.codex;
        const position = {
          x: Phaser.Math.Linear(origin.x, sequence.position.x, progress),
          y: Phaser.Math.Linear(origin.y, sequence.position.y, progress),
        };
        const direction = directionBetweenPoints(origin, sequence.position);
        this.world.lineStyle(1, tone.value, 0.16 + progress * 0.18);
        this.world.lineBetween(
          position.x - direction.x * 26,
          position.y - direction.y * 26,
          position.x - direction.x * 6,
          position.y - direction.y * 6,
        );
      }

      const pulse = 8 + Math.floor(progress * 7);
      const tone = ATTACK_TONES.codex;
      this.world.lineStyle(1, tone.value, 0.52 + progress * 0.32);
      this.world.lineBetween(
        sequence.position.x - pulse,
        sequence.position.y,
        sequence.position.x - 5,
        sequence.position.y,
      );
      this.world.lineBetween(
        sequence.position.x + 5,
        sequence.position.y,
        sequence.position.x + pulse,
        sequence.position.y,
      );
      this.world.lineBetween(
        sequence.position.x,
        sequence.position.y - pulse,
        sequence.position.x,
        sequence.position.y - 5,
      );
      this.world.lineBetween(
        sequence.position.x,
        sequence.position.y + 5,
        sequence.position.x,
        sequence.position.y + pulse,
      );
    }
  }

  private drawApprovalGates(state: GameState): void {
    const tone = ATTACK_TONES.codex.value;

    for (const gate of state.approvalGates) {
      const displayGate = {
        ...gate,
        position: approvalGateDisplayPosition(gate, state.arena),
      };
      const telegraphing = gate.telegraphRemainingMs > 0;
      const segments = approvalGateSegments(displayGate, state.arena);

      for (const segment of segments) {
        const x = segment.position.x - segment.hitbox.width / 2;
        const y = segment.position.y - segment.hitbox.height / 2;
        this.world.fillStyle(tone, telegraphing ? 0.018 : 0.08);
        this.world.fillRect(x, y, segment.hitbox.width, segment.hitbox.height);
        this.world.lineStyle(1, tone, telegraphing ? 0.42 : 0.88);
        this.world.strokeRect(x, y, segment.hitbox.width, segment.hitbox.height);
      }

      this.world.lineStyle(1, COLORS.ink, telegraphing ? 0.38 : 0.7);
      for (const gap of gate.gaps) {
        const gapHalf = gap.size / 2;
        if (Math.abs(gate.direction.x) > 0) {
          const x = displayGate.position.x;
          this.world.lineBetween(
            x - 7,
            gap.center - gapHalf,
            x + 7,
            gap.center - gapHalf,
          );
          this.world.lineBetween(
            x - 7,
            gap.center + gapHalf,
            x + 7,
            gap.center + gapHalf,
          );
        } else {
          const y = displayGate.position.y;
          this.world.lineBetween(
            gap.center - gapHalf,
            y - 7,
            gap.center - gapHalf,
            y + 7,
          );
          this.world.lineBetween(
            gap.center + gapHalf,
            y - 7,
            gap.center + gapHalf,
            y + 7,
          );
        }
      }
    }
  }

  private drawRetryChains(state: GameState): void {
    const tone = ATTACK_TONES.codex.value;

    for (const retry of state.retryChains) {
      if (retry.completionRemainingMs > 0) {
        const alpha = Phaser.Math.Clamp(
          retry.completionRemainingMs / 120,
          0,
          1,
        );
        this.world.lineStyle(1, tone, 0.62 * alpha);
        this.world.strokeRect(
          Math.round(retry.position.x) - 4,
          Math.round(retry.position.y) - 4,
          8,
          8,
        );
        this.world.fillStyle(tone, 0.36 * alpha);
        this.world.fillRect(
          Math.round(retry.position.x) - 1,
          Math.round(retry.position.y) - 1,
          3,
          3,
        );
      } else if (retry.telegraphRemainingMs > 0) {
        const distance = Math.hypot(
          retry.target.x - retry.position.x,
          retry.target.y - retry.position.y,
        );
        this.drawDottedRay(
          retry.position,
          retry.velocity,
          Math.min(112, distance),
          tone,
          0.34,
          13,
        );
      } else {
        this.world.lineStyle(1, tone, 0.44);
        this.world.lineBetween(
          retry.position.x - retry.velocity.x * 28,
          retry.position.y - retry.velocity.y * 28,
          retry.position.x - retry.velocity.x * 7,
          retry.position.y - retry.velocity.y * 7,
        );
      }

      this.world.fillStyle(tone, retry.telegraphRemainingMs > 0 ? 0.46 : 0.9);
      this.world.fillRect(
        Math.round(retry.position.x - retry.velocity.x * 7) - 1,
        Math.round(retry.position.y - retry.velocity.y * 7) - 1,
        3,
        3,
      );
    }
  }

  private drawReasoningWaves(state: GameState): void {
    const tone = ATTACK_TONES.codex.value;

    for (const wave of state.reasoningWaves) {
      if (wave.phase === "thinking") {
        this.drawUltraCodeAgents(wave, tone);
      } else {
        this.drawUltraCodeResponse(wave, tone);
      }
    }
  }

  private drawUltraCodeAgents(
    wave: ReasoningWaveState,
    tone: number,
  ): void {
    const progress = Phaser.Math.Clamp(
      1 - wave.telegraphRemainingMs / wave.telegraphDurationMs,
      0,
      1,
    );
    const workingCount = ultraWorkingAgentCount(progress);
    const workingIndices = ultraWorkingAgentIndices(workingCount);
    const completedCount = 8 - workingCount;
    const previewRadius = Math.min(190, Math.max(140, wave.maxRadius * 0.13));
    const dangerousArc = Math.PI * 2 - wave.safeArc;
    const responseStart = wave.safeAngle + wave.safeArc / 2;

    this.strokeReasoningArc(wave, previewRadius, 10, tone, 0.045);
    this.strokeReasoningArc(wave, previewRadius, 2, tone, 0.72);
    this.drawUltraSafeSector(wave, previewRadius, tone, 0.72, true);

    this.world.lineStyle(1, tone, 0.62 + progress * 0.24);
    this.world.strokeRect(
      Math.round(wave.center.x) - 11,
      Math.round(wave.center.y) - 8,
      22,
      16,
    );
    for (let slot = 0; slot < 8; slot += 1) {
      const completed = slot < completedCount;
      this.world.lineStyle(
        1,
        completed ? tone : COLORS.muted,
        completed ? 0.9 : 0.26,
      );
      const row = Math.floor(slot / 2);
      const column = slot % 2;
      const rowStartX = wave.center.x - 7 + column * 8;
      this.world.lineBetween(
        rowStartX,
        wave.center.y - 5 + row * 3,
        rowStartX + 5,
        wave.center.y - 5 + row * 3,
      );
    }

    for (let index = 0; index < 8; index += 1) {
      const angle = responseStart + dangerousArc * ((index + 0.5) / 8);
      const agentX = wave.center.x + Math.cos(angle) * previewRadius;
      const agentY = wave.center.y + Math.sin(angle) * previewRadius;
      const working = workingIndices.includes(index);

      if (working) {
        this.world.lineStyle(1, tone, 0.48 + progress * 0.2);
        this.world.strokeRect(
          Math.round(agentX) - 8,
          Math.round(agentY) - 5,
          16,
          10,
        );
        this.world.lineStyle(1, COLORS.ink, 0.46);
        this.world.lineBetween(
          Math.round(agentX) - 4,
          Math.round(agentY) - 2,
          Math.round(agentX) + 4,
          Math.round(agentY) - 2,
        );
        this.world.lineBetween(
          Math.round(agentX) - 4,
          Math.round(agentY) + 2,
          Math.round(agentX) + 1,
          Math.round(agentY) + 2,
        );
        continue;
      }

      this.world.fillStyle(tone, 0.9);
      this.world.fillRect(
        Math.round(agentX) - 6,
        Math.round(agentY) - 4,
        12,
        8,
      );
      this.world.lineStyle(1, tone, 0.18);
      this.world.lineBetween(
        agentX - Math.cos(angle) * 8,
        agentY - Math.sin(angle) * 8,
        wave.center.x + Math.cos(angle) * 14,
        wave.center.y + Math.sin(angle) * 14,
      );

      const responseProgress = Phaser.Math.Clamp(
        (progress - ultraAgentCompletionThreshold(index)) / 0.16,
        0,
        1,
      );
      const packetX = Phaser.Math.Linear(
        agentX,
        wave.center.x,
        responseProgress,
      );
      const packetY = Phaser.Math.Linear(
        agentY,
        wave.center.y,
        responseProgress,
      );
      this.world.fillStyle(COLORS.ink, 0.92);
      this.world.fillRect(
        Math.round(packetX) - 1,
        Math.round(packetY) - 1,
        3,
        3,
      );
    }
  }

  private drawUltraCodeResponse(
    wave: ReasoningWaveState,
    tone: number,
  ): void {
    if (wave.radius <= 0) {
      return;
    }

    const thickness = Math.min(16, Math.max(12, wave.thickness));
    this.strokeReasoningArc(wave, wave.radius, thickness, tone, 0.14);
    this.strokeReasoningArc(wave, wave.radius, 1, tone, 0.94);
    const dangerousArc = Math.PI * 2 - wave.safeArc;
    const responseStart = wave.safeAngle + wave.safeArc / 2;
    this.world.lineStyle(2, tone, 0.72);
    for (let index = 0; index < 8; index += 1) {
      const angle = responseStart + dangerousArc * ((index + 0.5) / 8);
      this.world.lineBetween(
        wave.center.x + Math.cos(angle) * (wave.radius + 7),
        wave.center.y + Math.sin(angle) * (wave.radius + 7),
        wave.center.x + Math.cos(angle) * Math.max(0, wave.radius - 7),
        wave.center.y + Math.sin(angle) * Math.max(0, wave.radius - 7),
      );
    }
    this.world.lineStyle(1, tone, 0.72);
    this.world.strokeRect(
      Math.round(wave.center.x) - 11,
      Math.round(wave.center.y) - 8,
      22,
      16,
    );
    this.world.lineStyle(1, tone, 0.92);
    for (let slot = 0; slot < 8; slot += 1) {
      const row = Math.floor(slot / 2);
      const column = slot % 2;
      const rowStartX = wave.center.x - 7 + column * 8;
      this.world.lineBetween(
        rowStartX,
        wave.center.y - 5 + row * 3,
        rowStartX + 5,
        wave.center.y - 5 + row * 3,
      );
    }
    this.drawUltraSafeSector(wave, wave.radius, tone, 0.9, false);
  }

  private strokeReasoningArc(
    wave: ReasoningWaveState,
    radius: number,
    width: number,
    color: number,
    alpha: number,
  ): void {
    if (radius <= 0) {
      return;
    }

    const start = wave.safeAngle + wave.safeArc / 2;
    const end = wave.safeAngle + Math.PI * 2 - wave.safeArc / 2;
    this.world.lineStyle(width, color, alpha);
    this.world.beginPath();
    this.world.arc(wave.center.x, wave.center.y, radius, start, end, false);
    this.world.strokePath();
  }

  private drawUltraSafeSector(
    wave: ReasoningWaveState,
    radius: number,
    color: number,
    alpha: number,
    extended: boolean,
  ): void {
    const innerRadius = extended
      ? Math.max(28, radius * 0.48)
      : Math.max(8, radius - 10);
    const outerRadius = radius + (extended ? 12 : 9);
    this.world.lineStyle(1, color, alpha);
    for (const angle of [
      wave.safeAngle - wave.safeArc / 2,
      wave.safeAngle + wave.safeArc / 2,
    ]) {
      this.world.lineBetween(
        wave.center.x + Math.cos(angle) * innerRadius,
        wave.center.y + Math.sin(angle) * innerRadius,
        wave.center.x + Math.cos(angle) * outerRadius,
        wave.center.y + Math.sin(angle) * outerRadius,
      );
    }

    if (!extended) {
      return;
    }

    this.world.lineStyle(2, color, alpha * 0.72);
    for (const radiusRatio of [0.64, 0.79, 0.94]) {
      const markerRadius = radius * radiusRatio;
      const tangentX = -Math.sin(wave.safeAngle) * 4;
      const tangentY = Math.cos(wave.safeAngle) * 4;
      const markerX = wave.center.x + Math.cos(wave.safeAngle) * markerRadius;
      const markerY = wave.center.y + Math.sin(wave.safeAngle) * markerRadius;
      this.world.lineBetween(
        markerX - tangentX,
        markerY - tangentY,
        markerX + tangentX,
        markerY + tangentY,
      );
    }
  }

  private drawPlayer(state: GameState): void {
    const x = Math.round(state.player.position.x);
    const y = Math.round(state.player.position.y);

    const insideBlackout = state.blackouts.some((blackout) =>
      pointInsideVisibleBlackout(blackout, state.player.position)
    );

    this.playerLayer.fillStyle(
      insideBlackout ? COLORS.background : COLORS.black,
      1,
    );
    this.playerLayer.fillRect(x - 6, y - 6, 12, 12);
  }

  private syncProjectileLabels(state: GameState): void {
    const activeIds = new Set<number>();

    for (const projectile of state.projectiles) {
      activeIds.add(projectile.id);
      let view = this.projectileLabels.get(projectile.id);
      if (!view) {
        view = this.createRichLabel(6);
        this.projectileLabels.set(projectile.id, view);
      }

      this.updateRichLabel(view, {
        surface: projectile.surface,
        label: projectile.label,
        fontFamily: this.projectileFontFamily(projectile),
        fontSize: this.projectileFontSize(projectile),
        fontStyle: projectile.surface === "terminal" ? "normal" : "500",
        letterSpacing: projectile.surface === "terminal" ? 0 : 0.15,
      });
      const revealAlpha = projectile.blackoutRevealGraceRemainingMs > 0
        ? Phaser.Math.Linear(
            0.48,
            0.96,
            1 -
              projectile.blackoutRevealGraceRemainingMs /
                GAMEPLAY.blackoutRevealGraceMs,
          )
        : 0.96;
      view.container
        .setPosition(
          Math.round(projectile.position.x),
          Math.round(projectile.position.y),
        )
        .setRotation(this.readableProjectileRotation(projectile.velocity))
        .setAlpha(projectile.telegraphRemainingMs > 0 ? 0.42 : revealAlpha)
        .setScale(1)
        .setVisible(true);
    }

    this.removeInactiveRichLabels(this.projectileLabels, activeIds);
  }

  private syncHazardLabels(state: GameState): void {
    const activeIds = new Set<number>();

    for (const hazard of state.hazards) {
      activeIds.add(hazard.id);
      let view = this.hazardLabels.get(hazard.id);
      if (!view) {
        view = this.createRichLabel(3);
        this.hazardLabels.set(hazard.id, view);
      }

      const active = hazard.phase === "active";
      const rect = this.hazardRect(hazard);
      const telegraphMs =
        hazard.kind === "compaction"
          ? GAMEPLAY.compactionTelegraphMs
          : GAMEPLAY.downloadAccessTelegraphMs;
      const progress = active
        ? 1
        : Phaser.Math.Clamp(1 - hazard.remainingMs / telegraphMs, 0, 1);
      const text =
        hazard.kind === "compaction"
          ? active
            ? "[context] COMPACTION FAILED"
            : `[context] compacting ${Math.round(progress * 100)}%`
          : active
            ? "[access] ACCESS!"
            : `[download] loading ${Math.round(progress * 100)}%`;
      const labelPosition =
        hazard.kind === "compaction"
          ? {
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2 + 34,
            }
          : {
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
            };

      this.updateRichLabel(view, {
        surface: hazard.kind === "compaction" ? "codex" : "browser",
        label: text,
        fontFamily:
          hazard.kind === "compaction" ? FONTS.sans : FONTS.browser,
        fontSize: hazard.kind === "compaction" ? 11 : active ? 18 : 14,
        fontStyle: active ? "700" : "600",
      });
      view.container
        .setPosition(
          Math.round(labelPosition.x),
          Math.round(labelPosition.y),
        )
        .setRotation(0)
        .setAlpha(active ? 1 : 0.82 + progress * 0.18)
        .setVisible(true);
    }

    this.removeInactiveRichLabels(this.hazardLabels, activeIds);
  }

  private syncSequenceLabels(state: GameState): void {
    const activeIds = new Set<number>();

    for (const sequence of state.sequences) {
      const progress = Phaser.Math.Clamp(
        1 - sequence.remainingMs / sequence.durationMs,
        0,
        1,
      );
      for (let index = 0; index < sequence.origins.length; index += 1) {
        const origin = sequence.origins[index]!;
        const id = sequence.id * 100 + index;
        activeIds.add(id);
        let view = this.sequenceLabels.get(id);
        if (!view) {
          view = this.createRichLabel(5);
          this.sequenceLabels.set(id, view);
        }

        const position = {
          x: Phaser.Math.Linear(origin.x, sequence.position.x, progress),
          y: Phaser.Math.Linear(origin.y, sequence.position.y, progress),
        };
        this.updateRichLabel(view, {
          surface: "codex",
          label:
            sequence.kind === "review-loop"
              ? `[review] P${index + 1} finding`
              : `[usage] -${8 + (index % 4) * 3}%`,
          fontFamily: FONTS.sans,
          fontSize: 10,
          fontStyle: "500",
        });
        view.container
          .setPosition(Math.round(position.x), Math.round(position.y))
          .setRotation(
            this.readableProjectileRotation(
              directionBetweenPoints(origin, sequence.position),
            ),
          )
          .setAlpha(0.72 + progress * 0.28)
          .setVisible(true);
      }

      const coreId = sequence.id * 100 + 99;
      activeIds.add(coreId);
      let coreView = this.sequenceLabels.get(coreId);
      if (!coreView) {
        coreView = this.createRichLabel(5);
        this.sequenceLabels.set(coreId, coreView);
      }
      this.updateRichLabel(coreView, {
        surface: "codex",
        label:
          sequence.kind === "review-loop"
            ? `[fix] ${Math.round(progress * 100)}% — reviewing again`
            : `[usage] ${Math.max(0, 100 - Math.round(progress * 100))}% left`,
        fontFamily: FONTS.sans,
        fontSize: 10,
        fontStyle: "normal",
      });
      coreView.container
        .setPosition(sequence.position.x, sequence.position.y + 34)
        .setVisible(true);
    }

    this.removeInactiveRichLabels(this.sequenceLabels, activeIds);
  }

  private syncApprovalGateLabels(state: GameState): void {
    const activeIds = new Set<number>();

    for (const gate of state.approvalGates) {
      for (let index = 0; index < gate.gaps.length; index += 1) {
        const gap = gate.gaps[index]!;
        const placement = approvalGateLabelPlacement(gate, gap, state.arena);
        const id = gate.id * 10 + index;
        activeIds.add(id);
        let view = this.approvalGateLabels.get(id);
        if (!view) {
          view = this.createRichLabel(6);
          this.approvalGateLabels.set(id, view);
        }
        this.updateRichLabel(view, {
          surface: "codex",
          label: approvalGateLabelText(gap.label),
          fontFamily: FONTS.sans,
          fontSize: 9,
          fontStyle: "600",
          letterSpacing: 0.1,
        });
        view.container
          .setPosition(
            Math.round(placement.position.x),
            Math.round(placement.position.y),
          )
          .setRotation(placement.rotation)
          .setAlpha(gate.telegraphRemainingMs > 0 ? 0.52 : 0.96)
          .setVisible(true);
      }
    }

    this.removeInactiveRichLabels(this.approvalGateLabels, activeIds);
  }

  private syncRetryChainLabels(state: GameState): void {
    const activeIds = new Set<number>();

    for (const retry of state.retryChains) {
      activeIds.add(retry.id);
      let view = this.retryChainLabels.get(retry.id);
      if (!view) {
        view = this.createRichLabel(6);
        this.retryChainLabels.set(retry.id, view);
      }
      this.updateRichLabel(view, {
        surface: "codex",
        label:
          retry.completionRemainingMs > 0
            ? `[tool] RETRY COMPLETE · ${retry.totalAttempts}/${retry.totalAttempts}`
            : retry.attempt === 1
            ? `[tool] retry ${retry.attempt}/${retry.totalAttempts}`
            : `[tool] FAILED · retry ${retry.attempt}/${retry.totalAttempts}`,
        fontFamily: FONTS.sans,
        fontSize: 10,
        fontStyle: "500",
        letterSpacing: 0.1,
      });
      view.container
        .setPosition(
          Math.round(retry.position.x),
          Math.round(retry.position.y),
        )
        .setRotation(this.readableProjectileRotation(retry.velocity))
        .setAlpha(
          retry.completionRemainingMs > 0
            ? Phaser.Math.Clamp(retry.completionRemainingMs / 120, 0, 1)
            : retry.telegraphRemainingMs > 0
              ? 0.52
              : 0.98,
        )
        .setVisible(true);
    }

    this.removeInactiveRichLabels(this.retryChainLabels, activeIds);
  }

  private syncReasoningWaveLabels(state: GameState): void {
    const activeIds = new Set<number>();

    for (const wave of state.reasoningWaves) {
      activeIds.add(wave.id);
      let view = this.reasoningWaveLabels.get(wave.id);
      if (!view) {
        view = this.createRichLabel(5);
        this.reasoningWaveLabels.set(wave.id, view);
      }

      const progress = Phaser.Math.Clamp(
        1 - wave.telegraphRemainingMs / wave.telegraphDurationMs,
        0,
        1,
      );
      const workingCount = ultraWorkingAgentCount(progress);
      const phaseStatus =
        wave.phase === "active"
          ? "[ultra] 8/8 done · FINAL RESPONSE"
          : workingCount === 8
            ? "[ultra] 8 agents running"
            : `[ultra] ${workingCount} agent${workingCount === 1 ? "" : "s"} remaining`;
      const status = `${phaseStatus} · [safe] 120°`;
      this.updateRichLabel(view, {
        surface: "codex",
        label: status,
        fontFamily: FONTS.sans,
        fontSize: 10,
        fontStyle: wave.phase === "active" ? "600" : "500",
        letterSpacing: 0.1,
      });

      const labelWidth =
        status.length * (wave.phase === "active" ? 5.2 : 5.5);
      const labelX = Phaser.Math.Clamp(
        wave.center.x - labelWidth / 2,
        10,
        Math.max(10, state.arena.width - labelWidth - 10),
      );
      const labelY = Phaser.Math.Clamp(
        wave.center.y + 36,
        16,
        Math.max(16, state.arena.height - 18),
      );
      view.container
        .setPosition(Math.round(labelX), Math.round(labelY))
        .setRotation(0)
        .setAlpha(wave.phase === "active" ? 0.96 : 0.78 + progress * 0.16)
        .setVisible(true);
    }

    this.removeInactiveRichLabels(this.reasoningWaveLabels, activeIds);
  }

  private drawBlackouts(state: GameState): void {
    for (const blackout of state.blackouts) {
      if (blackout.telegraphRemainingMs > 0) {
        const x = blackout.position.x - blackout.hitbox.width / 2;
        const y = blackout.position.y - blackout.hitbox.height / 2;
        this.blackoutLayer.lineStyle(1, COLORS.black, 0.5);
        this.blackoutLayer.strokeRect(x, y, blackout.hitbox.width, blackout.hitbox.height);
        continue;
      }

      const visual = blackoutVisualState(blackout);
      const width = blackout.hitbox.width * visual.scale;
      const height = blackout.hitbox.height * visual.scale;
      const x = blackout.position.x - width / 2;
      const y = blackout.position.y - height / 2;
      this.blackoutLayer.fillStyle(COLORS.black, 1);
      this.blackoutLayer.fillRect(x, y, width, height);

      const railWidth = Math.min(180, width * 0.46);
      const railX = blackout.position.x - railWidth / 2;
      const railY = blackout.position.y + Math.min(52, height * 0.18);
      this.blackoutLayer.fillStyle(COLORS.background, 0.28);
      this.blackoutLayer.fillRect(railX, railY, railWidth, 2);
      this.blackoutLayer.fillStyle(COLORS.background, 0.92);
      this.blackoutLayer.fillRect(
        railX,
        railY,
        railWidth * visual.backupProgress,
        2,
      );

      if (visual.recovering) {
        this.blackoutLayer.lineStyle(1, COLORS.background, visual.scale);
        this.blackoutLayer.strokeRect(x, y, width, height);
      }
    }
  }

  private syncBlackoutViews(state: GameState): void {
    const activeIds = new Set<number>();

    for (const blackout of state.blackouts) {
      activeIds.add(blackout.id);
      let view = this.blackoutViews.get(blackout.id);
      if (!view) {
        view = {
          command: this.scene.add
            .text(0, 0, "$ rm *", {
              color: TEXT_COLORS.surface,
              fontFamily: FONTS.mono,
              fontSize: "10px",
            })
            .setResolution(this.textResolution)
            .setDepth(RENDER_DEPTHS.blackoutLabel),
          status: this.scene.add
            .text(0, 0, "", {
              align: "center",
              color: TEXT_COLORS.surface,
              fontFamily: FONTS.mono,
              fontSize: "10px",
              fontStyle: "500",
              lineSpacing: 5,
            })
            .setResolution(this.textResolution)
            .setOrigin(0.5)
            .setDepth(RENDER_DEPTHS.blackoutLabel),
        };
        this.blackoutViews.set(blackout.id, view);
      }

      const telegraphing = blackout.telegraphRemainingMs > 0;
      const visual = blackoutVisualState(blackout);
      const visualScale = telegraphing ? 1 : visual.scale;
      const x = blackout.position.x -
        (blackout.hitbox.width * visualScale) / 2;
      const y = blackout.position.y -
        (blackout.hitbox.height * visualScale) / 2;
      const telegraphProgress = Phaser.Math.Clamp(
        1 - blackout.telegraphRemainingMs / GAMEPLAY.blackoutTelegraphMs,
        0,
        1,
      );
      view.command
        .setColor(telegraphing ? TEXT_COLORS.ink : TEXT_COLORS.surface)
        .setPosition(Math.round(x + 12), Math.round(y + 10))
        .setAlpha(visual.recovering ? visual.scale : 1)
        .setVisible(!visual.recovering);
      view.status
        .setColor(telegraphing ? TEXT_COLORS.ink : TEXT_COLORS.surface)
        .setText(
          telegraphing
            ? `DELETE TARGET\n${Math.round(telegraphProgress * 100)}%`
            : visual.recovering
              ? "BACKUP COMPLETE\n100%"
              : `BACKING UP...\n${Math.round(visual.backupProgress * 100)}%`,
        )
        .setPosition(
          Math.round(blackout.position.x),
          Math.round(blackout.position.y),
        )
        .setAlpha(visual.recovering ? visual.scale : 1)
        .setVisible(telegraphing || visual.scale > 0.12);
    }

    for (const [id, view] of this.blackoutViews) {
      if (!activeIds.has(id)) {
        view.command.destroy();
        view.status.destroy();
        this.blackoutViews.delete(id);
      }
    }
  }

  private createRichLabel(depth: number): RichLabelView {
    return {
      container: this.scene.add.container(0, 0).setDepth(depth),
      signature: "",
    };
  }

  private updateRichLabel(view: RichLabelView, style: RichLabelStyle): void {
    const signature = [
      style.surface,
      style.label,
      style.fontFamily,
      style.fontSize,
      style.fontStyle,
      style.letterSpacing ?? 0,
    ].join("|");
    if (view.signature === signature) {
      return;
    }

    view.container.removeAll(true);
    view.signature = signature;
    const tokens = attackTextTokens(style.surface, style.label);
    const pieces = tokens.map((part) =>
      this.scene.add
        .text(0, 0, part.text, {
          color: attackTextColor(part.role),
          fontFamily: style.fontFamily,
          fontSize: `${style.fontSize}px`,
          fontStyle: style.fontStyle,
          stroke: TEXT_COLORS.surface,
          strokeThickness: RICH_LABEL_STROKE_THICKNESS,
        })
        .setResolution(this.textResolution)
        .setOrigin(0, 0.5)
        .setLetterSpacing(style.letterSpacing ?? 0),
    );
    const layout = layoutAttackTextTokens(
      style.surface,
      tokens,
      pieces.map((piece) => piece.width),
      RICH_LABEL_STROKE_THICKNESS,
    );
    for (let index = 0; index < pieces.length; index += 1) {
      const piece = pieces[index];
      if (!piece) {
        continue;
      }
      piece.setPosition(layout.offsets[index] ?? 0, 0);
      view.container.add(piece);
    }
  }

  private projectileFontSize(projectile: ProjectileState): number {
    if (projectile.kind === "approval") {
      return 11;
    }
    if (projectile.kind === "context-token") {
      return 9;
    }
    if (projectile.kind === "retry" || projectile.kind === "agent") {
      return 10;
    }
    if (projectile.kind === "limit") {
      return 11;
    }
    if (projectile.kind === "finding") {
      return 10;
    }
    return projectile.surface === "browser" ? 10 : 11;
  }

  private projectileFontFamily(projectile: ProjectileState): string {
    if (projectile.surface === "terminal") {
      return FONTS.mono;
    }
    return projectile.surface === "browser" ? FONTS.browser : FONTS.sans;
  }

  private drawProjectileSurfaceMark(projectile: ProjectileState): void {
    if (
      projectile.surface === "terminal" ||
      projectile.kind === "context-token"
    ) {
      return;
    }

    const angle = this.readableProjectileRotation(projectile.velocity);
    const baseline = { x: Math.cos(angle), y: Math.sin(angle) };
    const normal = { x: -baseline.y, y: baseline.x };
    const center = {
      x: projectile.position.x - baseline.x * (projectile.hitbox.width / 2 + 5),
      y: projectile.position.y - baseline.y * (projectile.hitbox.width / 2 + 5),
    };
    const tone = this.projectileTone(projectile);
    const alpha = projectile.telegraphRemainingMs > 0 ? 0.34 : 0.72;

    if (projectile.surface === "codex") {
      this.world.fillStyle(tone.value, alpha);
      this.world.fillRect(Math.round(center.x) - 1, Math.round(center.y) - 1, 3, 3);
      return;
    }

    const halfWidth = 3;
    const halfHeight = 4;
    const topLeft = {
      x: center.x - baseline.x * halfWidth - normal.x * halfHeight,
      y: center.y - baseline.y * halfWidth - normal.y * halfHeight,
    };
    const topRight = {
      x: center.x + baseline.x * halfWidth - normal.x * halfHeight,
      y: center.y + baseline.y * halfWidth - normal.y * halfHeight,
    };
    const bottomRight = {
      x: center.x + baseline.x * halfWidth + normal.x * halfHeight,
      y: center.y + baseline.y * halfWidth + normal.y * halfHeight,
    };
    const bottomLeft = {
      x: center.x - baseline.x * halfWidth + normal.x * halfHeight,
      y: center.y - baseline.y * halfWidth + normal.y * halfHeight,
    };
    this.world.lineStyle(1, tone.value, alpha);
    this.world.lineBetween(topLeft.x, topLeft.y, topRight.x, topRight.y);
    this.world.lineBetween(topRight.x, topRight.y, bottomRight.x, bottomRight.y);
    this.world.lineBetween(
      bottomRight.x,
      bottomRight.y,
      bottomLeft.x,
      bottomLeft.y,
    );
    this.world.lineBetween(bottomLeft.x, bottomLeft.y, topLeft.x, topLeft.y);
    this.world.lineBetween(
      topLeft.x + baseline.x * 2,
      topLeft.y + baseline.y * 2,
      topRight.x - normal.x * 2,
      topRight.y - normal.y * 2,
    );
  }

  private projectileTone(projectile: ProjectileState): AttackTone {
    const label = projectile.label.toLowerCase();
    if (projectile.surface === "codex") {
      return ATTACK_TONES.codex;
    }
    if (projectile.surface === "browser") {
      if (label.includes("404") || label.includes("err_")) {
        return ATTACK_TONES.browserError;
      }
      return ATTACK_TONES.browserAccent;
    }
    if (
      projectile.kind === "limit" ||
      label.includes("error") ||
      label.includes("failed") ||
      label.includes("ts2322") ||
      label.includes("pr #404")
    ) {
      return ATTACK_TONES.terminalError;
    }
    if (
      projectile.kind === "retry" ||
      label.includes("warning") ||
      label.includes("rebase") ||
      label.startsWith("write")
    ) {
      return ATTACK_TONES.terminalWarning;
    }
    if (
      projectile.kind === "finding" ||
      label.startsWith("+") ||
      label.startsWith("read")
    ) {
      return ATTACK_TONES.terminalSuccess;
    }
    if (label.startsWith("$")) {
      return ATTACK_TONES.terminalCommand;
    }
    return ATTACK_TONES.neutral;
  }

  private readableProjectileRotation(direction: Vec2): number {
    let angle = Math.atan2(direction.y, direction.x);
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
      angle += Math.PI;
    }
    return angle;
  }

  private drawMotionRail(
    projectile: ProjectileState,
    length: number,
    alpha: number,
  ): void {
    const tailOrigin = {
      x:
        projectile.position.x -
        projectile.velocity.x * (projectile.hitbox.width / 2 + 5),
      y:
        projectile.position.y -
        projectile.velocity.y * (projectile.hitbox.width / 2 + 5),
    };

    const tone = this.projectileTone(projectile);
    this.world.lineStyle(1, tone.value, alpha);
    this.world.lineBetween(
      tailOrigin.x,
      tailOrigin.y,
      tailOrigin.x - projectile.velocity.x * length,
      tailOrigin.y - projectile.velocity.y * length,
    );
  }

  private drawDottedRay(
    origin: Vec2,
    direction: Vec2,
    length: number,
    color: number,
    alpha: number,
    spacing: number,
  ): void {
    this.world.fillStyle(color, alpha);
    for (let distance = 10; distance < length; distance += spacing) {
      this.world.fillRect(
        Math.round(origin.x + direction.x * distance),
        Math.round(origin.y + direction.y * distance),
        2,
        2,
      );
    }
  }

  private hazardRect(hazard: AreaHazardState): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return {
      x: hazard.position.x - hazard.hitbox.width / 2,
      y: hazard.position.y - hazard.hitbox.height / 2,
      width: hazard.hitbox.width,
      height: hazard.hitbox.height,
    };
  }

  private drawEffects(): void {
    for (const particle of this.particles) {
      const alpha = 1 - particle.ageMs / particle.durationMs;
      const size = Math.max(1, Math.round(particle.size * alpha));
      this.effectsLayer.fillStyle(particle.color, alpha);
      this.effectsLayer.fillRect(
        Math.round(particle.x - size / 2),
        Math.round(particle.y - size / 2),
        size,
        size,
      );
    }
  }

  private advanceEffects(frameDeltaMs: number): void {
    const safeDelta = Math.min(50, Math.max(0, frameDeltaMs));
    this.hitFlashMs = Math.max(0, this.hitFlashMs - safeDelta);

    for (const particle of this.particles) {
      particle.ageMs += safeDelta;
      particle.x += particle.velocity.x * (safeDelta / 1_000);
      particle.y += particle.velocity.y * (safeDelta / 1_000);
      particle.velocity.y += particle.gravity * (safeDelta / 1_000);
    }

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      if (particle && particle.ageMs >= particle.durationMs) {
        this.particles.splice(index, 1);
      }
    }
  }

  private addBurst(position: Vec2, count: number, phase: number): void {
    for (let index = 0; index < count; index += 1) {
      const angle = phase + (Math.PI * 2 * index) / count;
      const speed = 110 + (index % 4) * 32;
      this.particles.push({
        ...position,
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        ageMs: 0,
        durationMs: 300 + (index % 3) * 55,
        size: 5 + (index % 3),
        gravity: 0,
        color: COLORS.black,
      });
    }
  }

  private addContextBurst(position: Vec2, phase: number): void {
    const count = 20;
    for (let index = 0; index < count; index += 1) {
      const seed = phase * 0.001 + index * 19.37;
      const angle = seededUnit(seed + 1.7) * Math.PI * 2;
      const speed = 80 + seededUnit(seed + 4.1) * 190;
      const originRadius = 2 + seededUnit(seed + 8.3) * 22;
      this.particles.push({
        x: position.x + Math.cos(angle) * originRadius,
        y: position.y + Math.sin(angle) * originRadius * 0.65,
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        ageMs: 0,
        durationMs: 480 + seededUnit(seed + 12.9) * 520,
        size: 1.5 + seededUnit(seed + 16.4) * 3.5,
        gravity: 360 + seededUnit(seed + 22.2) * 440,
        color:
          seededUnit(seed + 27.6) > 0.72
            ? COLORS.black
            : ATTACK_TONES.codex.value,
      });
    }
  }

  private removeInactiveRichLabels(
    map: Map<number, RichLabelView>,
    activeIds: ReadonlySet<number>,
  ): void {
    for (const [id, view] of map) {
      if (!activeIds.has(id)) {
        view.container.destroy(true);
        map.delete(id);
      }
    }
  }

  private destroyRichLabelMap(map: Map<number, RichLabelView>): void {
    for (const view of map.values()) {
      view.container.destroy(true);
    }
    map.clear();
  }

  private destroyBlackoutViews(): void {
    for (const view of this.blackoutViews.values()) {
      view.command.destroy();
      view.status.destroy();
    }
    this.blackoutViews.clear();
  }
}
