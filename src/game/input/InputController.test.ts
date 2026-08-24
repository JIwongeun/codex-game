import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Input: {
      Events: {
        POINTER_DOWN: "pointerdown",
        POINTER_UP: "pointerup",
        POINTER_UP_OUTSIDE: "pointerupoutside",
      },
      Keyboard: {
        Events: {
          ANY_KEY_DOWN: "keydown",
          ANY_KEY_UP: "keyup",
        },
      },
    },
  },
}));

import { InputController } from "./InputController";

type Handler = (...args: never[]) => void;

class TestEmitter {
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

class TestKeyboard extends TestEmitter {
  readonly resetKeys = vi.fn();
}

class TestInput extends TestEmitter {
  readonly keyboard = new TestKeyboard();
}

function key(code: string, repeat = false): KeyboardEvent {
  return {
    code,
    repeat,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe("InputController keyboard input", () => {
  it("maps WASD and arrows to normalized movement and clears held keys on suspend", () => {
    const input = new TestInput();
    const controller = new InputController({ input } as unknown as Phaser.Scene);

    input.keyboard.emit("keydown", key("KeyW"));
    expect(controller.direction()).toEqual({ x: 0, y: -1 });

    input.keyboard.emit("keydown", key("ArrowRight"));
    expect(controller.direction().x).toBeCloseTo(Math.SQRT1_2);
    expect(controller.direction().y).toBeCloseTo(-Math.SQRT1_2);

    input.keyboard.emit("keyup", key("KeyW"));
    expect(controller.direction()).toEqual({ x: 1, y: 0 });

    controller.resetForSuspend();
    expect(controller.direction()).toEqual({ x: 0, y: 0 });
    expect(input.keyboard.resetKeys).toHaveBeenCalledOnce();
  });

  it("keeps click and Space as actions, Escape as exit, and M as mute", () => {
    const input = new TestInput();
    const controller = new InputController({ input } as unknown as Phaser.Scene);

    input.emit("pointerdown", { wasTouch: false } as Phaser.Input.Pointer);
    expect(controller.consumeAction()).toBe(true);
    expect(controller.consumeAction()).toBe(false);

    input.keyboard.emit("keydown", key("Space"));
    expect(controller.consumeAction()).toBe(true);

    const escape = key("Escape");
    input.keyboard.emit("keydown", escape);
    expect(controller.consumeExit()).toBe(true);
    expect(controller.consumeExit()).toBe(false);
    expect(escape.preventDefault).toHaveBeenCalledOnce();

    input.keyboard.emit("keydown", key("KeyM"));
    expect(controller.consumeMuteToggle()).toBe(true);
    expect(controller.consumeMuteToggle()).toBe(false);
  });

  it("captures Tab as a pause toggle only while gameplay is active", () => {
    const input = new TestInput();
    let gameplayActive = false;
    const controller = new InputController(
      { input } as unknown as Phaser.Scene,
      () => gameplayActive,
    );

    const readyTab = key("Tab");
    input.keyboard.emit("keydown", readyTab);
    expect(readyTab.preventDefault).not.toHaveBeenCalled();
    expect(controller.consumePauseToggle()).toBe(false);

    gameplayActive = true;
    const gameplayTab = key("Tab");
    input.keyboard.emit("keydown", gameplayTab);
    expect(gameplayTab.preventDefault).toHaveBeenCalledOnce();
    expect(controller.consumePauseToggle()).toBe(true);
    expect(controller.consumePauseToggle()).toBe(false);

    const repeatedTab = key("Tab", true);
    input.keyboard.emit("keydown", repeatedTab);
    expect(repeatedTab.preventDefault).toHaveBeenCalledOnce();
    expect(controller.consumePauseToggle()).toBe(false);
  });
});
