import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Input: {
      Events: {
        POINTER_DOWN: "pointerdown",
        POINTER_MOVE: "pointermove",
        POINTER_UP: "pointerup",
        POINTER_UP_OUTSIDE: "pointerupoutside",
      },
      Keyboard: {
        Events: { ANY_KEY_DOWN: "keydown" },
      },
    },
  },
}));

import { InputController } from "./InputController";

type Handler = (...args: never[]) => void;

class TestInput {
  readonly keyboard = null;
  private readonly handlers = new Map<string, Handler>();

  on(event: string, handler: Handler): void {
    this.handlers.set(event, handler);
  }

  off(event: string): void {
    this.handlers.delete(event);
  }

  emit(event: string, value: unknown): void {
    this.handlers.get(event)?.(value as never);
  }
}

function pointer(x: number, y: number): Phaser.Input.Pointer {
  return {
    worldX: x,
    worldY: y,
    wasTouch: false,
  } as Phaser.Input.Pointer;
}

describe("InputController pause tracking", () => {
  it("keeps gameplay position frozen while retaining pointer actions", () => {
    const input = new TestInput();
    const controller = new InputController({ input } as unknown as Phaser.Scene);

    input.emit("pointermove", pointer(40, 60));
    expect(controller.position()).toEqual({ x: 40, y: 60 });

    controller.setGameplayPointerTracking(false);
    input.emit("pointermove", pointer(300, 240));
    input.emit("pointerdown", pointer(300, 240));

    expect(controller.position()).toEqual({ x: 40, y: 60 });
    expect(controller.consumeAction()).toEqual({
      source: "pointer",
      position: { x: 300, y: 240 },
    });

    controller.setGameplayPointerTracking(true);
    expect(controller.position()).toEqual({ x: 40, y: 60 });

    input.emit("pointermove", pointer(42, 62));
    expect(controller.position()).toEqual({ x: 42, y: 62 });
  });
});
