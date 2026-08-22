import Phaser from "phaser";

import { ARENA, GAME_HEIGHT, GAME_WIDTH, GAMEPLAY } from "../constants";
import type { EnemyState, GameEvent, GameState, Vec2 } from "../core/model";
import { contextRatio } from "../core/rules";

interface RingEffect extends Vec2 {
  ageMs: number;
  durationMs: number;
  maximumRadius: number;
  color: number;
}

interface ParticleEffect extends Vec2 {
  velocity: Vec2;
  ageMs: number;
  durationMs: number;
  color: number;
  radius: number;
}

const COLORS = {
  background: 0x070a0f,
  grid: 0x17212d,
  border: 0x2a3c4d,
  mint: 0x68f7c1,
  cyan: 0x52c7ff,
  amber: 0xffc857,
  danger: 0xff4f87,
  text: 0xf2f4f8,
  muted: 0x617286,
  leak: 0xa978ff,
} as const;

export class GameRenderer {
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly rings: RingEffect[] = [];
  private readonly particles: ParticleEffect[] = [];
  private hitFlashMs = 0;

  constructor(scene: Phaser.Scene) {
    this.background = scene.add.graphics().setDepth(-10);
    this.graphics = scene.add.graphics().setDepth(0);
    this.drawBackground();
  }

  consume(events: readonly GameEvent[], state: GameState): void {
    for (const event of events) {
      if (event.type === "token-collected") {
        this.addBurst(
          state.player.position,
          COLORS.mint,
          3,
          event.tokenId * 0.73,
        );
      } else if (event.type === "compacted") {
        this.rings.push({
          ...state.player.position,
          ageMs: 0,
          durationMs: 420,
          maximumRadius: event.radius,
          color: COLORS.mint,
        });
        this.addBurst(state.player.position, COLORS.cyan, 14, state.elapsedMs);
      } else if (event.type === "player-hit") {
        this.hitFlashMs = 260;
        this.addBurst(state.player.position, COLORS.danger, 18, state.elapsedMs);
      } else if (event.type === "overflow-started") {
        this.rings.push({
          ...state.player.position,
          ageMs: 0,
          durationMs: GAMEPLAY.overflowGraceMs,
          maximumRadius: 54,
          color: COLORS.danger,
        });
      }
    }
  }

