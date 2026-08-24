export const COLORS = {
  background: 0xffffff,
  surface: 0xffffff,
  ink: 0x171717,
  text: 0x171717,
  black: 0x111111,
  muted: 0x686868,
  faint: 0xa3a3a3,
  border: 0xd4d4d0,
  soft: 0xf2f2ef,
  shadow: 0x111111,
  overflowWash: 0xfff8f7,
  overflowDanger: 0xb83d45,
} as const;

export const TEXT_COLORS = {
  ink: "#171717",
  muted: "#686868",
  faint: "#9a9a96",
  border: "#d4d4d0",
  surface: "#ffffff",
  danger: "#b83d45",
} as const;

export const ATTACK_TONES = {
  neutral: { value: 0x4b4b48, text: "#4b4b48" },
  terminalCommand: { value: 0xd18d00, text: "#d18d00" },
  terminalSuccess: { value: 0x287a50, text: "#287a50" },
  terminalWarning: { value: 0x9a5b13, text: "#9a5b13" },
  terminalError: { value: 0xb83d45, text: "#b83d45" },
  browserInk: { value: 0x465160, text: "#465160" },
  browserAccent: { value: 0x356da5, text: "#356da5" },
  browserError: { value: 0xb64747, text: "#b64747" },
  downloadAccess: { value: 0x287a50, text: "#287a50" },
  codex: { value: 0x6754a3, text: "#6754a3" },
} as const;

export const ATTACK_TEXT_COLORS = {
  ink: "#171717",
  muted: "#747470",
  terminalExecutable: "#d18d00",
  terminalParameter: "#6f6f6b",
  terminalString: "#147bd1",
  terminalWarning: "#9a5b13",
  terminalError: "#b83d45",
  browserError: "#b64747",
  browserMeta: "#596675",
  browserSuccess: "#287a50",
  codexToken: "#6754a3",
} as const;

export const FONTS = {
  mono: '"Cascadia Mono", "Cascadia Code", Consolas, ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Monaco, "Liberation Mono", monospace',
  browser: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  sans: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;

export const RENDER_DEPTHS = {
  background: -10,
  world: 1,
  attackLabelMax: 6,
  effects: 7,
  blackout: 8,
  blackoutLabel: 9,
  player: 10,
  overflowTransition: 20,
} as const;
