import Phaser from "phaser";

import { GAMEPLAY } from "../constants";
import type {
  AreaHazardState,
  GameEvent,
  GameState,
  ProjectileState,
  Vec2,
} from "../core/model";
import { COLORS } from "./theme";

interface ParticleEffect extends Vec2 {
  velocity: Vec2;
  ageMs: number;
  durationMs: number;
  color: number;
  size: number;
}

export class GameRenderer {
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly particles: ParticleEffect[] = [];
  private readonly projectileTrails = new Map<number, Vec2[]>();
  private hitFlashMs = 0;

  constructor(scene: Phaser.Scene) {
    this.background = scene.add.graphics().setDepth(-10);
    this.graphics = scene.add.graphics().setDepth(0);
  }

  consume(events: readonly GameEvent[], state: GameState): void {
    for (const event of events) {
      if (event.type === "hazard-activated") {
        this.addBurst(
          state.player.position,
          event.kind === "memory-leak" ? COLORS.memory : COLORS.context,
          10,
          state.elapsedMs,
        );
      } else if (event.type === "player-hit") {
        this.hitFlashMs = 280;
        this.addBurst(state.player.position, COLORS.danger, 24, state.elapsedMs);
      }
    }
  }

  render(state: GameState, frameDeltaMs: number): void {
    this.advanceEffects(frameDeltaMs);
    this.updateProjectileTrails(state);
    this.drawBackground(state);
    this.graphics.clear();
    this.drawHazards(state);
    this.drawProjectileTrails(state);
    this.drawProjectiles(state);
    this.drawPlayer(state);
    this.drawEffects();

    if (this.hitFlashMs > 0) {
      this.graphics.fillStyle(COLORS.danger, 0.1 * (this.hitFlashMs / 280));
      this.graphics.fillRect(0, 0, state.arena.width, state.arena.height);
    }
  }

  resetEffects(): void {
    this.particles.length = 0;
    this.projectileTrails.clear();
    this.hitFlashMs = 0;
  }

  private drawBackground(state: GameState): void {
    this.background.clear();
    this.background.fillStyle(COLORS.background, 1);
    this.background.fillRect(0, 0, state.arena.width, state.arena.height);
  }

  private drawHazards(state: GameState): void {
    for (const hazard of state.hazards) {
      if (hazard.kind === "memory-leak") {
        this.drawMemoryLeak(hazard, state.elapsedMs);
      } else {
        this.drawContextSweep(hazard, state);
      }
    }
  }

  private drawMemoryLeak(hazard: AreaHazardState, elapsedMs: number): void {
    const active = hazard.phase === "active";
    const warningProgress = active
      ? 1
      : 1 - hazard.remainingMs / GAMEPLAY.memoryLeakTelegraphMs;
    const pulse = 0.55 + Math.sin(elapsedMs / 65) * 0.18;
    const color = COLORS.memory;

    if (active) {
      this.graphics.fillStyle(COLORS.memory, 0.12);
      this.graphics.fillCircle(hazard.position.x, hazard.position.y, hazard.radius);
      this.graphics.fillStyle(COLORS.memory, 0.045);
      this.graphics.fillCircle(
        hazard.position.x,
        hazard.position.y,
        hazard.radius * 1.12,
      );
    }

    this.drawPixelRing(
      hazard.position,
      hazard.radius,
      color,
      active ? 1 : pulse,
      active ? 3 : 2,
      elapsedMs / 700,
    );
    this.drawPixelRing(
      hazard.position,
      hazard.radius * (0.7 + warningProgress * 0.16),
      color,
      active ? 0.55 : 0.28 + warningProgress * 0.35,
      1,
      -elapsedMs / 950,
    );

    const orbitRadius = hazard.radius + 8;
    for (let index = 0; index < 8; index += 1) {
      const angle = elapsedMs / 620 + (Math.PI * 2 * index) / 8 + hazard.id;
      const size = index % 3 === 0 ? 4 : 2;
      this.graphics.fillStyle(color, active ? 0.75 : 0.34);
      this.graphics.fillRect(
        hazard.position.x + Math.cos(angle) * orbitRadius - size / 2,
        hazard.position.y + Math.sin(angle) * orbitRadius - size / 2,
        size,
        size,
      );
    }
  }

  private drawPixelRing(
    center: Vec2,
    radius: number,
    color: number,
    alpha: number,
    width: number,
    rotation: number,
  ): void {
    const segments = Math.max(24, Math.round(radius / 2.5));
    const size = Math.max(2, Math.round(width + 1));
    this.graphics.fillStyle(color, alpha);

    for (let index = 0; index < segments; index += 2) {
      const angle = rotation + (Math.PI * 2 * index) / segments;
      const x = Math.round(center.x + Math.cos(angle) * radius);
      const y = Math.round(center.y + Math.sin(angle) * radius);
      this.graphics.fillRect(x - size / 2, y - size / 2, size, size);
    }
  }

