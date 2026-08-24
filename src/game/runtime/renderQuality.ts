const MIN_TEXT_RESOLUTION = 2;
const MAX_TEXT_RESOLUTION = 3;

export function textTextureResolution(devicePixelRatio: number): number {
  const safeRatio =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  return Math.min(
    MAX_TEXT_RESOLUTION,
    Math.max(MIN_TEXT_RESOLUTION, safeRatio),
  );
}
