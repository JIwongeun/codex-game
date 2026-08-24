const MIN_TEXT_RESOLUTION = 2;
const MAX_TEXT_RESOLUTION = 3;
const QHD_PHYSICAL_WIDTH = 2_400;
const QHD_PHYSICAL_HEIGHT = 1_300;
const FHD_RENDER_SCALE = 2;
const QHD_RENDER_SCALE = 1.5;
const MAX_BACKING_WIDTH = 4_096;
const MAX_BACKING_HEIGHT = 2_304;

export type DisplayProfile = "fhd" | "qhd";

export interface RenderQuality {
  profile: DisplayProfile;
  renderScale: number;
  backingWidth: number;
  backingHeight: number;
}

export function renderQualityFor(
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio: number,
  screenWidth: number,
  screenHeight: number,
): RenderQuality {
  const safeViewportWidth = validDimension(viewportWidth, 1);
  const safeViewportHeight = validDimension(viewportHeight, 1);
  const safePixelRatio = validDimension(devicePixelRatio, 1);
  const physicalScreenWidth = validDimension(screenWidth, safeViewportWidth) *
    safePixelRatio;
  const physicalScreenHeight = validDimension(screenHeight, safeViewportHeight) *
    safePixelRatio;
  const profile: DisplayProfile =
    physicalScreenWidth >= QHD_PHYSICAL_WIDTH ||
    physicalScreenHeight >= QHD_PHYSICAL_HEIGHT
      ? "qhd"
      : "fhd";
  const requestedScale = Math.max(
    safePixelRatio,
    profile === "qhd" ? QHD_RENDER_SCALE : FHD_RENDER_SCALE,
  );
  const renderScale = Math.max(
    1,
    Math.min(
      requestedScale,
      MAX_BACKING_WIDTH / safeViewportWidth,
      MAX_BACKING_HEIGHT / safeViewportHeight,
    ),
  );

  return {
    profile,
    renderScale,
    backingWidth: Math.max(1, Math.round(safeViewportWidth * renderScale)),
    backingHeight: Math.max(1, Math.round(safeViewportHeight * renderScale)),
  };
}

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

function validDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