  private drawContextSweep(hazard: AreaHazardState, state: GameState): void {
    const active = hazard.phase === "active";
    const pulse = 0.45 + Math.sin(state.elapsedMs / 75) * 0.18;
    const x =
      hazard.axis === "horizontal"
        ? 0
        : hazard.position.x - hazard.thickness / 2;
    const y =
      hazard.axis === "horizontal"
        ? hazard.position.y - hazard.thickness / 2
        : 0;
    const width =
      hazard.axis === "horizontal" ? state.arena.width : hazard.thickness;
    const height =
      hazard.axis === "horizontal" ? hazard.thickness : state.arena.height;

    this.graphics.fillStyle(
      active ? COLORS.context : COLORS.text,
      active ? 0.09 : 0.018,
    );
    this.graphics.fillRect(x, y, width, height);
    this.drawScanStripes(x, y, width, height, active ? 0.22 : 0.09);

    this.graphics.lineStyle(
      active ? 3 : 1,
      COLORS.context,
      active ? 0.95 : pulse,
    );
    if (hazard.axis === "horizontal") {
      this.graphics.lineBetween(x, y, x + width, y);
      this.graphics.lineBetween(x, y + height, x + width, y + height);
      const scanX = ((state.elapsedMs / 2.4) % (width + 120)) - 60;
      this.graphics.lineStyle(2, COLORS.context, active ? 0.62 : 0.22);
      this.graphics.lineBetween(scanX, y, scanX + height, y + height);
    } else {
      this.graphics.lineBetween(x, y, x, y + height);
      this.graphics.lineBetween(x + width, y, x + width, y + height);
      const scanY = ((state.elapsedMs / 2.4) % (height + 120)) - 60;
      this.graphics.lineStyle(2, COLORS.context, active ? 0.62 : 0.22);
      this.graphics.lineBetween(x, scanY, x + width, scanY + width);
    }
  }

