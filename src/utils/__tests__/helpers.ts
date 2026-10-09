import { GridConfig, MeasurementGrid, SurfaceField } from '../../types';

export function analyticField(
  lengthM: number,
  widthM: number,
  fn: (x: number, y: number) => number,
  step = 0.05
): SurfaceField {
  const countX = Math.round(lengthM / step) + 1;
  const countY = Math.round(widthM / step) + 1;
  const denseStepX = lengthM / (countX - 1);
  const denseStepY = widthM / (countY - 1);
  const heights = new Float32Array(countX * countY);
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (let j = 0; j < countY; j++) {
    for (let i = 0; i < countX; i++) {
      const v = fn(i * denseStepX, j * denseStepY);
      heights[j * countX + i] = v;
      if (v < minHeight) minHeight = v;
      if (v > maxHeight) maxHeight = v;
    }
  }

  return {
    stepX: denseStepX,
    stepY: denseStepY,
    countX,
    countY,
    lengthM,
    widthM,
    values: heights,
    fineHeights: [],
    maxHeight,
    minHeight,
    measuredCount: heights.length,
  };
}

export function measurementsFromHeights(
  grid: GridConfig,
  fn: (x: number, y: number) => number
): MeasurementGrid {
  return Array.from({ length: grid.fineCountY }, (_, j) =>
    Array.from({ length: grid.fineCountX }, (_, i) => -fn(i * grid.stepX, j * grid.stepY))
  );
}

export function measurementsAtNodesOnly(
  grid: GridConfig,
  fn: (x: number, y: number) => number
): MeasurementGrid {
  return Array.from({ length: grid.fineCountY }, (_, j) =>
    Array.from({ length: grid.fineCountX }, (_, i) =>
      i % 2 === 0 && j % 2 === 0 ? -fn(i * grid.stepX, j * grid.stepY) : null
    )
  );
}

export function gaussianBump(amplitudeMm: number, cx: number, cy: number, sigmaM = 0.1) {
  return (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    return amplitudeMm * Math.exp(-(dx * dx + dy * dy) / (sigmaM * sigmaM));
  };
}
