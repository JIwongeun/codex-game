const GAME_FONT = '500 16px "Pretendard Variable"';
const GAME_FONT_SAMPLE = "await CODEX Pointer crashed 포인터";
const FONT_WAIT_TIMEOUT_MS = 1_500;

interface FontLoader {
  load(font: string, text?: string): Promise<unknown>;
}

export function waitForGameFont(
  fonts: FontLoader | null | undefined,
  timeoutMs = FONT_WAIT_TIMEOUT_MS,
): Promise<void> {
  if (!fonts) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(finish, Math.max(0, timeoutMs));

    try {
      void fonts.load(GAME_FONT, GAME_FONT_SAMPLE).then(finish, finish);
    } catch {
      finish();
    }
  });
}
