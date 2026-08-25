import {
  approvalGateDisplayPosition,
  approvalGateLabelPlacement,
  approvalGateLabelText,
  approvalGateSegments,
} from "../core/approvalGate";
import type {
  AttackSurface,
  GameState,
  ProjectileState,
  Vec2,
} from "../core/model";
import { attackTextColor, attackTextTokens } from "./attackText";
import { ATTACK_TONES, FONTS, TEXT_COLORS } from "./theme";

interface RichLabelStyle {
  surface: AttackSurface;
  label: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  alpha?: number;
}

export class GameOverHitLayer {
  private readonly context: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gameCanvas: HTMLCanvasElement,
  ) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Game over hit layer context was not found.");
    }
    this.context = context;
  }

  render(visible: boolean, state: GameState): void {
    this.syncSize();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!visible || !state.lastHitEntity) {
      return;
    }

    this.context.setTransform(
      this.canvas.width / state.arena.width,
      0,
      0,
      this.canvas.height / state.arena.height,
      0,
      0,
    );
    this.drawHitEntity(state);
    this.context.globalAlpha = 1;
    this.context.fillStyle = "#111111";
    this.context.fillRect(
      Math.round(state.player.position.x) - 6,
      Math.round(state.player.position.y) - 6,
      12,
      12,
    );
  }

  private syncSize(): void {
    if (
      this.canvas.width === this.gameCanvas.width &&
      this.canvas.height === this.gameCanvas.height
    ) {
      return;
    }
    this.canvas.width = this.gameCanvas.width;
    this.canvas.height = this.gameCanvas.height;
  }

  private drawHitEntity(state: GameState): void {
    const hit = state.lastHitEntity;
    if (!hit) {
      return;
    }

    if (hit.kind === "projectile") {
      const projectile = state.projectiles.find(({ id }) => id === hit.id);
      if (projectile) {
        this.drawProjectile(projectile);
      }
      return;
    }

    if (hit.kind === "download-access") {
      const hazard = state.hazards.find(({ id }) => id === hit.id);
      if (!hazard) {
        return;
      }
      const x = hazard.position.x - hazard.hitbox.width / 2;
      const y = hazard.position.y - hazard.hitbox.height / 2;
      const tone = ATTACK_TONES.downloadAccess.text;
      this.context.fillStyle = tone;
      this.context.globalAlpha = 0.13;
      this.context.fillRect(x, y, hazard.hitbox.width, hazard.hitbox.height);
      this.context.strokeStyle = tone;
      this.context.lineWidth = 3;
      this.context.globalAlpha = 0.96;
      this.context.beginPath();
      if (hazard.accessSector === "right") {
        this.context.moveTo(x, y);
        this.context.lineTo(x, y + hazard.hitbox.height);
      } else if (hazard.accessSector === "top") {
        this.context.moveTo(x, y + hazard.hitbox.height);
        this.context.lineTo(x + hazard.hitbox.width, y + hazard.hitbox.height);
      } else if (hazard.accessSector === "bottom") {
        this.context.moveTo(x, y);
        this.context.lineTo(x + hazard.hitbox.width, y);
      } else {
        this.context.moveTo(x + hazard.hitbox.width, y);
        this.context.lineTo(
          x + hazard.hitbox.width,
          y + hazard.hitbox.height,
        );
      }
      this.context.stroke();
      this.drawRichLabel(hazard.position, 0, {
        surface: "browser",
        label: "[access] ACCESS!",
        fontFamily: FONTS.browser,
        fontSize: 18,
        fontWeight: 700,
      });
      return;
    }

    if (hit.kind === "approval-gate") {
      const gate = state.approvalGates.find(({ id }) => id === hit.id);
      if (!gate) {
        return;
      }
      const displayGate = {
        ...gate,
        position: approvalGateDisplayPosition(gate, state.arena),
      };
      const tone = ATTACK_TONES.codex.text;
      for (const segment of approvalGateSegments(displayGate, state.arena)) {
        const x = segment.position.x - segment.hitbox.width / 2;
        const y = segment.position.y - segment.hitbox.height / 2;
        this.context.fillStyle = tone;
        this.context.globalAlpha = 0.08;
        this.context.fillRect(x, y, segment.hitbox.width, segment.hitbox.height);
        this.context.strokeStyle = tone;
        this.context.lineWidth = 1;
        this.context.globalAlpha = 0.88;
        this.context.strokeRect(x, y, segment.hitbox.width, segment.hitbox.height);
      }
      for (const gap of gate.gaps) {
        const placement = approvalGateLabelPlacement(gate, gap, state.arena);
        this.drawRichLabel(placement.position, placement.rotation, {
          surface: "codex",
          label: approvalGateLabelText(gap.label),
          fontFamily: FONTS.sans,
          fontSize: 9,
          fontWeight: 600,
        });
      }
      return;
    }

    if (hit.kind === "retry-chain") {
      const retry = state.retryChains.find(({ id }) => id === hit.id);
      if (!retry) {
        return;
      }
      const tone = ATTACK_TONES.codex.text;
      this.context.strokeStyle = tone;
      this.context.lineWidth = 1;
      this.context.globalAlpha = 0.44;
      this.context.beginPath();
      this.context.moveTo(
        retry.position.x - retry.velocity.x * 28,
        retry.position.y - retry.velocity.y * 28,
      );
      this.context.lineTo(
        retry.position.x - retry.velocity.x * 7,
        retry.position.y - retry.velocity.y * 7,
      );
      this.context.stroke();
      this.context.fillStyle = tone;
      this.context.globalAlpha = 0.9;
      this.context.fillRect(
        Math.round(retry.position.x - retry.velocity.x * 7) - 1,
        Math.round(retry.position.y - retry.velocity.y * 7) - 1,
        3,
        3,
      );
      this.drawRichLabel(
        retry.position,
        readableRotation(retry.velocity),
        {
          surface: "codex",
          label:
            retry.attempt === 1
              ? `[tool] retry ${retry.attempt}/${retry.totalAttempts}`
              : `[tool] FAILED · retry ${retry.attempt}/${retry.totalAttempts}`,
          fontFamily: FONTS.sans,
          fontSize: 10,
          fontWeight: 500,
        },
      );
      return;
    }

    const wave = state.reasoningWaves.find(({ id }) => id === hit.id);
    if (!wave) {
      return;
    }
    const tone = ATTACK_TONES.codex.text;
    const start = wave.safeAngle + wave.safeArc / 2;
    const end = wave.safeAngle + Math.PI * 2 - wave.safeArc / 2;
    this.context.strokeStyle = tone;
    this.context.globalAlpha = 0.14;
    this.context.lineWidth = Math.min(16, Math.max(12, wave.thickness));
    this.context.beginPath();
    this.context.arc(wave.center.x, wave.center.y, wave.radius, start, end);
    this.context.stroke();
    this.context.globalAlpha = 0.94;
    this.context.lineWidth = 1;
    this.context.beginPath();
    this.context.arc(wave.center.x, wave.center.y, wave.radius, start, end);
    this.context.stroke();
    this.context.globalAlpha = 0.72;
    for (const angle of [
      wave.safeAngle - wave.safeArc / 2,
      wave.safeAngle + wave.safeArc / 2,
    ]) {
      this.context.beginPath();
      this.context.moveTo(
        wave.center.x + Math.cos(angle) * Math.max(8, wave.radius - 10),
        wave.center.y + Math.sin(angle) * Math.max(8, wave.radius - 10),
      );
      this.context.lineTo(
        wave.center.x + Math.cos(angle) * (wave.radius + 9),
        wave.center.y + Math.sin(angle) * (wave.radius + 9),
      );
      this.context.stroke();
    }
    this.context.globalAlpha = 0.92;
    this.context.strokeRect(wave.center.x - 11, wave.center.y - 8, 22, 16);
    this.drawRichLabel(
      { x: wave.center.x, y: wave.center.y + 36 },
      0,
      {
        surface: "codex",
        label: "[ultra] 8/8 done · FINAL RESPONSE · [safe] 120°",
        fontFamily: FONTS.sans,
        fontSize: 10,
        fontWeight: 600,
      },
    );
  }

  private drawProjectile(projectile: ProjectileState): void {
    this.drawRichLabel(
      projectile.position,
      readableRotation(projectile.velocity),
      {
        surface: projectile.surface,
        label: projectile.label,
        fontFamily:
          projectile.surface === "terminal"
            ? FONTS.mono
            : projectile.surface === "browser"
              ? FONTS.browser
              : FONTS.sans,
        fontSize: projectileFontSize(projectile),
        fontWeight: projectile.surface === "terminal" ? 400 : 500,
        alpha: 0.96,
      },
    );
  }

  private drawRichLabel(
    position: Vec2,
    rotation: number,
    style: RichLabelStyle,
  ): void {
    const tokens = attackTextTokens(style.surface, style.label);
    this.context.save();
    this.context.translate(Math.round(position.x), Math.round(position.y));
    this.context.rotate(rotation);
    this.context.globalAlpha = style.alpha ?? 0.96;
    this.context.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
    this.context.textAlign = "left";
    this.context.textBaseline = "middle";
    this.context.lineJoin = "round";
    this.context.lineWidth = 4;
    this.context.strokeStyle = TEXT_COLORS.surface;
    const widths = tokens.map(({ text }) => this.context.measureText(text).width);
    let cursorX = -widths.reduce((sum, width) => sum + width, 0) / 2;

    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (!token) {
        continue;
      }
      this.context.strokeText(token.text, cursorX, 0);
      this.context.fillStyle = attackTextColor(token.role);
      this.context.fillText(token.text, cursorX, 0);
      cursorX += widths[index] ?? 0;
    }
    this.context.restore();
  }
}

function readableRotation(direction: Vec2): number {
  let angle = Math.atan2(direction.y, direction.x);
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
    angle += Math.PI;
  }
  return angle;
}

function projectileFontSize(projectile: ProjectileState): number {
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
