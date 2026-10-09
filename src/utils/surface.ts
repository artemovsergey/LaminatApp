import { GridConfig, MeasurementGrid, ScalarMap, SurfaceField } from '../types';

export const DEFAULT_DENSE_STEP_M = 0.05;

/**
 * Высоты пола считаем как h = -измерение: лазерный уровень меряет расстояние
 * от линии до пола, поэтому меньшему расстоянию соответствует более высокое
 * место. Внутри модели «больше высота = выше пол».
 */
function toHeight(value: number): number {
  return -value;
}

function clampIndex(v: number, max: number): number {
  if (v < 0) return 0;
  if (v > max) return max;
  return v;
}

function cubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

/**
 * Заполнение незамеренных точек. Узлы сетки (чётные индексы) восстанавливаются
 * решением задачи Лапласа, промежуточные точки (центры клеток и середины
 * рёбер) — линейной интерполяцией между узлами. Для линейной поверхности
 * результат точный, без «ступенек».
 */
function inpaintFine(fine: (number | null)[][], width: number, height: number): number[][] {
  const out: number[][] = fine.map(row => row.map(v => (v === null ? NaN : v)));

  const nodeW = Math.floor((width - 1) / 2) + 1;
  const nodeH = Math.floor((height - 1) / 2) + 1;

  const nodes: number[][] = Array.from({ length: nodeH }, (_, r) =>
    Array.from({ length: nodeW }, (_, c) => out[r * 2]?.[c * 2] ?? NaN)
  );

  let nodeSum = 0;
  let nodeCount = 0;
  const nodeFixed: boolean[][] = nodes.map(row =>
    row.map(v => {
      if (Number.isFinite(v)) {
        nodeSum += v;
        nodeCount++;
        return true;
      }
      return false;
    })
  );

  if (nodeCount > 0) {
    const nodeMean = nodeSum / nodeCount;
    for (let r = 0; r < nodeH; r++) {
      for (let c = 0; c < nodeW; c++) {
        if (!Number.isFinite(nodes[r][c])) nodes[r][c] = nodeMean;
      }
    }

    for (let iter = 0; iter < 3000; iter++) {
      let maxChange = 0;
      for (let r = 0; r < nodeH; r++) {
        for (let c = 0; c < nodeW; c++) {
          if (nodeFixed[r][c]) continue;
          let s = 0;
          let n = 0;
          if (c > 0) {
            s += nodes[r][c - 1];
            n++;
          }
          if (c < nodeW - 1) {
            s += nodes[r][c + 1];
            n++;
          }
          if (r > 0) {
            s += nodes[r - 1][c];
            n++;
          }
          if (r < nodeH - 1) {
            s += nodes[r + 1][c];
            n++;
          }
          if (n === 0) continue;
          const next = s / n;
          const change = Math.abs(next - nodes[r][c]);
          if (change > maxChange) maxChange = change;
          nodes[r][c] = next;
        }
      }
      if (maxChange < 1e-9) break;
    }

    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        if (Number.isFinite(out[j][i])) continue;
        const evenI = i % 2 === 0;
        const evenJ = j % 2 === 0;

        if (evenI && evenJ) {
          out[j][i] = nodes[j / 2][i / 2];
        } else if (!evenI && evenJ) {
          const r = j / 2;
          const c = (i - 1) / 2;
          out[j][i] = 0.5 * (nodes[r][c] + nodes[r][c + 1]);
        } else if (evenI && !evenJ) {
          const r = (j - 1) / 2;
          const c = i / 2;
          out[j][i] = 0.5 * (nodes[r][c] + nodes[r + 1][c]);
        } else {
          const r = (j - 1) / 2;
          const c = (i - 1) / 2;
          out[j][i] = 0.25 * (nodes[r][c] + nodes[r][c + 1] + nodes[r + 1][c] + nodes[r + 1][c + 1]);
        }
      }
    }
    return out;
  }

  // узловых замеров нет — сглаживаем по всем замеренным точкам
  let sum = 0;
  let count = 0;
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      if (Number.isFinite(out[j][i])) {
        sum += out[j][i];
        count++;
      }
    }
  }
  if (count === 0) return out.map(row => row.map(() => 0));

  const mean = sum / count;
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      if (!Number.isFinite(out[j][i])) out[j][i] = mean;
    }
  }

  for (let iter = 0; iter < 600; iter++) {
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        if (Number.isFinite(fine[j][i])) continue;
        let s = 0;
        let n = 0;
        if (i > 0) {
          s += out[j][i - 1];
          n++;
        }
        if (i < width - 1) {
          s += out[j][i + 1];
          n++;
        }
        if (j > 0) {
          s += out[j - 1][i];
          n++;
        }
        if (j < height - 1) {
          s += out[j + 1][i];
          n++;
        }
        if (n > 0) out[j][i] = s / n;
      }
    }
  }

  return out;
}

