import Phaser from "phaser";

import { ARENA, GAME_HEIGHT, GAME_WIDTH } from "../constants";
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
  private hitFlashMs = 0;

  constructor(scene: Phaser.Scene) {
    this.background = scene.add.graphics().setDepth(-10);
    this.graphics = scene.add.graphics().setDepth(0);
    this.drawBackground();
  }

  consume(events: readonly GameEvent[], state: GameState): void {
    for (const event of events) {
      if (event.type === "hazard-activated") {
        this.addBurst(state.player.position, COLORS.muted, 5, state.elapsedMs);
      } else if (event.type === "player-hit") {
        this.hitFlashMs = 260;
        this.addBurst(state.player.position, COLORS.danger, 20, state.elapsedMs);
      }
    }
  }

  render(state: GameState, frameDeltaMs: number): void {
    this.advanceEffects(frameDeltaMs);
    this.graphics.clear();
    this.drawHazards(state);
    this.drawProjectiles(state);
    this.drawPlayer(state);
    this.drawEffects();

    if (this.hitFlashMs > 0) {
      this.graphics.fillStyle(COLORS.danger, 0.08 * (this.hitFlashMs / 260));
      this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  }

  resetEffects(): void {
    this.particles.length = 0;
    this.hitFlashMs = 0;
  }

  private drawBackground(): void {
    this.background.fillStyle(COLORS.background, 1);
    this.background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.background.lineStyle(1, COLORS.border, 0.8);
    this.background.lineBetween(
      ARENA.left,
      ARENA.bottom,
      ARENA.right,
      ARENA.bottom,
    );
  }

  private drawHazards(state: GameState): void {
    for (const hazard of state.hazards) {
      if (hazard.kind === "memory-leak") {
        this.drawMemoryLeak(hazard, state.elapsedMs);
      } else {
        this.drawContextSweep(hazard, state.elapsedMs);
      }
    }
  }

  private drawMemoryLeak(hazard: AreaHazardState, elapsedMs: number): void {
    const pulse = 0.68 + Math.sin(elapsedMs / 80) * 0.18;
    const active = hazard.phase === "active";
    const color = active ? COLORS.danger : COLORS.muted;

    if (active) {
      this.graphics.fillStyle(COLORS.danger, 0.08);
      this.graphics.fillCircle(hazard.position.x, hazard.position.y, hazard.radius);
    }

    this.graphics.lineStyle(active ? 3 : 2, color, active ? 0.95 : pulse);
    this.graphics.strokeCircle(hazard.position.x, hazard.position.y, hazard.radius);
    this.graphics.lineStyle(1, color, active ? 0.55 : 0.35);
    this.graphics.strokeCircle(
      hazard.position.x,
      hazard.position.y,
      Math.max(12, hazard.radius - 12),
    );
  }

  private drawContextSweep(hazard: AreaHazardState, elapsedMs: number): void {
    const active = hazard.phase === "active";
    const pulse = 0.5 + Math.sin(elapsedMs / 70) * 0.2;
    const x =
      hazard.axis === "horizontal"
        ? ARENA.left
        : hazard.position.x - hazard.thickness / 2;
    const y =
      hazard.axis === "horizontal"
        ? hazard.position.y - hazard.thickness / 2
        : ARENA.top;
    const width =
      hazard.axis === "horizontal"
        ? ARENA.right - ARENA.left
        : hazard.thickness;
    const height =
      hazard.axis === "horizontal"
        ? hazard.thickness
        : ARENA.bottom - ARENA.top;

    if (active) {
      this.graphics.fillStyle(COLORS.danger, 0.08);
      this.graphics.fillRect(x, y, width, height);
    }
    this.graphics.lineStyle(active ? 3 : 2, COLORS.danger, active ? 0.95 : pulse);
    this.graphics.strokeRect(x, y, width, height);
  }

  private drawProjectiles(state: GameState): void {
    for (const projectile of state.projectiles) {
      if (projectile.kind === "popup") {
        this.drawPopup(projectile, state.elapsedMs);
      } else {
        this.drawTab(projectile);
      }
    }
  }

  private drawTab(projectile: ProjectileState): void {
    const { position, velocity } = projectile;
    const perpendicular = { x: -velocity.y, y: velocity.x };
    const tail = {
      x: position.x - velocity.x * 32,
      y: position.y - velocity.y * 32,
    };
    const wing = 7;

    this.graphics.lineStyle(2, COLORS.text, 0.88);
    this.graphics.lineBetween(tail.x, tail.y, position.x, position.y);
    this.graphics.lineBetween(
      position.x,
      position.y,
      position.x - velocity.x * 11 + perpendicular.x * wing,
      position.y - velocity.y * 11 + perpendicular.y * wing,
    );
    this.graphics.lineBetween(
      position.x,
      position.y,
      position.x - velocity.x * 11 - perpendicular.x * wing,
      position.y - velocity.y * 11 - perpendicular.y * wing,
    );
    this.graphics.fillStyle(COLORS.text, 1);
    this.graphics.fillCircle(position.x, position.y, 2.5);
  }

  private drawPopup(projectile: ProjectileState, elapsedMs: number): void {
    const telegraphing = projectile.telegraphRemainingMs > 0;
    const pulse = 0.55 + Math.sin(elapsedMs / 65) * 0.25;
    const { position, velocity } = projectile;

    if (telegraphing) {
      this.graphics.lineStyle(1, COLORS.danger, pulse);
      this.graphics.lineBetween(
        position.x,
        position.y,
        position.x + velocity.x * 900,
        position.y + velocity.y * 900,
      );
    }

    this.graphics.fillStyle(COLORS.background, 1);
    this.graphics.fillRoundedRect(position.x - 16, position.y - 11, 32, 22, 3);
    this.graphics.lineStyle(
      2,
      telegraphing ? COLORS.danger : COLORS.text,
      telegraphing ? pulse : 0.95,
    );
    this.graphics.strokeRoundedRect(position.x - 16, position.y - 11, 32, 22, 3);
    this.graphics.lineStyle(1, COLORS.muted, 0.8);
    this.graphics.lineBetween(position.x - 15, position.y - 4, position.x + 15, position.y - 4);
    this.graphics.fillStyle(COLORS.danger, 0.9);
    this.graphics.fillRect(position.x + 8, position.y - 9, 4, 2);
  }

  private drawPlayer(state: GameState): void {
    const { position, direction } = state.player;
    const perpendicular = { x: -direction.y, y: direction.x };
    const tip = {
      x: position.x + direction.x * 18,
      y: position.y + direction.y * 18,
    };
    const back = {
      x: position.x - direction.x * 11,
      y: position.y - direction.y * 11,
    };

    this.graphics.fillStyle(COLORS.background, 1);
    this.graphics.fillCircle(position.x, position.y, 13);
    this.graphics.fillStyle(COLORS.text, 1);
    this.graphics.fillTriangle(
      tip.x,
      tip.y,
      back.x + perpendicular.x * 9,
      back.y + perpendicular.y * 9,
      back.x - perpendicular.x * 9,
      back.y - perpendicular.y * 9,
    );
    this.graphics.fillStyle(COLORS.background, 1);
    this.graphics.fillCircle(position.x, position.y, 4);
    this.graphics.fillStyle(COLORS.cyan, 1);
    this.graphics.fillCircle(position.x, position.y, 2);
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
      const speed = 80 + (index % 4) * 24;
      this.particles.push({
        ...position,
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        ageMs: 0,
        durationMs: 280 + (index % 3) * 40,
        color,
        size: 4 + (index % 2),
      });
    }
  }
}
