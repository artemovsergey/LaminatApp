import { FloorPatch } from '../data/floorProject';

export interface RoomPoint {
  row: number;
  point: number;
  kind: 'узел' | 'центр';
  /** Расстояние от лазера до пола, мм. */
  z: number;
  /** Отклонение от целевой отметки, мм: >0 — яма, <0 — бугор. */
  delta: number;
  /** Локальные координаты точки в поле комнаты, м. */
  x: number;
  y: number;
  /** Короткая привязка к сетке замеров. */
  gridRef: string;
  /** Понятное описание места в комнате. */
  place: string;
}

export interface RoomInsights {
  grind: RoomPoint[];
  fill: RoomPoint[];
  rows: number;
  points: number;
}

interface RawPoint extends RoomPoint {
  evenI: boolean;
  evenJ: boolean;
}

function sourceExtent(patch: FloorPatch): { rows: number; points: number } {
  let rows = 0;
  let points = 0;
  for (let j = 0; j < patch.measurements.length; j++) {
    for (let i = 0; i < patch.measurements[j].length; i++) {
      if (patch.measurements[j][i] === null) continue;
      const row = patch.transposeMeasurements ? Math.floor(i / 2) : Math.floor(j / 2);
      const point = patch.transposeMeasurements ? Math.floor(j / 2) : Math.floor(i / 2);
      if (row + 1 > rows) rows = row + 1;
      if (point + 1 > points) points = point + 1;
    }
  }
  return { rows, points };
}

function describePlace(patch: FloorPatch, x: number, y: number): string {
  const fx = patch.lengthM > 0 ? x / patch.lengthM : 0.5;
  const fy = patch.widthM > 0 ? y / patch.widthM : 0.5;

  const horizontal = fx < 0.3 ? 'слева' : fx > 0.7 ? 'справа' : 'по центру';
  const vertical = fy < 0.3 ? 'вверху' : fy > 0.7 ? 'внизу' : 'по центру';

  if (horizontal === 'по центру' && vertical === 'по центру') return 'в центре комнаты';
  if (horizontal === 'по центру') return `${vertical} по схеме`;
  if (vertical === 'по центру') return `${horizontal} по схеме`;
  return `${horizontal} ${vertical} по схеме`;
}

function collectPoints(patch: FloorPatch, targetZ: number): RawPoint[] {
  const { rows, points } = sourceExtent(patch);
  const out: RawPoint[] = [];

  for (let j = 0; j < patch.measurements.length; j++) {
    for (let i = 0; i < patch.measurements[j].length; i++) {
      const z = patch.measurements[j][i];
      if (z === null || z === undefined) continue;

      const evenI = i % 2 === 0;
      const evenJ = j % 2 === 0;
      const rowIndex = patch.transposeMeasurements ? Math.floor(i / 2) : Math.floor(j / 2);
      const pointIndex = patch.transposeMeasurements ? Math.floor(j / 2) : Math.floor(i / 2);
      const row = rowIndex + 1;
      const point = pointIndex + 1;

      const x = patch.grid.fineCoordinatesX?.[i] ?? i * patch.grid.stepX;
      const y = patch.grid.fineCoordinatesY?.[j] ?? j * patch.grid.stepY;

      out.push({
        row,
        point,
        kind: evenI && evenJ ? 'узел' : 'центр',
        z,
        delta: z - targetZ,
        x,
        y,
        gridRef: `ряд ${row}, точка ${point}`,
        place: describePlace(patch, x, y),
        evenI,
        evenJ,
      });
    }
  }
  return out;
}

/** Все фактические замеры комнаты с привязкой к сетке и координатами на схеме. */
export function roomMeasurementPoints(patch: FloorPatch, targetZ: number): RoomPoint[] {
  return collectPoints(patch, targetZ).map(({ evenI: _evenI, evenJ: _evenJ, ...point }) => point);
}

/** Какая ось схемы соответствует рядам, а какая — точкам. */
export function roomAxisInfo(patch: FloorPatch): {
  rowAxis: 'x' | 'y';
  pointAxis: 'x' | 'y';
  rows: number;
  points: number;
} {
  const ext = sourceExtent(patch);
  return patch.transposeMeasurements
    ? { rowAxis: 'x', pointAxis: 'y', ...ext }
    : { rowAxis: 'y', pointAxis: 'x', ...ext };
}

/**
 * Отбирает самые характерные бугры и ямы, не давая нескольким замерам
 * из одного места занять весь список: соседние точки в радиусе 0,6 м
 * считаются одной зоной.
 */
function pickDistinct(points: RoomPoint[], limit: number): RoomPoint[] {
  const picked: RoomPoint[] = [];
  for (const p of points) {
    const tooClose = picked.some(q => Math.hypot(p.x - q.x, p.y - q.y) < 0.6);
    if (tooClose) continue;
    picked.push(p);
    if (picked.length >= limit) break;
  }
  return picked;
}

/**
 * Локальные экстремумы по фактическим замерам. Узлы важнее центров:
 * при равном отклонении узел показывает реальный замер, а не интерполяцию.
 */
export function roomInsights(patch: FloorPatch, targetZ: number, limit = 3): RoomInsights {
  const all = collectPoints(patch, targetZ);
  const sortKey = (p: RawPoint) => (p.kind === 'узел' ? 0 : 1);

  const grind = all
    .filter(p => p.delta < 0)
    .sort((a, b) => a.delta - b.delta || sortKey(a) - sortKey(b));
  const fill = all
    .filter(p => p.delta > 0)
    .sort((a, b) => b.delta - a.delta || sortKey(a) - sortKey(b));

  const ext = sourceExtent(patch);
  return {
    grind: pickDistinct(grind, limit),
    fill: pickDistinct(fill, limit),
    rows: ext.rows,
    points: ext.points,
  };
}
