import Phaser from "phaser";

import { GAMEPLAY } from "../constants";
import { normalize } from "../core/math";
import type { Vec2 } from "../core/model";

interface TouchGesture {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
}

export class InputController {
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;
  private readonly movementKeys: {
    up: Phaser.Input.Keyboard.Key | null;
    down: Phaser.Input.Keyboard.Key | null;
    left: Phaser.Input.Keyboard.Key | null;
    right: Phaser.Input.Keyboard.Key | null;
    w: Phaser.Input.Keyboard.Key | null;
    a: Phaser.Input.Keyboard.Key | null;
    s: Phaser.Input.Keyboard.Key | null;
    d: Phaser.Input.Keyboard.Key | null;
  };

  private pointerTarget: Vec2 | null = null;
  private touchGesture: TouchGesture | null = null;
  private actionPending = false;
  private muteTogglePending = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.keyboard = scene.input.keyboard;
    this.movementKeys = {
      up: this.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: this.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: this.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: this.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      w: this.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    scene.input.on(
      Phaser.Input.Events.POINTER_UP_OUTSIDE,
      this.handlePointerUp,
    );
    this.keyboard?.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.handleKeyDown,
    );
  }

  direction(playerPosition: Vec2, currentDirection: Vec2): Vec2 | null {
    const left = this.isDown(this.movementKeys.left) || this.isDown(this.movementKeys.a);
    const right =
      this.isDown(this.movementKeys.right) || this.isDown(this.movementKeys.d);
    const up = this.isDown(this.movementKeys.up) || this.isDown(this.movementKeys.w);
    const down = this.isDown(this.movementKeys.down) || this.isDown(this.movementKeys.s);
    const keyboardActive = left || right || up || down;

    if (keyboardActive) {
      const keyboardDirection = {
        x: Number(right) - Number(left),
        y: Number(down) - Number(up),
      };

      if (keyboardDirection.x === 0 && keyboardDirection.y === 0) {
        return null;
      }

      return normalize(keyboardDirection, currentDirection);
    }

    if (!this.pointerTarget) {
      return null;
    }

    const pointerDirection = {
      x: this.pointerTarget.x - playerPosition.x,
      y: this.pointerTarget.y - playerPosition.y,
    };

    return Math.hypot(pointerDirection.x, pointerDirection.y) >=
      GAMEPLAY.pointerDeadZone
      ? normalize(pointerDirection, currentDirection)
      : null;
  }

  consumeAction(): boolean {
    const pending = this.actionPending;
    this.actionPending = false;
    return pending;
  }

  consumeMuteToggle(): boolean {
    const pending = this.muteTogglePending;
    this.muteTogglePending = false;
    return pending;
  }

  clearTransient(): void {
    this.actionPending = false;
    this.muteTogglePending = false;
    this.touchGesture = null;
  }

  resetForSuspend(): void {
    this.clearTransient();
    this.keyboard?.resetKeys();
  }

  destroy(): void {
    this.scene.input.off(
      Phaser.Input.Events.POINTER_DOWN,
      this.handlePointerDown,
    );
    this.scene.input.off(
      Phaser.Input.Events.POINTER_MOVE,
      this.handlePointerMove,
    );
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    this.scene.input.off(
      Phaser.Input.Events.POINTER_UP_OUTSIDE,
      this.handlePointerUp,
    );
    this.keyboard?.off(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.handleKeyDown,
    );
  }

  private addKey(keyCode: number): Phaser.Input.Keyboard.Key | null {
    return this.keyboard?.addKey(keyCode) ?? null;
  }

  private isDown(key: Phaser.Input.Keyboard.Key | null): boolean {
    return key?.isDown ?? false;
  }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    this.updatePointerTarget(pointer);

    if (pointer.wasTouch) {
      this.touchGesture = {
        pointerId: pointer.id,
        startX: pointer.worldX,
        startY: pointer.worldY,
        startTime: pointer.downTime,
      };
      return;
    }

    this.actionPending = true;
  };

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    this.updatePointerTarget(pointer);
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    this.updatePointerTarget(pointer);

    if (!pointer.wasTouch || this.touchGesture?.pointerId !== pointer.id) {
      this.touchGesture = null;
      return;
    }

    const distance = Math.hypot(
      pointer.worldX - this.touchGesture.startX,
      pointer.worldY - this.touchGesture.startY,
    );
    const duration = pointer.upTime - this.touchGesture.startTime;

    if (distance < 12 && duration < 250) {
      this.actionPending = true;
    }

    this.touchGesture = null;
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (
      event.code === "Space" ||
      event.code === "ArrowUp" ||
      event.code === "ArrowDown" ||
      event.code === "ArrowLeft" ||
      event.code === "ArrowRight"
    ) {
      event.preventDefault();
    }

    if (event.repeat) {
      return;
    }

    if (event.code === "Space") {
      this.actionPending = true;
    } else if (event.code === "KeyM") {
      this.muteTogglePending = true;
    }
  };

  private updatePointerTarget(pointer: Phaser.Input.Pointer): void {
    if (Number.isFinite(pointer.worldX) && Number.isFinite(pointer.worldY)) {
      this.pointerTarget = { x: pointer.worldX, y: pointer.worldY };
    }
  }
}