  private drawScanStripes(
    x: number,
    y: number,
    width: number,
    height: number,
    alpha: number,
  ): void {
    this.graphics.lineStyle(1, COLORS.context, alpha);
    for (let diagonal = 0; diagonal <= width + height; diagonal += 24) {
      const startX = Math.max(0, diagonal - height);
      const endX = Math.min(width, diagonal);
      this.graphics.lineBetween(
        x + startX,
        y + diagonal - startX,
        x + endX,
        y + diagonal - endX,
      );
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
        if (projectile.kind === "tab") {
          this.drawTabShape(point, projectile.velocity, alpha);
        } else {
          this.graphics.lineStyle(1, COLORS.popup, alpha);
          this.graphics.strokeRect(point.x - 27, point.y - 18, 54, 36);
        }
      }
    }
  }

  private drawProjectiles(state: GameState): void {
    for (const projectile of state.projectiles) {
      if (projectile.kind === "popup") {
        this.drawPopup(projectile, state);
      } else {
        this.drawTab(projectile, state);
      }
    }
  }

  private drawPlayer(state: GameState): void {
    const x = Math.round(state.player.position.x);
    const y = Math.round(state.player.position.y);
    const points = [
      { x, y },
      { x, y: y + 22 },
      { x: x + 6, y: y + 17 },
      { x: x + 11, y: y + 28 },
      { x: x + 15, y: y + 26 },
      { x: x + 10, y: y + 16 },
      { x: x + 20, y: y + 16 },
    ];

    this.graphics.fillStyle(COLORS.text, 1);
    this.graphics.lineStyle(2, COLORS.surface, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(points[0]!.x, points[0]!.y);
    for (let index = 1; index < points.length; index += 1) {
      this.graphics.lineTo(points[index]!.x, points[index]!.y);
    }
    this.graphics.closePath();
    this.graphics.fillPath();
    this.graphics.strokePath();
  }

  private drawTab(projectile: ProjectileState, state: GameState): void {
    if (projectile.telegraphRemainingMs > 0) {
      const alpha =
        0.18 +
        0.3 *
          (1 - projectile.telegraphRemainingMs / GAMEPLAY.tabTelegraphMs);
      this.drawDottedRay(
        projectile.position,
        projectile.velocity,
        Math.hypot(state.arena.width, state.arena.height),
        COLORS.tab,
        alpha,
        34,
      );
    }

    this.drawTabShape(
      projectile.position,
      projectile.velocity,
      projectile.telegraphRemainingMs > 0 ? 0.55 : 0.96,
    );
  }

  private drawTabShape(position: Vec2, velocity: Vec2, alpha: number): void {
    const points = [
      this.orientedPoint(position, velocity, -19, 8),
      this.orientedPoint(position, velocity, -16, -8),
      this.orientedPoint(position, velocity, 7, -8),
      this.orientedPoint(position, velocity, 11, -4),
      this.orientedPoint(position, velocity, 19, -4),
      this.orientedPoint(position, velocity, 19, 8),
    ];

    this.graphics.fillStyle(COLORS.surface, Math.min(1, alpha + 0.1));
    this.graphics.lineStyle(1.5, COLORS.tab, alpha);
    this.graphics.beginPath();
    this.graphics.moveTo(points[0]!.x, points[0]!.y);
    for (let index = 1; index < points.length; index += 1) {
      this.graphics.lineTo(points[index]!.x, points[index]!.y);
    }
    this.graphics.closePath();
    this.graphics.fillPath();
    this.graphics.strokePath();

    const favicon = this.orientedPoint(position, velocity, -10, 0);
    this.graphics.fillStyle(COLORS.success, alpha * 0.95);
    this.graphics.fillRect(Math.round(favicon.x) - 2, Math.round(favicon.y) - 2, 4, 4);
    const closeA = this.orientedPoint(position, velocity, 11, -0.5);
    const closeB = this.orientedPoint(position, velocity, 15, 3.5);
    const closeC = this.orientedPoint(position, velocity, 15, -0.5);
    const closeD = this.orientedPoint(position, velocity, 11, 3.5);
    this.graphics.lineStyle(1, COLORS.muted, alpha * 0.85);
    this.graphics.lineBetween(closeA.x, closeA.y, closeB.x, closeB.y);
    this.graphics.lineBetween(closeC.x, closeC.y, closeD.x, closeD.y);
  }

  private drawPopup(projectile: ProjectileState, state: GameState): void {
    const telegraphing = projectile.telegraphRemainingMs > 0;
    const pulse = 0.45 + Math.sin(state.elapsedMs / 60) * 0.22;
    const { position, velocity } = projectile;

    if (telegraphing) {
      this.drawDottedRay(
        position,
        velocity,
        Math.hypot(state.arena.width, state.arena.height) * 1.25,
        COLORS.popup,
        pulse,
        24,
      );
      const destination = {
        x: position.x + velocity.x * 110,
        y: position.y + velocity.y * 110,
      };
      this.drawPixelRing(destination, 13, COLORS.popup, pulse, 1, 0);
    }

    this.graphics.fillStyle(COLORS.shadow, telegraphing ? 0.06 : 0.13);
    this.graphics.fillRect(position.x - 21, position.y - 12, 54, 38);
    this.graphics.fillStyle(COLORS.surface, 1);
    this.graphics.fillRect(position.x - 27, position.y - 18, 54, 36);
    this.graphics.lineStyle(
      telegraphing ? 2 : 1.5,
      COLORS.popup,
      telegraphing ? pulse + 0.25 : 0.95,
    );
    this.graphics.strokeRect(position.x - 27, position.y - 18, 54, 36);
    this.graphics.fillStyle(COLORS.popup, 0.1);
    this.graphics.fillRect(position.x - 26, position.y - 17, 52, 10);
    this.graphics.lineStyle(1, COLORS.popup, 0.55);
    this.graphics.lineBetween(position.x - 26, position.y - 7, position.x + 26, position.y - 7);
    this.graphics.fillStyle(COLORS.danger, 0.9);
    this.graphics.fillRect(position.x - 21, position.y - 14, 4, 4);
    this.graphics.fillStyle(COLORS.text, 0.72);
    this.graphics.fillRect(position.x - 20, position.y - 1, 28, 3);
    this.graphics.fillStyle(COLORS.popup, 0.72);
    this.graphics.fillRect(position.x - 20, position.y + 7, 18, 3);
    this.graphics.lineStyle(1.5, COLORS.text, 0.8);
    this.graphics.lineBetween(position.x + 15, position.y - 14, position.x + 20, position.y - 9);
    this.graphics.lineBetween(position.x + 20, position.y - 14, position.x + 15, position.y - 9);
  }

  private drawDottedRay(
    origin: Vec2,
    direction: Vec2,
    length: number,
    color: number,
    alpha: number,
    spacing: number,
  ): void {
    this.graphics.fillStyle(color, alpha);
    for (let distance = 12; distance < length; distance += spacing) {
      this.graphics.fillCircle(
        origin.x + direction.x * distance,
        origin.y + direction.y * distance,
        1.25,
      );
    }
  }

  private orientedPoint(
    origin: Vec2,
    direction: Vec2,
    forward: number,
    sideways: number,
  ): Vec2 {
    return {
      x: origin.x + direction.x * forward - direction.y * sideways,
      y: origin.y + direction.y * forward + direction.x * sideways,
    };
  }

  private drawEffects(): void {
    for (const particle of this.particles) {
      const alpha = 1 - particle.ageMs / particle.durationMs;
      const size = particle.size * alpha;
      this.graphics.fillStyle(particle.color, alpha);
      this.graphics.fillRect(
        particle.x - size / 2,
        particle.y - size / 2,
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
        ) >= 10
      ) {
        trail.push({ ...projectile.position });
        if (trail.length > 4) {
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

  private addBurst(
    position: Vec2,
    color: number,
    count: number,
    phase: number,
  ): void {
    for (let index = 0; index < count; index += 1) {
      const angle = phase + (Math.PI * 2 * index) / count;
      const speed = 90 + (index % 4) * 26;
      this.particles.push({
        ...position,
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        ageMs: 0,
        durationMs: 300 + (index % 3) * 45,
        color,
        size: 4 + (index % 2),
      });
    }
  }
}
