import Phaser from "phaser";

import type { Vec2 } from "../core/model";

interface TouchGesture {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
}

export interface InputAction {
  source: "pointer" | "keyboard";
  position: Vec2 | null;
}

export class InputController {
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;
  private pointerTarget: Vec2 | null = null;
  private pointerPosition: Vec2 | null = null;
  private gameplayPointerTracking = true;
  private touchGesture: TouchGesture | null = null;
  private actionPending: InputAction | null = null;
  private muteTogglePending = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.keyboard = scene.input.keyboard;

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

  position(): Vec2 | null {
    return this.pointerTarget ? { ...this.pointerTarget } : null;
  }

  consumeAction(): InputAction | null {
    const pending = this.actionPending;
    this.actionPending = null;
    return pending;
  }

  setGameplayPointerTracking(enabled: boolean): void {
    this.gameplayPointerTracking = enabled;
  }

  consumeMuteToggle(): boolean {
    const pending = this.muteTogglePending;
    this.muteTogglePending = false;
    return pending;
  }

  clearTransient(): void {
    this.actionPending = null;
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

    this.actionPending = {
      source: "pointer",
      position: this.pointerPosition ? { ...this.pointerPosition } : null,
    };
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
      this.actionPending = {
        source: "pointer",
        position: this.pointerPosition ? { ...this.pointerPosition } : null,
      };
    }

    this.touchGesture = null;
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      event.preventDefault();
    }

    if (event.repeat) {
      return;
    }

    if (event.code === "Space") {
      this.actionPending = {
        source: "keyboard",
        position: this.pointerPosition ? { ...this.pointerPosition } : null,
      };
    } else if (event.code === "KeyM") {
      this.muteTogglePending = true;
    }
  };

  private updatePointerTarget(pointer: Phaser.Input.Pointer): void {
    if (Number.isFinite(pointer.worldX) && Number.isFinite(pointer.worldY)) {
      this.pointerPosition = { x: pointer.worldX, y: pointer.worldY };

      if (this.gameplayPointerTracking) {
        this.pointerTarget = { ...this.pointerPosition };
      }
    }
  }
}
