import type { GamePhase } from "../core/model";

interface ResettableClock {
  reset(): void;
}

interface SuspendableInput {
  resetForSuspend(): void;
}

export class FocusPauseController {
  private paused = false;

  constructor(
    private readonly clock: ResettableClock,
    private readonly input: SuspendableInput,
  ) {}

  get isPaused(): boolean {
    return this.paused;
  }

  suspend(phase: GamePhase): void {
    this.resetTransientState();
    this.paused = phase === "playing";
  }

  focus(): void {
    this.resetTransientState();
  }

  resume(): boolean {
    if (!this.paused) {
      return false;
    }

    this.paused = false;
    this.resetTransientState();
    return true;
  }

  private resetTransientState(): void {
    this.clock.reset();
    this.input.resetForSuspend();
  }
}
