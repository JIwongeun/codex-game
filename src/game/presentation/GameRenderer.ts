import Phaser from "phaser";

import { GAMEPLAY } from "../constants";
import type {
  AttackSurface,
  AreaHazardState,
  GameEvent,
  GameState,
  ProjectileState,
  Vec2,
} from "../core/model";
import {
  attackTextColor,
  attackTextTokens,
  layoutAttackTextTokens,
} from "./attackText";
import { ATTACK_TONES, COLORS, FONTS, TEXT_COLORS } from "./theme";

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

function directionBetweenPoints(from: Vec2, to: Vec2): Vec2 {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const magnitude = Math.hypot(deltaX, deltaY) || 1;
  return { x: deltaX / magnitude, y: deltaY / magnitude };
}

export class GameRenderer {
  private readonly scene: Phaser.Scene;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly world: Phaser.GameObjects.Graphics;
  private readonly playerLayer: Phaser.GameObjects.Graphics;
  private readonly effectsLayer: Phaser.GameObjects.Graphics;
  private readonly projectileLabels = new Map<number, RichLabelView>();
  private readonly hazardLabels = new Map<number, RichLabelView>();
  private readonly sequenceLabels = new Map<number, RichLabelView>();
  private readonly particles: ParticleEffect[] = [];
  private hitFlashMs = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.background = scene.add.graphics().setDepth(-10);
    this.world = scene.add.graphics().setDepth(1);
    this.playerLayer = scene.add.graphics().setDepth(10);
    this.effectsLayer = scene.add.graphics().setDepth(11);
  }

  consume(events: readonly GameEvent[], state: GameState): void {
    for (const event of events) {
      if (event.type === "hazard-activated") {
        if (event.kind === "compaction") {
          this.addContextBurst(event.position, state.elapsedMs);
        } else {
          this.addBurst(event.position, 14, state.elapsedMs);
        }
      } else if (event.type === "pattern-burst") {
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
    this.playerLayer.clear();
    this.effectsLayer.clear();

    this.drawHazards(state);
    this.drawSequences(state);
    this.drawProjectiles(state);
    this.syncProjectileLabels(state);
    this.syncHazardLabels(state);
    this.syncSequenceLabels(state);
    this.drawPlayer(state);
    this.drawEffects();

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
    this.hitFlashMs = 0;
  }

  private drawBackground(state: GameState): void {
    this.background.clear();
    this.background.fillStyle(COLORS.background, 1);
    this.background.fillRect(0, 0, state.arena.width, state.arena.height);
  }

  private drawHazards(state: GameState): void {
    for (const hazard of state.hazards) {
      if (hazard.kind === "compaction") {
        this.drawCompaction(hazard);
      } else {
        this.drawFullAccess(hazard);
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
      const compression = Phaser.Math.Easing.Quadratic.In(progress);

      for (let index = 0; index < 4; index += 1) {
        const startSize = Math.min(width, height) * (0.16 + index * 0.05);
        const frameWidth = Phaser.Math.Linear(
          startSize,
          10 + index * 3,
          compression,
        );
        const frameHeight = Phaser.Math.Linear(
          startSize * (0.62 + (index % 2) * 0.12),
          10 + index * 3,
          compression,
        );
        this.world.lineStyle(
          1,
          index % 2 === 0 ? tone : COLORS.muted,
          0.12 + progress * 0.24,
        );
        this.world.strokeRect(
          centerX - frameWidth / 2,
          centerY - frameHeight / 2,
          frameWidth,
          frameHeight,
        );
      }

      for (let index = 0; index < 7; index += 1) {
        const startX = centerX + ((index % 3) - 1) * width * 0.17;
        const startY = centerY + (index - 3) * height * 0.055;
        const lineCenterX = Phaser.Math.Linear(startX, centerX, compression);
        const lineY = Phaser.Math.Linear(
          startY,
          centerY + (index - 3) * 2,
          compression,
        );
        const lineWidth = Phaser.Math.Linear(
          width * (0.13 + (index % 3) * 0.035),
          3 + (index % 2) * 2,
          compression,
        );
        this.world.fillStyle(
          index % 3 === 0 ? tone : COLORS.muted,
          0.16 + progress * 0.28,
        );
        this.world.fillRect(
          Math.round(lineCenterX - lineWidth / 2),
          Math.round(lineY),
          Math.max(2, Math.round(lineWidth)),
          index % 3 === 0 ? 2 : 1,
        );
      }

      const coreSize = 3 + Math.round(progress * 5);
      this.world.fillStyle(tone, 0.52 + progress * 0.4);
      this.world.fillRect(
        Math.round(centerX - coreSize / 2),
        Math.round(centerY - coreSize / 2),
        coreSize,
        coreSize,
      );
      return;
    }

    const burstProgress = Phaser.Math.Clamp(
      1 - hazard.remainingMs / GAMEPLAY.compactionActiveMs,
      0,
      1,
    );
    const frameFade = 1 - burstProgress;

    for (let index = 0; index < 3; index += 1) {
      const ringProgress = Phaser.Math.Clamp(
        burstProgress * 1.25 - index * 0.12,
        0,
        1,
      );
      const ringWidth = Phaser.Math.Linear(8, 62 + index * 12, ringProgress);
      const ringHeight = Phaser.Math.Linear(8, 44 + index * 10, ringProgress);
      this.world.lineStyle(1, tone, (1 - ringProgress) * 0.64);
      this.world.strokeRect(
        centerX - ringWidth / 2,
        centerY - ringHeight / 2,
        ringWidth,
        ringHeight,
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

  private drawFullAccess(hazard: AreaHazardState): void {
    const { x, y, width, height } = this.hazardRect(hazard);
    const active = hazard.phase === "active";
    const progress = active
      ? 1
      : Phaser.Math.Clamp(
          1 - hazard.remainingMs / GAMEPLAY.fullAccessTelegraphMs,
          0,
          1,
        );
    const tone = ATTACK_TONES.codex.value;

    this.world.fillStyle(
      active ? COLORS.ink : tone,
      active ? 0.11 : 0.012 + progress * 0.018,
    );
    this.world.fillRect(x, y, width, height);
    this.world.lineStyle(1, active ? COLORS.ink : tone, active ? 0.86 : 0.3);
    this.world.strokeRect(x, y, width, height);
    this.drawCornerBrackets(
      x,
      y,
      width,
      height,
      active ? COLORS.ink : tone,
      active ? 0.96 : 0.48 + progress * 0.34,
      13,
    );

    if (!active) {
      const scanY = y + height * progress;
      this.world.lineStyle(1, tone, 0.18 + progress * 0.3);
      this.world.lineBetween(x + 8, scanY, x + width - 8, scanY);
      this.world.fillStyle(tone, 0.54 + progress * 0.32);
      this.world.fillRect(x, y, 3, Math.max(2, height * progress));
      return;
    }

    for (let offset = -height; offset < width; offset += 16) {
      this.world.lineStyle(1, COLORS.ink, 0.12);
      this.world.lineBetween(
        x + Math.max(0, offset),
        y + Math.max(0, -offset),
        x + Math.min(width, offset + height),
        y + Math.min(height, height + offset),
      );
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

      const length =
        projectile.kind === "context-token"
          ? 10
          : projectile.kind === "approval" || projectile.kind === "agent"
            ? 28
            : projectile.kind === "retry"
              ? 24
              : projectile.kind === "finding" || projectile.kind === "limit"
                ? 14
                : projectile.kind === "reasoning"
                  ? 28
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

  private drawPlayer(state: GameState): void {
    const x = Math.round(state.player.position.x);
    const y = Math.round(state.player.position.y);

    this.playerLayer.fillStyle(COLORS.black, 1);
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
      view.container
        .setPosition(
          Math.round(projectile.position.x),
          Math.round(projectile.position.y),
        )
        .setRotation(this.readableProjectileRotation(projectile.velocity))
        .setAlpha(projectile.telegraphRemainingMs > 0 ? 0.42 : 0.96)
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
          : GAMEPLAY.fullAccessTelegraphMs;
      const progress = active
        ? 1
        : Phaser.Math.Clamp(1 - hazard.remainingMs / telegraphMs, 0, 1);
      const text =
        hazard.kind === "compaction"
          ? active
            ? "[context] COMPACTION FAILED"
            : `[context] compacting ${Math.round(progress * 100)}%`
          : active
            ? "[approval] FULL ACCESS GRANTED"
            : `[approval] FULL ACCESS? ${Math.round(progress * 100)}%`;
      const labelPosition =
        hazard.kind === "compaction"
          ? {
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2 + 34,
            }
          : { x: rect.x + 108, y: rect.y + 18 };

      this.updateRichLabel(view, {
        surface: "codex",
        label: text,
        fontFamily: FONTS.sans,
        fontSize: 11,
        fontStyle: "500",
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
    if (projectile.kind === "approval" || projectile.kind === "reasoning") {
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
    if (projectile.surface === "terminal") {
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

  private drawCornerBrackets(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    alpha: number,
    size: number,
  ): void {
    this.world.lineStyle(1, color, alpha);
    this.world.lineBetween(x, y, x + size, y);
    this.world.lineBetween(x, y, x, y + size);
    this.world.lineBetween(x + width, y, x + width - size, y);
    this.world.lineBetween(x + width, y, x + width, y + size);
    this.world.lineBetween(x, y + height, x + size, y + height);
    this.world.lineBetween(x, y + height, x, y + height - size);
    this.world.lineBetween(x + width, y + height, x + width - size, y + height);
    this.world.lineBetween(x + width, y + height, x + width, y + height - size);
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
    const count = 32;
    for (let index = 0; index < count; index += 1) {
      const angle = phase + (Math.PI * 2 * index) / count;
      const speed = 105 + (index % 6) * 24;
      this.particles.push({
        ...position,
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        ageMs: 0,
        durationMs: 640 + (index % 4) * 70,
        size: 2 + (index % 3),
        gravity: 520,
        color:
          index % 4 === 0 ? COLORS.black : ATTACK_TONES.codex.value,
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
}