function sampleFine(fine: number[][], stepX: number, stepY: number, x: number, y: number): number {
  const height = fine.length;
  const width = fine[0].length;
  const maxI = width - 1;
  const maxJ = height - 1;

  const fx = x / stepX;
  const fy = y / stepY;
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;

  if (width < 4 || height < 4) {
    const i0 = clampIndex(i, maxI);
    const j0 = clampIndex(j, maxJ);
    const i1 = clampIndex(i + 1, maxI);
    const j1 = clampIndex(j + 1, maxJ);
    const v =
      fine[j0][i0] * (1 - tx) * (1 - ty) +
      fine[j0][i1] * tx * (1 - ty) +
      fine[j1][i0] * (1 - tx) * ty +
      fine[j1][i1] * tx * ty;
    return v;
  }

  // значение строки r в точке x: кубическая интерполяция с линейной
  // экстраполяцией на краях (границы не «сплющиваются», линейные данные
  // воспроизводятся точно)
  const rowAt = (r: number, txLocal: number, il: number): number => {
    const ii = clampIndex(il, maxI);
    const p1 = fine[r][ii];
    const p2 = fine[r][clampIndex(ii + 1, maxI)];
    const p0 = ii - 1 >= 0 ? fine[r][ii - 1] : 2 * p1 - p2;
    const p3 = ii + 2 <= maxI ? fine[r][ii + 2] : 2 * p2 - p1;
    return cubic(p0, p1, p2, p3, txLocal);
  };

  const rows: number[] = [];
  for (let jj = j - 1; jj <= j + 2; jj++) {
    if (jj >= 0 && jj <= maxJ) {
      rows.push(rowAt(jj, tx, i));
    } else {
      const baseRow = jj < 0 ? 0 : maxJ;
      const neighborRow = jj < 0 ? 1 : maxJ - 1;
      rows.push(2 * rowAt(baseRow, tx, i) - rowAt(neighborRow, tx, i));
    }
  }

  return cubic(rows[0], rows[1], rows[2], rows[3], ty);
}

function coordinateBracket(coords: number[], value: number): [number, number, number] {
  const last = coords.length - 1;
  if (value <= coords[0]) return [0, 1, 0];
  if (value >= coords[last]) return [last - 1, last, 1];

  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (coords[middle] <= value) low = middle;
    else high = middle;
  }
  const t = (value - coords[low]) / (coords[high] - coords[low]);
  return [low, high, t];
}

function sampleFineAtCoordinates(
  fine: number[][],
  coordsX: number[],
  coordsY: number[],
  x: number,
  y: number
): number {
  const [i0, i1, tx] = coordinateBracket(coordsX, x);
  const [j0, j1, ty] = coordinateBracket(coordsY, y);
  const top = fine[j0][i0] * (1 - tx) + fine[j0][i1] * tx;
  const bottom = fine[j1][i0] * (1 - tx) + fine[j1][i1] * tx;
  return top * (1 - ty) + bottom * ty;
}

/** Билинейный сэмпл равномерной карты. */
export function sampleMap(map: ScalarMap, x: number, y: number): number {
  const { countX, countY, stepX, stepY, values } = map;
  if (countX === 1 || countY === 1) return values[0] ?? 0;

  const fx = x / stepX;
  const fy = y / stepY;
  const i = Math.min(countX - 2, Math.max(0, Math.floor(fx)));
  const j = Math.min(countY - 2, Math.max(0, Math.floor(fy)));
  const tx = Math.min(1, Math.max(0, fx - i));
  const ty = Math.min(1, Math.max(0, fy - j));

  const v00 = values[j * countX + i];
  const v10 = values[j * countX + i + 1];
  const v01 = values[(j + 1) * countX + i];
  const v11 = values[(j + 1) * countX + i + 1];

  return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
}

export function createMap(countX: number, countY: number, stepX: number, stepY: number): ScalarMap {
  return { countX, countY, stepX, stepY, values: new Float32Array(countX * countY) };
}

/**
 * Строит виртуальную модель поверхности: интерполирует мелкую сетку замеров
 * (узлы 50 см + центры 25 см) и пересчитывает её в плотное поле высот.
 * Чем плотнее замеры, тем подробнее и точнее поверхность.
 */
export function buildSurface(
  measurements: MeasurementGrid,
  grid: GridConfig,
  targetStepM = DEFAULT_DENSE_STEP_M
): SurfaceField {
  const { fineCountX, fineCountY, stepX, stepY } = grid;

  const fineRaw: (number | null)[][] = Array.from({ length: fineCountY }, (_, j) =>
    Array.from({ length: fineCountX }, (_, i) => {
      const v = measurements[j]?.[i];
      return v === null || v === undefined || !Number.isFinite(v) ? null : toHeight(v);
    })
  );

  let measuredCount = 0;
  for (const row of fineRaw) {
    for (const v of row) {
      if (v !== null) measuredCount++;
    }
  }

  const fineHeights = inpaintFine(fineRaw, fineCountX, fineCountY);

  const countX = Math.max(2, Math.min(401, Math.round(grid.lengthM / targetStepM) + 1));
  const countY = Math.max(2, Math.min(401, Math.round(grid.widthM / targetStepM) + 1));
  const denseStepX = grid.lengthM / (countX - 1);
  const denseStepY = grid.widthM / (countY - 1);

  const heights = new Float32Array(countX * countY);
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (let j = 0; j < countY; j++) {
    const y = j * denseStepY;
    for (let i = 0; i < countX; i++) {
      const x = i * denseStepX;
      const v =
        grid.fineCoordinatesX && grid.fineCoordinatesY
          ? sampleFineAtCoordinates(fineHeights, grid.fineCoordinatesX, grid.fineCoordinatesY, x, y)
          : sampleFine(fineHeights, stepX, stepY, x, y);
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
    values: heights,
    lengthM: grid.lengthM,
    widthM: grid.widthM,
    fineHeights,
    maxHeight,
    minHeight,
    measuredCount,
  };
}

/** Высота поверхности в точке (м), мм. */
export function heightAt(field: SurfaceField, x: number, y: number): number {
  return sampleMap(field, x, y);
}

export function fieldToMap(field: SurfaceField): ScalarMap {
  return {
    stepX: field.stepX,
    stepY: field.stepY,
    countX: field.countX,
    countY: field.countY,
    values: field.values,
  };
}
