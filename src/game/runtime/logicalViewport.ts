import {
  DEFAULT_GAME_HEIGHT,
  DEFAULT_GAME_WIDTH,
} from "../constants";

export interface LogicalViewport {
  width: number;
  height: number;
  zoom: number;
}

export function logicalViewportFor(
  viewportWidth: number,
  viewportHeight: number,
): LogicalViewport {
  const safeWidth = validDimension(viewportWidth, DEFAULT_GAME_WIDTH);
  const safeHeight = validDimension(viewportHeight, DEFAULT_GAME_HEIGHT);
  const zoom = safeHeight / DEFAULT_GAME_HEIGHT;

  return {
    width: safeWidth / zoom,
    height: DEFAULT_GAME_HEIGHT,
    zoom,
  };
}

function validDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