  render(state: GameState, frameDeltaMs: number): void {
    this.advanceEffects(frameDeltaMs);
    this.graphics.clear();
    this.drawTrail(state);
    this.drawTokens(state);
    this.drawEnemies(state);
    this.drawPlayer(state);
    this.drawEffects();

    if (this.hitFlashMs > 0) {
      this.graphics.fillStyle(COLORS.danger, 0.12 * (this.hitFlashMs / 260));
      this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  }

  resetEffects(): void {
    this.rings.length = 0;
    this.particles.length = 0;
    this.hitFlashMs = 0;
  }

  private drawBackground(): void {
    this.background.fillStyle(COLORS.background, 1);
    this.background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.background.lineStyle(1, COLORS.grid, 0.42);

    for (let x = 0; x <= GAME_WIDTH; x += 40) {
      this.background.lineBetween(x, 80, x, GAME_HEIGHT);
    }

    for (let y = 80; y <= GAME_HEIGHT; y += 40) {
      this.background.lineBetween(0, y, GAME_WIDTH, y);
    }

    this.background.lineStyle(2, COLORS.border, 0.85);
    this.background.strokeRect(
      ARENA.left,
      ARENA.top,
      ARENA.right - ARENA.left,
      ARENA.bottom - ARENA.top,
    );
  }

  private drawTrail(state: GameState): void {
    const dangerousPoints = Math.max(
      0,
      state.trail.length - GAMEPLAY.baseTrailPoints,
    );
    const pressure = contextRatio(state.pendingTokens);

    state.trail.forEach((point, index) => {
      const progress = (index + 1) / state.trail.length;
      const dangerous = index < dangerousPoints;
      const color = dangerous
        ? pressure >= 0.75
          ? COLORS.danger
          : COLORS.cyan
        : COLORS.muted;
      this.graphics.fillStyle(color, 0.2 + progress * 0.62);
      this.graphics.fillCircle(point.x, point.y, 3 + progress * 4);
    });
  }

  private drawTokens(state: GameState): void {
    for (const token of state.tokens) {
      const pulse = 1 + Math.sin(state.elapsedMs / 150 + token.id) * 0.12;
      const radius = token.radius * pulse;
      this.graphics.fillStyle(COLORS.mint, 0.14);
      this.graphics.fillCircle(token.position.x, token.position.y, radius + 6);
      this.graphics.fillStyle(COLORS.mint, 0.95);
      this.graphics.fillPoints(
        [
          { x: token.position.x, y: token.position.y - radius },
          { x: token.position.x + radius, y: token.position.y },
          { x: token.position.x, y: token.position.y + radius },
          { x: token.position.x - radius, y: token.position.y },
        ],
        true,
      );
      this.graphics.fillStyle(COLORS.background, 0.85);
      this.graphics.fillRect(token.position.x - 1, token.position.y - 4, 2, 8);
    }
  }

  private drawEnemies(state: GameState): void {
    for (const enemy of state.enemies) {
      if (enemy.kind === "tab") {
        this.drawTab(enemy);
      } else if (enemy.kind === "leak") {
        this.drawLeak(enemy);
      } else {
        this.drawNotification(enemy, state.elapsedMs);
      }
    }
  }

  private drawTab(enemy: EnemyState): void {
    this.graphics.fillStyle(COLORS.amber, 0.14);
    this.graphics.fillRoundedRect(
      enemy.position.x - 17,
      enemy.position.y - 13,
      34,
      26,
      5,
    );
    this.graphics.lineStyle(2, COLORS.amber, 0.9);
    this.graphics.strokeRoundedRect(
      enemy.position.x - 13,
      enemy.position.y - 9,
      26,
      18,
      4,
    );
    this.graphics.lineBetween(
      enemy.position.x - 8,
      enemy.position.y - 3,
      enemy.position.x + 8,
      enemy.position.y - 3,
    );
  }

  private drawLeak(enemy: EnemyState): void {
    const splitProgress = 1 - enemy.behaviorMs / GAMEPLAY.leakSplitMs;
    this.graphics.fillStyle(COLORS.leak, 0.18);
    this.graphics.fillCircle(enemy.position.x, enemy.position.y, 27);
    this.graphics.fillStyle(COLORS.leak, 0.92);
    this.graphics.fillCircle(enemy.position.x, enemy.position.y, enemy.radius);
    this.graphics.fillStyle(COLORS.background, 0.75);
    this.graphics.fillCircle(enemy.position.x - 6, enemy.position.y - 3, 3);
    this.graphics.fillCircle(enemy.position.x + 6, enemy.position.y - 3, 3);
    this.graphics.lineStyle(3, COLORS.danger, 0.85);
    this.graphics.beginPath();
    this.graphics.arc(
      enemy.position.x,
      enemy.position.y,
      25,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * splitProgress,
    );
    this.graphics.strokePath();
  }

  private drawNotification(enemy: EnemyState, elapsedMs: number): void {
    const telegraph = enemy.notificationMode === "telegraph";
    const color = telegraph ? COLORS.danger : COLORS.text;
    const pulse = 0.55 + Math.sin(elapsedMs / 70) * 0.25;

    if (telegraph) {
      this.graphics.lineStyle(2, COLORS.danger, pulse);
      this.graphics.lineBetween(
        enemy.position.x,
        enemy.position.y,
        enemy.position.x + enemy.velocity.x * 170,
        enemy.position.y + enemy.velocity.y * 170,
      );
    }

    this.graphics.fillStyle(color, telegraph ? pulse : 0.9);
    this.graphics.fillPoints(
      [
        { x: enemy.position.x, y: enemy.position.y - 18 },
        { x: enemy.position.x + 16, y: enemy.position.y },
        { x: enemy.position.x, y: enemy.position.y + 18 },
        { x: enemy.position.x - 16, y: enemy.position.y },
      ],
      true,
    );
    this.graphics.fillStyle(COLORS.background, 1);
    this.graphics.fillRect(enemy.position.x - 2, enemy.position.y - 9, 4, 11);
    this.graphics.fillCircle(enemy.position.x, enemy.position.y + 7, 2.5);
  }

  private drawPlayer(state: GameState): void {
    const blink =
      state.player.invulnerableMs > 0 &&
      Math.floor(state.player.invulnerableMs / 80) % 2 === 0;

    if (blink) {
      return;
    }

    const { position, direction } = state.player;
    const perpendicular = { x: -direction.y, y: direction.x };
    const tip = {
      x: position.x + direction.x * 22,
      y: position.y + direction.y * 22,
    };
    const back = {
      x: position.x - direction.x * 13,
      y: position.y - direction.y * 13,
    };

    this.graphics.fillStyle(COLORS.cyan, 0.18);
    this.graphics.fillCircle(position.x, position.y, 24);
    this.graphics.fillStyle(COLORS.text, 1);
    this.graphics.fillTriangle(
      tip.x,
      tip.y,
      back.x + perpendicular.x * 11,
      back.y + perpendicular.y * 11,
      back.x - perpendicular.x * 11,
      back.y - perpendicular.y * 11,
    );
    this.graphics.fillStyle(COLORS.cyan, 1);
    this.graphics.fillCircle(position.x, position.y, 5);
  }

  private drawEffects(): void {
    for (const ring of this.rings) {
      const progress = Math.min(1, ring.ageMs / ring.durationMs);
      const radius = ring.maximumRadius * (1 - (1 - progress) ** 3);
      this.graphics.lineStyle(4 - progress * 2, ring.color, 1 - progress);
      this.graphics.strokeCircle(ring.x, ring.y, radius);
    }

    for (const particle of this.particles) {
      const alpha = 1 - particle.ageMs / particle.durationMs;
      this.graphics.fillStyle(particle.color, alpha);
      this.graphics.fillCircle(particle.x, particle.y, particle.radius * alpha);
    }
  }

  private advanceEffects(frameDeltaMs: number): void {
    const safeDelta = Math.min(50, Math.max(0, frameDeltaMs));
    this.hitFlashMs = Math.max(0, this.hitFlashMs - safeDelta);

    for (const ring of this.rings) {
      ring.ageMs += safeDelta;
    }

    for (const particle of this.particles) {
      particle.ageMs += safeDelta;
      particle.x += particle.velocity.x * (safeDelta / 1_000);
      particle.y += particle.velocity.y * (safeDelta / 1_000);
    }

    this.removeExpired(this.rings);
    this.removeExpired(this.particles);
  }

  private removeExpired<T extends { ageMs: number; durationMs: number }>(
    effects: T[],
  ): void {
    for (let index = effects.length - 1; index >= 0; index -= 1) {
      const effect = effects[index];

      if (effect && effect.ageMs >= effect.durationMs) {
        effects.splice(index, 1);
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
        radius: 4 + (index % 2),
      });
    }
  }
}
