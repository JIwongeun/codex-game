import Phaser from "phaser";

import type { Vec2 } from "../core/model";

const MOVEMENT_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
]);

interface TouchGesture {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
}

export class InputController {
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;
  private readonly movementCodes = new Set<string>();
  private touchGesture: TouchGesture | null = null;
  private actionPending = false;
  private exitPending = false;
  private muteTogglePending = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.keyboard = scene.input.keyboard;

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    scene.input.on(
      Phaser.Input.Events.POINTER_UP_OUTSIDE,
      this.handlePointerUp,
    );
    this.keyboard?.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.handleKeyDown,
    );
    this.keyboard?.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_UP,
      this.handleKeyUp,
    );
  }

  direction(): Vec2 {
    const x =
      Number(this.isPressed("KeyD", "ArrowRight")) -
      Number(this.isPressed("KeyA", "ArrowLeft"));
    const y =
      Number(this.isPressed("KeyS", "ArrowDown")) -
      Number(this.isPressed("KeyW", "ArrowUp"));
    const magnitude = Math.hypot(x, y);

    return magnitude > 0
      ? { x: x / magnitude, y: y / magnitude }
      : { x: 0, y: 0 };
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

  consumeExit(): boolean {
    const pending = this.exitPending;
    this.exitPending = false;
    return pending;
  }

  clearTransient(): void {
    this.actionPending = false;
    this.exitPending = false;
    this.muteTogglePending = false;
    this.touchGesture = null;
  }

  resetForSuspend(): void {
    this.clearTransient();
    this.movementCodes.clear();
    this.keyboard?.resetKeys();
  }

  destroy(): void {
    this.scene.input.off(
      Phaser.Input.Events.POINTER_DOWN,
      this.handlePointerDown,
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
    this.keyboard?.off(
      Phaser.Input.Keyboard.Events.ANY_KEY_UP,
      this.handleKeyUp,
    );
  }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
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

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
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
      event.code === "Escape" ||
      MOVEMENT_CODES.has(event.code)
    ) {
      event.preventDefault();
    }

    if (MOVEMENT_CODES.has(event.code)) {
      this.movementCodes.add(event.code);
      return;
    }

    if (event.repeat) {
      return;
    }

    if (event.code === "Space") {
      this.actionPending = true;
    } else if (event.code === "Escape") {
      this.exitPending = true;
    } else if (event.code === "KeyM") {
      this.muteTogglePending = true;
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (MOVEMENT_CODES.has(event.code)) {
      event.preventDefault();
      this.movementCodes.delete(event.code);
    }
  };

  private isPressed(...codes: string[]): boolean {
    return codes.some((code) => this.movementCodes.has(code));
  }
}
