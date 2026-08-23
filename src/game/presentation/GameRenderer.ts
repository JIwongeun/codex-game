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
import { attackTextColor, attackTextTokens } from "./attackText";
import { ATTACK_TONES, COLORS, FONTS, TEXT_COLORS } from "./theme";

type AttackTone = (typeof ATTACK_TONES)[keyof typeof ATTACK_TONES];

interface ParticleEffect extends Vec2 {
  velocity: Vec2;
  ageMs: number;
  durationMs: number;
  size: number;
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
  colorOverride?: string;
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
        this.addBurst(state.player.position, 7, state.elapsedMs);
      } else if (event.type === "pattern-burst") {
        this.addBurst(
          event.position,
          event.kind === "merge-bug" ? 36 : 24,
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
      this.drawContextMax(hazard);
    }
  }

  private drawContextMax(hazard: AreaHazardState): void {
    const { x, y, width, height } = this.hazardRect(hazard);
    const active = hazard.phase === "active";
    const progress = active
      ? 1
      : Phaser.Math.Clamp(
          1 - hazard.remainingMs / GAMEPLAY.contextMaxTelegraphMs,
          0,
          1,
        );

    this.world.fillStyle(
      ATTACK_TONES.codex.value,
      active ? 0.94 : 0.02 + progress * 0.035,
    );
    this.world.fillRect(x, y, width, height);

    if (!active) {
      this.drawCornerBrackets(
        x,
        y,
        width,
        height,
        ATTACK_TONES.codex.value,
        0.9,
        18,
      );
      this.world.fillStyle(ATTACK_TONES.codex.value, 0.82);
      this.world.fillRect(x, y - 2, width * progress, 2);
      this.world.fillStyle(
        ATTACK_TONES.codex.value,
        0.14 + progress * 0.38,
      );
      this.world.fillRect(x, y + height * progress - 1, width, 1);

      const segments = 12;
      const segmentWidth = width / segments;
      for (let index = 0; index < segments; index += 1) {
        const filled = index / segments <= progress;
        this.world.fillStyle(
          ATTACK_TONES.codex.value,
          filled ? 0.58 : 0.1,
        );
        this.world.fillRect(
          x + index * segmentWidth + 1,
          y + height - 9,
          Math.max(1, segmentWidth - 2),
          3,
        );
      }
      return;
    }

    this.drawCornerBrackets(x, y, width, height, COLORS.surface, 0.9, 20);
    this.drawHatchRect(x, y, width, height, 13, COLORS.surface, 0.2);
  }

  private drawProjectiles(state: GameState): void {
    for (const projectile of state.projectiles) {
      if (projectile.kind === "log") {
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
        projectile.kind === "review" || projectile.kind === "race"
          ? 28
          : projectile.kind === "retry"
            ? 24
            : projectile.kind === "bug" || projectile.kind === "branch"
              ? 14
              : 20;
      const alpha = projectile.kind === "bug" ? 0.48 : 0.28;
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
        const tone =
          sequence.kind === "fork-bomb"
            ? ATTACK_TONES.terminalSuccess
            : ATTACK_TONES.terminalError;
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
      const tone =
        sequence.kind === "fork-bomb"
          ? ATTACK_TONES.terminalSuccess
          : ATTACK_TONES.terminalError;
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
      const progress =
        hazard.kind === "context-max" && !active
          ? Phaser.Math.Clamp(
              1 - hazard.remainingMs / GAMEPLAY.contextMaxTelegraphMs,
              0,
              1,
            )
          : 1;
      const text = active
        ? "[context] MAX"
        : `[context] ${Math.round(progress * 100)}%`;

      this.updateRichLabel(view, {
        surface: "codex",
        label: text,
        fontFamily: FONTS.sans,
        fontSize: 11,
        fontStyle: "500",
        colorOverride: active ? TEXT_COLORS.surface : undefined,
      });
      view.container
        .setPosition(Math.round(hazard.position.x), Math.round(hazard.position.y))
        .setRotation(0)
        .setAlpha(active ? 1 : 0.9)
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
          surface: "terminal",
          label:
            sequence.kind === "fork-bomb"
              ? sequence.label
              : `change +${index + 1}`,
          fontFamily: FONTS.mono,
          fontSize: sequence.kind === "fork-bomb" ? 10 : 9,
          fontStyle: "normal",
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
        surface: "terminal",
        label:
          sequence.kind === "fork-bomb"
            ? `fork: ${Math.round(progress * 100)}%`
            : `$ git merge ${Math.round(progress * 100)}%`,
        fontFamily: FONTS.mono,
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
      style.colorOverride ?? "",
    ].join("|");
    if (view.signature === signature) {
      return;
    }

    view.container.removeAll(true);
    view.signature = signature;
    const pieces = attackTextTokens(style.surface, style.label).map((part) =>
      this.scene.add
        .text(0, 0, part.text, {
          color: style.colorOverride ?? attackTextColor(part.role),
          fontFamily: style.fontFamily,
          fontSize: `${style.fontSize}px`,
          fontStyle: style.fontStyle,
          stroke: TEXT_COLORS.surface,
          strokeThickness: 2,
        })
        .setOrigin(0, 0.5)
        .setLetterSpacing(style.letterSpacing ?? 0),
    );
    const totalWidth = pieces.reduce((width, piece) => width + piece.width, 0);
    let cursorX = -totalWidth / 2;
    for (const piece of pieces) {
      piece.setPosition(cursorX, 0);
      cursorX += piece.width;
      view.container.add(piece);
    }
  }

  private projectileFontSize(projectile: ProjectileState): number {
    if (projectile.kind === "review") {
      return 11;
    }
    if (projectile.kind === "retry" || projectile.kind === "race") {
      return 10;
    }
    if (projectile.kind === "bug") {
      return 11;
    }
    if (projectile.kind === "branch") {
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
      projectile.kind === "bug" ||
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
      projectile.kind === "branch" ||
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

  private drawHatchRect(
    x: number,
    y: number,
    width: number,
    height: number,
    spacing: number,
    color: number,
    alpha: number,
  ): void {
    this.world.lineStyle(1, color, alpha);
    for (let diagonal = 0; diagonal <= width + height; diagonal += spacing) {
      const startX = Math.max(0, diagonal - height);
      const startY = diagonal - startX;
      const endX = Math.min(width, diagonal);
      const endY = diagonal - endX;
      this.world.lineBetween(
        x + startX,
        y + startY,
        x + endX,
        y + endY,
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
      this.effectsLayer.fillStyle(COLORS.black, alpha);
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
