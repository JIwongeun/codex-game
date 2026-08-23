import Phaser from "phaser";

import { GAMEPLAY } from "../constants";
import type {
  AreaHazardState,
  GameEvent,
  GameState,
  ProjectileState,
  Vec2,
} from "../core/model";
import { COLORS, FONTS, TEXT_COLORS } from "./theme";

interface ParticleEffect extends Vec2 {
  velocity: Vec2;
  ageMs: number;
  durationMs: number;
  size: number;
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
  private readonly projectileLabels = new Map<number, Phaser.GameObjects.Text>();
  private readonly hazardLabels = new Map<number, Phaser.GameObjects.Text>();
  private readonly sequenceLabels = new Map<number, Phaser.GameObjects.Text>();
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
    this.destroyTextMap(this.projectileLabels);
    this.destroyTextMap(this.hazardLabels);
    this.destroyTextMap(this.sequenceLabels);
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
      COLORS.black,
      active ? 0.98 : 0.025 + progress * 0.035,
    );
    this.world.fillRect(x, y, width, height);

    if (!active) {
      this.drawCornerBrackets(x, y, width, height, COLORS.black, 1, 24);
      this.world.fillStyle(COLORS.black, 0.9);
      this.world.fillRect(x, y - 4, width * progress, 4);
      this.world.fillStyle(COLORS.black, 0.2 + progress * 0.55);
      this.world.fillRect(x, y + height * progress - 1, width, 2);

      const segments = 12;
      const segmentWidth = width / segments;
      for (let index = 0; index < segments; index += 1) {
        const filled = index / segments <= progress;
        this.world.fillStyle(COLORS.black, filled ? 0.72 : 0.14);
        this.world.fillRect(
          x + index * segmentWidth + 1,
          y + height - 9,
          Math.max(1, segmentWidth - 2),
          3,
        );
      }
      return;
    }

    this.drawCornerBrackets(x, y, width, height, COLORS.surface, 0.95, 28);
    this.drawHatchRect(x, y, width, height, 13, COLORS.surface, 0.2);
  }

  private drawProjectiles(state: GameState): void {
    for (const projectile of state.projectiles) {
      if (projectile.telegraphRemainingMs > 0) {
        const progress = Phaser.Math.Clamp(
          1 - projectile.telegraphRemainingMs / 1_300,
          0,
          1,
        );
        this.drawDottedRay(
          projectile.position,
          projectile.velocity,
          Math.hypot(state.arena.width, state.arena.height) * 1.3,
          COLORS.black,
          0.28 + progress * 0.54,
          projectile.kind === "log" ? 24 : 18,
        );
        continue;
      }

      const length =
        projectile.kind === "review" || projectile.kind === "race"
          ? 96
          : projectile.kind === "retry"
            ? 76
            : projectile.kind === "bug" || projectile.kind === "branch"
              ? 34
              : 54;
      const alpha = projectile.kind === "bug" ? 0.8 : 0.54;
      this.drawMotionRail(projectile, length, alpha);
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
        this.world.lineStyle(1, COLORS.black, 0.16 + progress * 0.34);
        this.world.lineBetween(
          origin.x,
          origin.y,
          sequence.position.x,
          sequence.position.y,
        );
      }

      const pulse = 10 + Math.floor(progress * 18);
      this.world.lineStyle(2, COLORS.black, 0.6 + progress * 0.4);
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

    const blink = Math.floor(state.elapsedMs / 180) % 2 === 0;
    const notchX = Math.round(x + state.player.direction.x * 20);
    const notchY = Math.round(y + state.player.direction.y * 20);

    this.playerLayer.fillStyle(COLORS.surface, 1);
    this.playerLayer.fillRect(x - 17, y - 14, 34, 28);
    this.playerLayer.fillStyle(COLORS.black, 1);
    this.playerLayer.fillRect(x - 15, y - 12, 30, 24);
    this.playerLayer.lineStyle(3, COLORS.surface, 1);
    this.playerLayer.lineBetween(x - 8, y - 6, x - 2, y);
    this.playerLayer.lineBetween(x - 2, y, x - 8, y + 6);
    this.playerLayer.lineBetween(x + 2, y + 6, x + (blink ? 10 : 7), y + 6);
    this.playerLayer.fillStyle(COLORS.black, 1);
    this.playerLayer.fillRect(notchX - 2, notchY - 2, 4, 4);

    this.playerLayer.lineStyle(2, COLORS.black, 0.72);
    this.playerLayer.lineBetween(x - 21, y - 16, x - 14, y - 16);
    this.playerLayer.lineBetween(x - 21, y - 16, x - 21, y - 9);
    this.playerLayer.lineBetween(x + 21, y + 16, x + 14, y + 16);
    this.playerLayer.lineBetween(x + 21, y + 16, x + 21, y + 9);
  }

  private syncProjectileLabels(state: GameState): void {
    const activeIds = new Set<number>();

    for (const projectile of state.projectiles) {
      activeIds.add(projectile.id);
      let label = this.projectileLabels.get(projectile.id);
      if (!label) {
        const fontSize = this.projectileFontSize(projectile);
        label = this.scene.add
          .text(0, 0, projectile.label, {
            color: TEXT_COLORS.ink,
            fontFamily: FONTS.sans,
            fontSize: `${fontSize}px`,
            fontStyle:
              projectile.kind === "review" || projectile.kind === "bug"
                ? "820"
                : "720",
            stroke: TEXT_COLORS.surface,
            strokeThickness: fontSize >= 19 ? 6 : 4,
          })
          .setOrigin(0.5)
          .setDepth(6);
        this.projectileLabels.set(projectile.id, label);
      }

      label
        .setText(projectile.label)
        .setPosition(
          Math.round(projectile.position.x),
          Math.round(projectile.position.y),
        )
        .setRotation(this.readableProjectileRotation(projectile.velocity))
        .setColor(TEXT_COLORS.ink)
        .setAlpha(projectile.telegraphRemainingMs > 0 ? 0.52 : 1)
        .setScale(projectile.telegraphRemainingMs > 0 ? 0.94 : 1)
        .setVisible(true);
    }

    this.removeInactiveText(this.projectileLabels, activeIds);
  }

  private syncHazardLabels(state: GameState): void {
    const activeIds = new Set<number>();

    for (const hazard of state.hazards) {
      activeIds.add(hazard.id);
      let label = this.hazardLabels.get(hazard.id);
      if (!label) {
        label = this.scene.add
          .text(0, 0, "", {
            color: TEXT_COLORS.ink,
            fontFamily: FONTS.sans,
            fontSize: "18px",
            fontStyle: "800",
          })
          .setOrigin(0.5)
          .setDepth(3);
        this.hazardLabels.set(hazard.id, label);
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
        ? "CONTEXT // MAX"
        : `CONTEXT // ${Math.round(progress * 100)}%`;

      label
        .setText(text)
        .setPosition(Math.round(hazard.position.x), Math.round(hazard.position.y))
        .setRotation(0)
        .setColor(active ? TEXT_COLORS.surface : TEXT_COLORS.ink)
        .setFontSize(22)
        .setAlpha(active ? 1 : 0.9)
        .setVisible(true);
    }

    this.removeInactiveText(this.hazardLabels, activeIds);
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
        let label = this.sequenceLabels.get(id);
        if (!label) {
          label = this.scene.add
            .text(0, 0, "", {
              color: TEXT_COLORS.ink,
              fontFamily: FONTS.sans,
              fontSize: sequence.kind === "fork-bomb" ? "18px" : "15px",
              fontStyle: "780",
              stroke: TEXT_COLORS.surface,
              strokeThickness: 5,
            })
            .setOrigin(0.5)
            .setDepth(5);
          this.sequenceLabels.set(id, label);
        }

        const position = {
          x: Phaser.Math.Linear(origin.x, sequence.position.x, progress),
          y: Phaser.Math.Linear(origin.y, sequence.position.y, progress),
        };
        label
          .setText(
            sequence.kind === "fork-bomb"
              ? sequence.label
              : `change +${index + 1}`,
          )
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
      let coreLabel = this.sequenceLabels.get(coreId);
      if (!coreLabel) {
        coreLabel = this.scene.add
          .text(0, 0, "", {
            color: TEXT_COLORS.ink,
            fontFamily: FONTS.sans,
            fontSize: "17px",
            fontStyle: "820",
            stroke: TEXT_COLORS.surface,
            strokeThickness: 5,
          })
          .setOrigin(0.5)
          .setDepth(5);
        this.sequenceLabels.set(coreId, coreLabel);
      }
      coreLabel
        .setText(
          sequence.kind === "fork-bomb"
            ? `FORK ${Math.round(progress * 100)}%`
            : `git merge // ${Math.round(progress * 100)}%`,
        )
        .setPosition(sequence.position.x, sequence.position.y + 34)
        .setVisible(true);
    }

    this.removeInactiveText(this.sequenceLabels, activeIds);
  }

  private projectileFontSize(projectile: ProjectileState): number {
    if (projectile.kind === "review") {
      return 20;
    }
    if (projectile.kind === "retry" || projectile.kind === "race") {
      return 18;
    }
    if (projectile.kind === "bug") {
      return 17;
    }
    if (projectile.kind === "branch") {
      return 14;
    }
    return 16;
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

    this.world.lineStyle(
      projectile.kind === "review" ||
        projectile.kind === "race" ||
        projectile.kind === "bug"
        ? 3
        : 2,
      COLORS.black,
      alpha,
    );
    this.world.lineBetween(
      tailOrigin.x,
      tailOrigin.y,
      tailOrigin.x - projectile.velocity.x * length,
      tailOrigin.y - projectile.velocity.y * length,
    );

    const endX = tailOrigin.x - projectile.velocity.x * length;
    const endY = tailOrigin.y - projectile.velocity.y * length;
    this.world.fillStyle(COLORS.black, alpha);
    this.world.fillRect(Math.round(endX) - 2, Math.round(endY) - 2, 4, 4);
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
        Math.round(origin.x + direction.x * distance) - 1,
        Math.round(origin.y + direction.y * distance) - 1,
        3,
        3,
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
    this.world.lineStyle(3, color, alpha);
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

  private removeInactiveText(
    map: Map<number, Phaser.GameObjects.Text>,
    activeIds: ReadonlySet<number>,
  ): void {
    for (const [id, text] of map) {
      if (!activeIds.has(id)) {
        text.destroy();
        map.delete(id);
      }
    }
  }

  private destroyTextMap(map: Map<number, Phaser.GameObjects.Text>): void {
    for (const text of map.values()) {
      text.destroy();
    }
    map.clear();
  }
}
