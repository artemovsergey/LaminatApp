import { FloorPatch } from '../data/floorProject';
import { roomOrientation } from './roomOrientation';

export interface PlotGeometry {
  x0: number;
  y0: number;
  plotW: number;
  plotH: number;
  width: number;
  height: number;
  scale: number;
}

const PADDING = { left: 66, right: 46, top: 52, bottom: 74 };
const MAX_PLOT_W = 860;
const MAX_PLOT_H = 540;

/** Минимальная ширина полотна, чтобы узкие комнаты не растягивались по высоте. */
export const MIN_CANVAS_WIDTH = 640;

export function roomPlotGeometry(patch: FloorPatch): PlotGeometry {
  const orientation = roomOrientation(patch);
  const scale = Math.min(MAX_PLOT_W / orientation.plotW, MAX_PLOT_H / orientation.plotH);
  const plotW = orientation.plotW * scale;
  const plotH = orientation.plotH * scale;
  const width = Math.max(
    Math.ceil(plotW + PADDING.left + PADDING.right),
    MIN_CANVAS_WIDTH
  );
  const x0 = Math.max(PADDING.left, (width - plotW) / 2);

  return {
    x0,
    y0: PADDING.top,
    plotW,
    plotH,
    width,
    height: Math.ceil(plotH + PADDING.top + PADDING.bottom),
    scale,
  };
}
