import { GridConfig, MeasurementGrid } from '../types';

/** Сетка заданного шага с неполной крайней клеткой по фактическому размеру. */
export function nodeGrid(
  lengthM: number,
  widthM: number,
  cellSizeCm = 50,
  minimumNodeCountX = 0,
  minimumNodeCountY = 0
): GridConfig {
  const cellSizeM = cellSizeCm / 100;
  const cols = Math.max(1, Math.ceil(lengthM / cellSizeM), minimumNodeCountX - 1);
  const rows = Math.max(1, Math.ceil(widthM / cellSizeM), minimumNodeCountY - 1);
  const fineCols = cols * 2;
  const fineRows = rows * 2;
  return {
    cellSize: cellSizeCm,
    cols,
    rows,
    nodeCountX: cols + 1,
    nodeCountY: rows + 1,
    fineCols,
    fineRows,
    fineCountX: fineCols + 1,
    fineCountY: fineRows + 1,
    stepX: lengthM / fineCols,
    stepY: widthM / fineRows,
    fineCoordinatesX: fixedStepCoordinates(cols, lengthM, cellSizeM),
    fineCoordinatesY: fixedStepCoordinates(rows, widthM, cellSizeM),
    lengthM,
    widthM,
  };
}

function fixedStepCoordinates(intervalCount: number, lengthM: number, cellSizeM: number): number[] {
  const regularIntervalCount = Math.ceil(lengthM / cellSizeM);
  const nodes = intervalCount > regularIntervalCount
    ? Array.from({ length: intervalCount + 1 }, (_, index) => (index * lengthM) / intervalCount)
    : Array.from({ length: intervalCount + 1 }, (_, index) =>
        index === intervalCount ? lengthM : index * cellSizeM
      );
  const coordinates = [nodes[0]];
  for (let index = 0; index < intervalCount; index++) {
    coordinates.push((nodes[index] + nodes[index + 1]) / 2, nodes[index + 1]);
  }
  return coordinates;
}

export function computeGrid(lengthM: number, widthM: number, cellSizeCm: number): GridConfig {
  const cols = Math.max(1, Math.round((lengthM * 100) / cellSizeCm));
  const rows = Math.max(1, Math.round((widthM * 100) / cellSizeCm));
  const fineCols = cols * 2;
  const fineRows = rows * 2;
  return {
    cellSize: cellSizeCm,
    cols,
    rows,
    nodeCountX: cols + 1,
    nodeCountY: rows + 1,
    fineCols,
    fineRows,
    fineCountX: fineCols + 1,
    fineCountY: fineRows + 1,
    stepX: cellSizeCm / 200,
    stepY: cellSizeCm / 200,
    lengthM: (cols * cellSizeCm) / 100,
    widthM: (rows * cellSizeCm) / 100,
  };
}

export function createEmptyGrid(grid: GridConfig): MeasurementGrid {
  return Array.from({ length: grid.fineCountY }, () =>
    Array.from({ length: grid.fineCountX }, () => null as number | null)
  );
}

/**
 * Старый формат (только узлы) → мелкая сетка: узлы на чётные индексы,
 * центры клеток остаются незамеренными (null).
 */
export function expandNodeGrid(nodes: (number | null)[][], grid: GridConfig): MeasurementGrid {
  const out = createEmptyGrid(grid);
  for (let r = 0; r < nodes.length; r++) {
    for (let c = 0; c < nodes[r].length; c++) {
      const fr = r * 2;
      const fc = c * 2;
      if (fr < out.length && fc < out[0].length) {
        out[fr][fc] = nodes[r][c];
      }
    }
  }
  return out;
}

export function countMeasured(data: MeasurementGrid): number {
  let n = 0;
  for (const row of data) {
    for (const v of row) {
      if (v !== null && Number.isFinite(v)) n++;
    }
  }
  return n;
}

export function isNodeIndex(i: number): boolean {
  return i % 2 === 0;
}

export function fineIndexToNode(i: number): number {
  return i / 2;
}
