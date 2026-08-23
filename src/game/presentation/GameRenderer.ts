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

export class GameRenderer {
  private readonly scene: Phaser.Scene;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly world: Phaser.GameObjects.Graphics;
  private readonly playerLayer: Phaser.GameObjects.Graphics;
  private readonly effectsLayer: Phaser.GameObjects.Graphics;
  private readonly projectileLabels = new Map<number, Phaser.GameObjects.Text>();
  private readonly hazardLabels = new Map<number, Phaser.GameObjects.Text>();
  private readonly particles: ParticleEffect[] = [];
  private readonly projectileTrails = new Map<number, Vec2[]>();
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
      } else if (event.type === "player-hit") {
        this.hitFlashMs = 180;
        this.addBurst(state.player.position, 22, state.elapsedMs);
      }
    }
  }

  render(state: GameState, frameDeltaMs: number): void {
    this.advanceEffects(frameDeltaMs);
    this.updateProjectileTrails(state);
    this.drawBackground(state);
    this.world.clear();
    this.playerLayer.clear();
    this.effectsLayer.clear();

    this.drawHazards(state);
    this.drawProjectileTrails(state);
    this.drawProjectiles(state);
    this.syncProjectileLabels(state);
    this.syncHazardLabels(state);
    this.drawPlayer(state);
    this.drawEffects();

    if (this.hitFlashMs > 0) {
      const strength = this.hitFlashMs / 180;
      this.effectsLayer.fillStyle(COLORS.black, 0.08 * strength);
      this.effectsLayer.fillRect(0, 0, state.arena.width, state.arena.height);
    }
  }

  resetEffects(): void {
    this.particles.length = 0;
    this.projectileTrails.clear();
    this.destroyTextMap(this.projectileLabels);
    this.destroyTextMap(this.hazardLabels);
    this.hitFlashMs = 0;
  }

  private drawBackground(state: GameState): void {
    this.background.clear();
    this.background.fillStyle(COLORS.background, 1);
    this.background.fillRect(0, 0, state.arena.width, state.arena.height);
  }

  private drawHazards(state: GameState): void {
    for (const hazard of state.hazards) {
      if (hazard.kind === "context-max") {
        this.drawContextMax(hazard);
      } else {
        this.drawMergeConflict(hazard);
      }
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

    this.world.fillStyle(active ? COLORS.black : COLORS.soft, active ? 0.96 : 0.72);
    this.world.fillRect(x, y, width, height);

    if (!active) {
      const fillHeight = Math.max(2, Math.round(height * progress));
      this.world.fillStyle(COLORS.black, 0.06 + progress * 0.1);
      this.world.fillRect(x, y + height - fillHeight, width, fillHeight);
      this.drawDashedRect(x, y, width, height, COLORS.ink, 0.72, 9, 6);

      const segments = 12;
      const segmentWidth = width / segments;
      for (let index = 0; index < segments; index += 1) {
        const filled = index / segments <= progress;
        this.world.fillStyle(COLORS.black, filled ? 0.72 : 0.14);
        this.world.fillRect(
          x + index * segmentWidth + 1,
          y + height - 4,
          Math.max(1, segmentWidth - 2),
          2,
        );
      }
      return;
    }

    this.world.lineStyle(2, COLORS.black, 1);
    this.world.strokeRect(x, y, width, height);
    this.drawHatchRect(x, y, width, height, 13, COLORS.surface, 0.2);
  }

  private drawMergeConflict(hazard: AreaHazardState): void {
    const { x, y, width, height } = this.hazardRect(hazard);
    const active = hazard.phase === "active";
    const warningProgress = active
      ? 1
      : Phaser.Math.Clamp(
          1 - hazard.remainingMs / GAMEPLAY.mergeConflictTelegraphMs,
          0,
          1,
        );

    this.world.fillStyle(active ? COLORS.black : COLORS.soft, active ? 0.94 : 0.58);
    this.world.fillRect(x, y, width, height);

    if (active) {
      this.world.lineStyle(2, COLORS.black, 1);
      this.world.strokeRect(x, y, width, height);
      this.drawHatchRect(x, y, width, height, 18, COLORS.surface, 0.18);
    } else {
      this.drawDashedRect(
        x,
        y,
        width,
        height,
        COLORS.ink,
        0.45 + warningProgress * 0.45,
        12,
        8,
      );
      this.drawConflictTicks(hazard, warningProgress);
    }
  }

  private drawConflictTicks(
    hazard: AreaHazardState,
    progress: number,
  ): void {
    const { x, y, width, height } = this.hazardRect(hazard);
    const color = COLORS.ink;
    this.world.lineStyle(1, color, 0.16 + progress * 0.28);

    if (hazard.axis === "horizontal") {
      for (let offset = 20; offset < width; offset += 46) {
        const centerX = x + offset;
        this.world.lineBetween(centerX - 6, y + 8, centerX, y + height / 2);
        this.world.lineBetween(centerX, y + height / 2, centerX + 6, y + height - 8);
      }
    } else {
      for (let offset = 20; offset < height; offset += 46) {
        const centerY = y + offset;
        this.world.lineBetween(x + 8, centerY - 6, x + width / 2, centerY);
        this.world.lineBetween(x + width / 2, centerY, x + width - 8, centerY + 6);
      }
    }
  }

  private drawProjectileTrails(state: GameState): void {
    for (const projectile of state.projectiles) {
      if (projectile.telegraphRemainingMs > 0) {
        continue;
      }

      const trail = this.projectileTrails.get(projectile.id) ?? [];
      for (let index = 0; index < trail.length; index += 1) {
        const point = trail[index];
        if (!point) {
          continue;
        }
        const alpha = ((index + 1) / (trail.length + 1)) * 0.12;
        const width = projectile.hitbox.width;
        const height = projectile.hitbox.height;
        this.world.lineStyle(1, COLORS.ink, alpha);
        this.world.strokeRect(
          Math.round(point.x - width / 2),
          Math.round(point.y - height / 2),
          width,
          height,
        );
      }
    }
  }

  private drawProjectiles(state: GameState): void {
    for (const projectile of state.projectiles) {
      if (projectile.kind === "review") {
        this.drawReview(projectile, state);
      } else {
        this.drawLog(projectile, state);
      }
    }
  }

  private drawLog(projectile: ProjectileState, state: GameState): void {
    const telegraphing = projectile.telegraphRemainingMs > 0;
    const x = Math.round(projectile.position.x - projectile.hitbox.width / 2);
    const y = Math.round(projectile.position.y - projectile.hitbox.height / 2);

    if (telegraphing) {
      const progress = 1 - projectile.telegraphRemainingMs / GAMEPLAY.logTelegraphMs;
      this.drawDottedRay(
        projectile.position,
        projectile.velocity,
        Math.hypot(state.arena.width, state.arena.height) * 1.2,
        COLORS.ink,
        0.18 + Math.max(0, progress) * 0.28,
        28,
      );
    }

    this.world.fillStyle(COLORS.surface, telegraphing ? 0.72 : 1);
    this.world.fillRect(x, y, projectile.hitbox.width, projectile.hitbox.height);
    this.world.lineStyle(1, COLORS.ink, telegraphing ? 0.48 : 0.92);
    this.world.strokeRect(x, y, projectile.hitbox.width, projectile.hitbox.height);
    this.world.fillStyle(COLORS.black, telegraphing ? 0.5 : 1);
    this.world.fillRect(x + 4, y + projectile.hitbox.height / 2 - 2, 4, 4);
  }

  private drawReview(projectile: ProjectileState, state: GameState): void {
    const telegraphing = projectile.telegraphRemainingMs > 0;
    const { width, height } = projectile.hitbox;
    const x = Math.round(projectile.position.x - width / 2);
    const y = Math.round(projectile.position.y - height / 2);

    if (telegraphing) {
      const progress = 1 - projectile.telegraphRemainingMs / GAMEPLAY.reviewTelegraphMs;
      this.drawDottedRay(
        projectile.position,
        projectile.velocity,
        Math.hypot(state.arena.width, state.arena.height) * 1.3,
        COLORS.black,
        0.24 + progress * 0.44,
        20,
      );
      this.drawDashedRect(x - 3, y - 3, width + 6, height + 6, COLORS.ink, 0.7, 7, 5);
    }

    this.world.fillStyle(telegraphing ? COLORS.surface : COLORS.black, 1);
    this.world.fillRect(x, y, width, height);
    this.world.lineStyle(telegraphing ? 1 : 2, COLORS.black, 1);
    this.world.strokeRect(x, y, width, height);

    const choiceY = y + height - 8;
    this.world.lineStyle(1, telegraphing ? COLORS.border : COLORS.surface, 0.78);
    this.world.strokeRect(x + 6, choiceY - 4, Math.max(18, width * 0.36), 6);
    this.world.strokeRect(
      x + width - Math.max(18, width * 0.26) - 6,
      choiceY - 4,
      Math.max(18, width * 0.26),
      6,
    );
  }

  private drawPlayer(state: GameState): void {
    const x = Math.round(state.player.position.x);
    const y = Math.round(state.player.position.y);

    this.playerLayer.fillStyle(COLORS.surface, 1);
    this.playerLayer.fillRect(x - 11, y - 8, 22, 16);
    this.playerLayer.fillStyle(COLORS.black, 1);
    this.playerLayer.fillRect(x - 10, y - 7, 20, 14);
    this.playerLayer.lineStyle(2, COLORS.surface, 1);
    this.playerLayer.lineBetween(x - 5, y - 4, x - 1, y);
    this.playerLayer.lineBetween(x - 1, y, x - 5, y + 4);
    this.playerLayer.lineBetween(x + 2, y + 4, x + 7, y + 4);
  }

  private syncProjectileLabels(state: GameState): void {
    const activeIds = new Set<number>();

    for (const projectile of state.projectiles) {
      activeIds.add(projectile.id);
      let label = this.projectileLabels.get(projectile.id);
      if (!label) {
        label = this.scene.add
          .text(0, 0, projectile.label, {
            color: TEXT_COLORS.ink,
            fontFamily: FONTS.sans,
            fontSize: projectile.kind === "review" ? "8px" : "8px",
            fontStyle: "650",
          })
          .setOrigin(0.5)
          .setDepth(6);
        this.projectileLabels.set(projectile.id, label);
      }

      const reviewActive =
        projectile.kind === "review" && projectile.telegraphRemainingMs <= 0;
      label
        .setText(projectile.label)
        .setPosition(
          Math.round(projectile.position.x + (projectile.kind === "log" ? 4 : 0)),
          Math.round(projectile.position.y + (projectile.kind === "review" ? -5 : 0)),
        )
        .setColor(reviewActive ? TEXT_COLORS.surface : TEXT_COLORS.ink)
        .setAlpha(projectile.telegraphRemainingMs > 0 ? 0.62 : 1)
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
            fontSize: "10px",
            fontStyle: "700",
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
      const text =
        hazard.kind === "context-max"
          ? active
            ? "SIM CONTEXT  MAX!"
            : `SIM CONTEXT  ${Math.round(progress * 100)}%`
          : active
            ? "<<<<<<<  MERGE CONFLICT  >>>>>>>"
            : "<<<<<<< YOU   =======   AGENT >>>>>>>";

      label
        .setText(text)
        .setPosition(Math.round(hazard.position.x), Math.round(hazard.position.y))
        .setRotation(
          hazard.kind === "merge-conflict" && hazard.axis === "vertical"
            ? -Math.PI / 2
            : 0,
        )
        .setColor(active ? TEXT_COLORS.surface : TEXT_COLORS.ink)
        .setAlpha(active ? 1 : 0.78)
        .setVisible(true);
    }

    this.removeInactiveText(this.hazardLabels, activeIds);
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
        2,
        2,
      );
    }
  }

  private drawDashedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    alpha: number,
    dash: number,
    gap: number,
  ): void {
    this.world.lineStyle(1, color, alpha);
    const step = dash + gap;
    for (let offset = 0; offset < width; offset += step) {
      const end = Math.min(width, offset + dash);
      this.world.lineBetween(x + offset, y, x + end, y);
      this.world.lineBetween(x + offset, y + height, x + end, y + height);
    }
    for (let offset = 0; offset < height; offset += step) {
      const end = Math.min(height, offset + dash);
      this.world.lineBetween(x, y + offset, x, y + end);
      this.world.lineBetween(x + width, y + offset, x + width, y + end);
    }
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

  private updateProjectileTrails(state: GameState): void {
    const activeIds = new Set<number>();

    for (const projectile of state.projectiles) {
      activeIds.add(projectile.id);
      if (projectile.telegraphRemainingMs > 0) {
        continue;
      }

      const trail = this.projectileTrails.get(projectile.id) ?? [];
      const last = trail.at(-1);
      if (
        !last ||
        Math.hypot(
          last.x - projectile.position.x,
          last.y - projectile.position.y,
        ) >= 16
      ) {
        trail.push({ ...projectile.position });
        if (trail.length > 3) {
          trail.shift();
        }
        this.projectileTrails.set(projectile.id, trail);
      }
    }

    for (const id of this.projectileTrails.keys()) {
      if (!activeIds.has(id)) {
        this.projectileTrails.delete(id);
      }
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
      const speed = 80 + (index % 4) * 24;
      this.particles.push({
        ...position,
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        ageMs: 0,
        durationMs: 260 + (index % 3) * 45,
        size: 3 + (index % 2),
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
