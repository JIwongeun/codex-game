export interface RandomResult {
  state: number;
  value: number;
}

export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    return 1;
  }

  return Math.trunc(seed) >>> 0;
}

export function nextRandom(previousState: number): RandomResult {
  const state = (previousState + 0x6d2b_79f5) >>> 0;
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  value = (value ^ (value >>> 14)) >>> 0;

  return {
    state,
    value: value / 4_294_967_296,
  };
}
