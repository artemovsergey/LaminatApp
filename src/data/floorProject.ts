import { GridConfig, MeasurementGrid, Rect, Shape } from '../types';
import { nodeGrid } from '../utils/grid';
import { rect, shapeArea, shapeBounds } from '../utils/shapes';

/**
 * Реальные замеры после шлифовки. Значения — расстояние от линии лазера до
 * пола (см в исходных таблицах, здесь уже переведены в мм: 10,5 см → 105 мм).
 *
 * Таблицы хранятся как ряды от окна и точки вдоль ряда. При сборке часть
 * помещений транспонируется, чтобы сохранить исходную нумерацию на плане.
 */
export type FieldAxis = { src: 'x' | 'y'; sign: 1 | -1 };

/** Основание пола: наливной пол второго этажа или бетонная стяжка в квартире. */
export type FloorBase = 'self-leveling' | 'screed';

/** Проект, к которому относится помещение. */
export type FloorProjectId = 'floor2' | 'apartment';

export interface FloorPatch {
  id: string;
  name: string;
  kind: 'room' | 'corridor' | 'hall' | 'arch' | 'sill';
  zoneId: string | null;
  project: FloorProjectId;
  base: FloorBase;
  /** Положение на плане этажа, м (глобальные координаты). */
  rect: Rect;
  /** Какая ось поля замера соответствует глобальному +X. */
  mapX: FieldAxis;
  /** Какая ось поля замера соответствует глобальному +Y. */
  mapY: FieldAxis;
  grid: GridConfig;
  measurements: MeasurementGrid;
  transposeMeasurements: boolean;
  centerPlacement: 'cell' | 'middle-row';
  /** Габарит вдоль первого ряда (окно) и глубина от окна, м. */
  lengthM: number;
  widthM: number;
  window: 'north' | 'south' | 'east' | 'west' | null;
  /** Сторона поля замера, у которой находится окно (для схемы комнаты). */
  windowSide: 'x0' | 'x1' | 'y0' | 'y1' | null;
  actualAreaM2: number;
}

export interface FloorZoneDef {
  id: string;
  name: string;
  shape: Shape;
  bounds: Rect;
  patchIds: string[];
  actualAreaM2: number;
  window: 'north' | 'south' | 'east' | 'west' | null;
  /** Направление от первого ряда вглубь — порядок отчёта и анимации. */
  scanX: number;
  scanY: number;
}

const toMm = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : Math.round(v * 10);

const mm = (rows: (number | null)[][]): (number | null)[][] => rows.map(row => row.map(toMm));

const transpose = (m: (number | null)[][]): (number | null)[][] =>
  m.length === 0 ? [] : m[0].map((_, i) => m.map(row => row[i] ?? null));

// --- Зал: 5,37 × 5,02 м, 11 рядов × 12 точек (центры будут позже) ---
const HALL: (number | null)[][] = [
  [10.5, 10.7, 10.7, 10.6, 10.6, 11.0, 11.3, 11.4, 11.4, 11.8, 11.9, 11.5],
  [11.0, 11.0, 11.0, 11.0, 11.3, 11.4, 11.6, 11.5, 11.4, 11.8, 11.5, 11.6],
  [11.1, 11.3, 11.4, 11.4, 11.4, 11.5, 12.0, 12.0, 11.5, 11.7, 11.5, 11.6],
  [11.4, 11.5, 11.5, 11.5, 11.4, 11.6, 12.0, 12.1, 11.6, 12.0, 11.6, 11.4],
  [11.4, 11.5, 11.5, 11.6, 11.5, 11.6, 12.0, 12.1, 11.8, 12.0, 11.6, 11.5],
  [11.3, 11.4, 11.5, 11.5, 11.5, 11.2, 11.8, 12.0, 12.0, 12.0, 11.8, 11.6],
  [11.4, 11.5, 11.4, 11.4, 11.5, 11.4, 11.5, 12.0, 12.0, 12.0, 11.8, 11.5],
  [11.5, 11.5, 11.4, 11.4, 11.4, 11.5, 11.5, 11.8, 11.9, 12.0, 11.8, 11.6],
  [11.0, 11.0, 11.0, 11.1, 11.1, 11.4, 11.4, 11.5, 11.7, 11.9, 11.9, 11.6],
  [11.0, 11.0, 11.0, 11.0, 11.0, 11.2, 11.3, 11.3, 11.5, 11.7, 11.8, 11.3],
  [10.4, 11.0, 11.0, 10.8, 10.8, 11.0, 11.0, 11.0, 11.4, 11.4, 11.5, 11.0],
];

const HALL_CENTERS: (number | null)[][] = [
  [11.0, 11.0, 11.1, 11.0, 11.4, 11.4, 11.5, 11.5, 11.9, 11.9, 11.9],
  [11.0, 11.2, 11.2, 11.3, 11.4, 11.5, 11.7, 11.7, 11.6, 11.6, 11.7],
  [11.5, 11.5, 11.5, 11.5, 11.5, 11.4, 12.1, 12.0, 11.9, 11.8, 11.6],
  [11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 12.1, 12.0, 11.9, 12.0, 11.7],
  [11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 12.0, 12.0, 12.0, 11.9, 11.7],
  [11.5, 11.5, 11.4, 11.4, 11.4, 11.3, 11.9, 12.0, 12.0, 12.0, 11.7],
  [11.5, 11.5, 11.5, 11.4, 11.6, 11.5, 11.6, 12.0, 12.0, 12.0, 11.8],
  [11.5, 11.1, 11.1, 11.3, 11.4, 11.5, 11.5, 11.8, 11.9, 12.0, 11.8],
  [11.0, 10.9, 11.0, 11.0, 11.1, 11.3, 11.4, 11.5, 11.7, 11.9, 11.7],
  [11.0, 11.0, 11.0, 10.9, 11.0, 11.0, 11.0, 11.4, 11.5, 11.7, 11.4],
];

// --- Коридор: 4,30 × 2,00 м, 9 рядов × 5 точек (записано вдоль длины — транспонируем) ---
const CORRIDOR: (number | null)[][] = [
  [11.0, 11.0, 11.1, 11.1, 11.0],
  [11.0, 11.1, 11.2, 11.2, 11.1],
  [10.7, 11.0, 11.1, 11.3, 11.1],
  [11.0, 11.0, 11.3, 11.3, 11.2],
  [11.0, 11.2, 11.3, 11.2, 10.9],
  [11.1, 11.3, 11.4, 11.4, 11.0],
  [11.1, 11.4, 11.4, 11.4, 11.0],
  [11.0, 11.2, 11.1, 11.2, 11.0],
  [11.0, 11.1, 11.1, 11.0, 10.6],
];

const CORRIDOR_CENTERS: (number | null)[][] = [
  [11.0, 11.1, 11.2, 11.1],
  [11.0, 11.1, 11.1, 11.1],
  [11.0, 11.1, 11.2, 11.4],
  [11.0, 11.3, 11.3, 11.2],
  [11.2, 11.4, 11.4, 11.2],
  [11.3, 11.4, 11.4, 11.1],
  [11.2, 11.3, 11.4, 11.2],
  [11.2, 11.2, 11.1, 11.0],
];

// --- Арка: ~1,35 × 0,28 м, 2 ряда × 4 точки ---
const ARCH: (number | null)[][] = [
  [10.9, 11.0, 11.0, 11.0],
  [10.8, 11.0, 11.0, 11.0],
];

const ARCH_CENTERS: (number | null)[][] = [[11.0, 11.0, 11.0]];

// --- Комната на огород: 5,41 × 3,47 м, узлы 12 × 8, центры 11 × 7 ---
const GARDEN_NODES: (number | null)[][] = [
  [11.0, 11.1, 11.3, 11.6, 11.4, 11.1, 11.0, 11.0],
  [11.0, 11.2, 11.2, 11.1, 11.2, 11.0, 10.8, 10.6],
  [11.0, 11.2, 11.3, 11.3, 11.4, 11.3, 11.0, 10.9],
  [11.0, 11.4, 11.5, 11.4, 11.4, 11.1, 10.9, 10.8],
  [11.1, 11.2, 11.4, 11.4, 11.0, 10.9, 10.6, 10.5],
  [11.0, 10.8, 11.5, 11.3, 10.9, 10.9, 10.6, 10.5],
  [10.6, 10.8, 10.9, 11.1, 11.0, 10.8, 10.6, 10.5],
  [10.9, 11.0, 11.0, 11.0, 10.9, 10.9, 10.6, 10.6],
  [10.9, 11.0, 11.0, 11.0, 10.9, 10.9, 10.9, 10.9],
  [10.9, 10.8, 11.0, 10.9, 11.0, 11.0, 10.8, 10.7],
  [11.0, 10.8, 10.9, 11.0, 11.0, 11.0, 10.9, 10.8],
  [10.5, 10.6, 10.7, 10.9, 10.9, 10.9, 10.8, 10.7],
];

const GARDEN_CENTERS: (number | null)[][] = [
  [11.4, 11.3, 11.4, 11.4, 11.2, 11.0, 10.8],
  [11.2, 11.2, 11.3, 11.3, 11.3, 11.1, 10.8],
  [11.1, 11.5, 11.4, 11.4, 11.2, 11.1, 10.9],
  [11.2, 11.3, 11.4, 11.4, 11.0, 10.7, 10.8],
  [11.1, 11.2, 11.4, 11.3, 11.1, 10.7, 10.6],
  [10.8, 10.8, 11.1, 11.0, 10.8, 10.8, 10.5],
  [10.9, 11.0, 11.1, 11.1, 11.0, 10.6, 10.6],
  [11.0, 11.0, 11.0, 11.0, 10.9, 10.8, 10.8],
  [10.9, 10.9, 11.0, 11.0, 11.0, 10.8, 10.7],
  [10.9, 10.8, 11.0, 11.0, 11.0, 11.0, 10.8],
  [10.9, 10.8, 11.0, 11.0, 11.0, 11.0, 10.9],
];

// --- Комната во двор: 4,87 × 3,55 м, узлы 11 × 8, центры 11 × 7 ---
const YARD_NODES: (number | null)[][] = [
  [11.1, 11.2, 11.4, 11.4, 11.4, 11.4, 11.4, 11.4],
  [11.4, 11.5, 11.5, 11.5, 11.4, 11.4, 11.4, 11.4],
  [11.1, 11.3, 11.3, 11.4, 11.4, 11.4, 11.2, 11.1],
  [11.0, 11.2, 11.3, 11.3, 11.4, 11.4, 11.3, 11.1],
  [11.0, 11.2, 11.4, 11.4, 11.3, 11.2, 11.1, 11.1],
  [11.0, 11.0, 11.4, 11.3, 11.4, 11.3, 11.0, 10.9],
  [11.1, 11.2, 11.2, 11.2, 11.3, 11.4, 11.0, 10.9],
  [11.0, 11.0, 11.1, 11.4, 11.4, 11.4, 11.2, 11.1],
  [10.8, 11.0, 11.4, 11.5, 11.5, 11.5, 11.4, 11.3],
  [11.1, 11.3, 11.6, 11.6, 11.5, 11.5, 11.5, 11.5],
  [11.1, 11.3, 11.6, 11.6, 11.2, 11.4, 11.5, 11.3],
];

const YARD_CENTERS: (number | null)[][] = [
  [11.5, 11.4, 11.5, 11.5, 11.5, 11.5, 11.5],
  [11.4, 11.4, 11.4, 11.4, 11.3, 11.3, 11.2],
  [11.3, 11.3, 11.4, 11.4, 11.4, 11.4, 11.1],
  [11.1, 11.2, 11.3, 11.4, 11.4, 11.3, 11.2],
  [11.1, 11.3, 11.4, 11.4, 11.4, 11.2, 11.0],
  [11.1, 11.2, 11.2, 11.3, 11.2, 11.1, 11.0],
  [11.1, 11.1, 11.2, 11.3, 11.4, 11.3, 11.1],
  [11.0, 11.2, 11.4, 11.5, 11.5, 11.5, 11.3],
  [11.1, 11.4, 11.6, 11.6, 11.5, 11.5, 11.5],
  [11.3, 11.5, 11.6, 11.5, 11.4, 11.5, 11.5],
  [null, null, null, null, null, null, null],
];

// --- Малая комната: 3,50 × 3,47 м, узлы 8 × 8, центры 7 × 7 ---
const SMALL_NODES: (number | null)[][] = [
  [11.3, 11.4, 11.2, 11.4, 11.4, 11.0, 10.9, 11.0],
  [11.2, 11.5, 11.5, 11.6, 11.4, 11.1, 11.4, 11.0],
  [11.1, 11.5, 11.5, 11.3, 11.3, 11.0, 11.0, 11.2],
  [11.3, 11.6, 11.3, 11.4, 11.3, 11.3, 11.2, 11.0],
  [11.3, 11.5, 11.5, 11.4, 11.4, 11.4, 11.5, 11.4],
  [11.4, 11.4, 11.6, 11.7, 11.7, 11.5, 11.5, 11.3],
  [11.4, 11.5, 11.5, 11.6, 11.7, 11.7, 11.6, 11.2],
  [11.1, 11.2, 11.2, 11.2, 11.4, 11.5, 11.3, 11.3],
];

const SMALL_CENTERS: (number | null)[][] = [
  [11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5],
  [11.5, 11.5, 11.4, 11.1, 11.0, 10.9, 11.4],
  [11.6, 11.5, 11.5, 11.3, 11.0, 10.9, 11.0],
  [11.2, 11.5, 11.4, 11.2, 11.2, 11.2, 11.5],
  [11.5, 11.5, 11.5, 11.5, 11.4, 11.5, 11.5],
  [11.5, 11.5, 11.5, 11.8, 11.9, 11.7, 11.5],
  [11.5, 11.5, 11.5, 11.7, 11.7, 11.6, 11.5],
];

// --- Комната в квартире: 5,95 × 3,20 м, бетонная стяжка, узлы 13 × 8, центры 12 × 7 ---
const APARTMENT_NODES: (number | null)[][] = [
  [10.4, 10.8, 11.1, 11.7, 11.4, 11.3, 10.5, 9.5],
  [11.0, 11.5, 11.8, 12.0, 11.8, 11.7, 10.8, 10.4],
  [11.4, 11.9, 12.0, 12.1, 12.0, 11.7, 11.3, 11.1],
  [12.0, 12.0, 12.0, 12.0, 11.8, 11.8, 11.9, 11.4],
  [11.8, 11.8, 12.0, 11.8, 11.8, 11.5, 11.5, 11.0],
  [11.5, 11.4, 11.5, 11.3, 11.2, 11.3, 11.0, 10.6],
  [11.3, 11.4, 11.4, 11.4, 11.1, 10.8, 10.8, 10.5],
  [10.5, 11.5, 11.4, 11.4, 11.4, 11.1, 10.9, 10.5],
  [10.5, 11.5, 11.3, 11.5, 11.5, 11.1, 11.3, 10.3],
  [10.6, 10.9, 11.2, 11.5, 11.3, 11.2, 11.1, 10.8],
  [10.7, 11.5, 11.4, 11.5, 11.5, 11.3, 11.0, 10.5],
  [10.5, 11.5, 12.0, 12.0, 11.9, 11.3, 10.8, 10.3],
  [9.5, 10.8, 11.5, 11.8, 11.9, 11.0, 10.0, 9.0],
];

const APARTMENT_CENTERS: (number | null)[][] = [
  [11.6, 11.6, 11.8, 11.5, 11.6, 11.1, 10.5],
  [11.9, 12.0, 12.0, 12.0, 12.0, 11.5, 11.0],
  [11.7, 12.1, 12.2, 11.8, 12.0, 12.1, 11.5],
  [12.0, 12.0, 12.0, 11.9, 11.7, 11.8, 11.5],
  [11.6, 11.6, 11.5, 11.7, 11.8, 11.2, 11.3],
  [11.3, 11.5, 11.5, 11.4, 11.0, 11.0, 10.5],
  [11.1, 11.3, 11.4, 11.4, 11.4, 10.6, 11.0],
  [11.5, 11.5, 11.4, 11.5, 11.5, 11.2, 11.0],
  [11.0, 11.2, 11.4, 11.6, 11.5, 11.0, 10.8],
  [11.1, 11.2, 11.5, 11.6, 11.5, 11.0, 11.3],
  [11.2, 11.7, 12.0, 11.8, 11.7, 11.2, 10.6],
  [11.0, 11.6, 11.8, 12.2, 11.8, 10.8, 10.2],
];

/* ------------------------------------------------------------------ */
/*  План этажа (условные координаты, м; X — вправо, Y — вверх)         */
/*  Коридор — центральная ось. Впереди по ходу: слева комната на огород, */
/*  справа малая комната; сзади: слева арка/зал, справа комната во двор. */
/*  Слева лестница, справа санузел.                                       */
/* ------------------------------------------------------------------ */

const CORRIDOR_RECT = rect(-2.15, -1.0, 2.15, 1.0);
const GARDEN_RECT = rect(-5.62, 1.0, -0.21, 4.47);
const SMALL_RECT = rect(2.11, 0, 5.61, 3.47);
const YARD_RECT = rect(2.06, 5.62, 5.61, 10.49);
const ARCH_RECT = rect(-1.35, -1.6, -0.1, -1.0);
const HALL_RECT = rect(-5.62, -6.41, 2.15, -1.0);

/** Квартира показана отдельно от второго этажа, в собственных координатах. */
const APARTMENT_RECT = rect(0, 0, 5.95, 3.2);

const EAST = { src: 'x', sign: -1 } as FieldAxis;
const WEST = { src: 'x', sign: 1 } as FieldAxis;
const NORTH = { src: 'y', sign: -1 } as FieldAxis;
const SOUTH = { src: 'y', sign: 1 } as FieldAxis;

function buildMeasurements(
  nodes: (number | null)[][],
  centers: (number | null)[][] | undefined,
  nodeRows: number,
  nodeCols: number,
  grid: GridConfig,
  centerPlacement: 'cell' | 'middle-row' = 'cell'
): MeasurementGrid {
  const out: MeasurementGrid = Array.from({ length: grid.fineCountY }, () =>
    Array.from({ length: grid.fineCountX }, () => null as number | null)
  );

  for (let j = 0; j < nodeRows; j++) {
    for (let i = 0; i < nodeCols; i++) {
      const v = nodes[j]?.[i];
      if (v === null || v === undefined) continue;
      if (out[j * 2] && i * 2 < out[j * 2].length) out[j * 2][i * 2] = v;
    }
  }
  centers?.forEach((row, j) => {
    row.forEach((v, i) => {
      if (v === null || v === undefined) return;
      const fj = j * 2 + 1;
      const fi = centerPlacement === 'middle-row' ? i * 2 : i * 2 + 1;
      if (out[fj] && fi < out[fj].length) out[fj][fi] = v;
    });
  });

  return out;
}

interface PatchConfig {
  id: string;
  name: string;
  kind: FloorPatch['kind'];
  zoneId: string | null;
  project?: FloorPatch['project'];
  base?: FloorPatch['base'];
  rect: Rect;
  mapX: FieldAxis;
  mapY: FieldAxis;
  nodes: (number | null)[][];
  centers?: (number | null)[][];
  transposeMeasurements?: boolean;
  centerPlacement?: 'cell' | 'middle-row';
  lengthM: number;
  widthM: number;
  window: FloorPatch['window'];
  windowSide?: FloorPatch['windowSide'];
  actualAreaM2: number;
}

function makePatch(cfg: PatchConfig): FloorPatch {
  const nodeRows = cfg.nodes.length;
  const nodeCols = cfg.nodes[0]?.length ?? 0;
  const grid = nodeGrid(cfg.lengthM, cfg.widthM, 50, nodeCols, nodeRows);
  return {
    id: cfg.id,
    name: cfg.name,
    kind: cfg.kind,
    zoneId: cfg.zoneId,
    project: cfg.project ?? 'floor2',
    base: cfg.base ?? 'self-leveling',
    rect: cfg.rect,
    mapX: cfg.mapX,
    mapY: cfg.mapY,
    grid,
    measurements: buildMeasurements(
      cfg.nodes,
      cfg.centers,
      nodeRows,
      nodeCols,
      grid,
      cfg.centerPlacement
    ),
    transposeMeasurements: cfg.transposeMeasurements ?? false,
    centerPlacement: cfg.centerPlacement ?? 'cell',
    lengthM: cfg.lengthM,
    widthM: cfg.widthM,
    window: cfg.window,
    windowSide: cfg.windowSide ?? null,
    actualAreaM2: cfg.actualAreaM2,
  };
}

export const FLOOR_PATCHES: FloorPatch[] = [
  makePatch({
    id: 'garden',
    name: 'Комната на огород',
    kind: 'room',
    zoneId: 'garden',
    rect: GARDEN_RECT,
    // Вход из коридора спереди; после поворота влево окно слева по стене
    mapX: { src: 'x', sign: 1 },
    mapY: { src: 'y', sign: -1 },
    nodes: mm(transpose(GARDEN_NODES)),
    centers: mm(transpose(GARDEN_CENTERS)),
    transposeMeasurements: true,
    lengthM: 5.41,
    widthM: 3.47,
    window: 'west',
    windowSide: 'x0',
    actualAreaM2: 18.77,
  }),
  makePatch({
    id: 'small',
    name: 'Малая комната',
    kind: 'room',
    zoneId: 'small',
    rect: SMALL_RECT,
    // Ряд 1 у окна справа; номера точек идут вдоль стены с окном.
    mapX: { src: 'x', sign: -1 },
    mapY: { src: 'y', sign: 1 },
    nodes: mm(transpose(SMALL_NODES)),
    centers: mm(transpose(SMALL_CENTERS)),
    transposeMeasurements: true,
    lengthM: 3.5,
    widthM: 3.47,
    window: 'east',
    windowSide: 'x0',
    actualAreaM2: 12.14,
  }),
  makePatch({
    id: 'yard',
    name: 'Комната во двор',
    kind: 'room',
    zoneId: 'yard',
    rect: YARD_RECT,
    // Ряды идут вглубь от южного окна; точки — вдоль окна.
    mapX: { src: 'y', sign: -1 },
    mapY: { src: 'x', sign: 1 },
    nodes: mm(transpose(YARD_NODES)),
    centers: mm(transpose(YARD_CENTERS)),
    transposeMeasurements: true,
    lengthM: 4.87,
    widthM: 3.55,
    window: 'south',
    windowSide: 'x1',
    actualAreaM2: 17.28,
  }),
  makePatch({
    id: 'hall',
    name: 'Зал',
    kind: 'hall',
    zoneId: 'corridor-hall',
    rect: HALL_RECT,
    // Арка и зал связаны: смотрим в сторону окна по центру дальней стены
    mapX: { src: 'x', sign: 1 },
    mapY: { src: 'y', sign: -1 },
    nodes: mm(HALL),
    centers: mm(HALL_CENTERS),
    lengthM: 5.37,
    widthM: 5.02,
    window: 'south',
    windowSide: 'y1',
    actualAreaM2: 26.95,
  }),
  makePatch({
    id: 'corridor',
    name: 'Коридор',
    kind: 'corridor',
    zoneId: 'corridor-hall',
    rect: CORRIDOR_RECT,
    // Замеры коридора начинаются от двери санузла и идут к противоположному концу
    mapX: EAST,
    mapY: { src: 'y', sign: 1 },
    nodes: mm(transpose(CORRIDOR)),
    centers: mm(transpose(CORRIDOR_CENTERS)),
    transposeMeasurements: true,
    lengthM: 4.3,
    widthM: 2.0,
    window: null,
    actualAreaM2: 8.6,
  }),
  makePatch({
    id: 'arch',
    name: 'Арка',
    kind: 'arch',
    zoneId: 'corridor-hall',
    rect: ARCH_RECT,
    mapX: { src: 'x', sign: 1 },
    mapY: { src: 'y', sign: 1 },
    nodes: mm(ARCH),
    centers: mm(ARCH_CENTERS),
    centerPlacement: 'middle-row',
    lengthM: 1.35,
    widthM: 0.28,
    window: null,
    actualAreaM2: 0.38,
  }),
  makePatch({
    id: 'sill-garden',
    name: 'Порог (огород)',
    kind: 'sill',
    zoneId: null,
    rect: rect(1.35, 1.8, 2.35, 2.3),
    mapX: WEST,
    mapY: { src: 'y', sign: -1 },
    nodes: mm([
      [10.9, 10.9, 10.9],
      [11.0, 11.0, 11.0],
    ]),
    lengthM: 1.0,
    widthM: 0.5,
    window: null,
    actualAreaM2: 0.35,
  }),
  makePatch({
    id: 'sill-yard',
    name: 'Порог (двор)',
    kind: 'sill',
    zoneId: null,
    rect: rect(3.7, -0.3, 4.7, 0.2),
    mapX: WEST,
    mapY: SOUTH,
    nodes: mm([
      [11.5, 11.5, 11.5],
      [11.5, 11.5, 11.5],
    ]),
    lengthM: 1.0,
    widthM: 0.5,
    window: null,
    actualAreaM2: 0.35,
  }),
  makePatch({
    id: 'sill-small',
    name: 'Порог (малая)',
    kind: 'sill',
    zoneId: null,
    rect: rect(3.85, 1.7, 4.85, 2.2),
    mapX: WEST,
    mapY: { src: 'y', sign: -1 },
    nodes: mm([
      [11.2, 11.3, 11.2],
      [11.4, 11.4, 11.4],
    ]),
    lengthM: 1.0,
    widthM: 0.5,
    window: null,
    actualAreaM2: 0.35,
  }),
];

export const APARTMENT_PATCHES: FloorPatch[] = [
  makePatch({
    id: 'apartment',
    name: 'Комната в квартире',
    kind: 'room',
    zoneId: 'apartment',
    project: 'apartment',
    base: 'screed',
    rect: APARTMENT_RECT,
    // Ряды идут вдоль длинной стороны 5,95 м, точки — поперёк комнаты.
    mapX: { src: 'x', sign: 1 },
    mapY: { src: 'y', sign: 1 },
    nodes: mm(transpose(APARTMENT_NODES)),
    centers: mm(transpose(APARTMENT_CENTERS)),
    transposeMeasurements: true,
    lengthM: 5.95,
    widthM: 3.2,
    window: null,
    actualAreaM2: 19.04,
  }),
];

function makeZone(
  patches: FloorPatch[],
  id: string,
  name: string,
  rects: Rect[],
  patchIds: string[],
  window: FloorZoneDef['window'],
  scanX: number,
  scanY: number
): FloorZoneDef {
  const shape: Shape = { rects };
  const area = patches.filter(p => patchIds.includes(p.id)).reduce(
    (s, p) => s + p.actualAreaM2,
    0
  );
  return {
    id,
    name,
    shape,
    bounds: shapeBounds(rects),
    patchIds,
    actualAreaM2: area,
    window,
    scanX,
    scanY,
  };
}

export const FLOOR_ZONES: FloorZoneDef[] = [
  makeZone(FLOOR_PATCHES, 'garden', 'Огород', [GARDEN_RECT], ['garden'], 'north', 0, -1),
  makeZone(FLOOR_PATCHES, 'small', 'Малая', [SMALL_RECT], ['small'], 'north', 0, -1),
  makeZone(FLOOR_PATCHES, 'yard', 'Двор', [YARD_RECT], ['yard'], 'south', 0, 1),
  makeZone(
    FLOOR_PATCHES,
    'corridor-hall',
    'Коридор + Зал',
    [CORRIDOR_RECT, ARCH_RECT, HALL_RECT],
    ['corridor', 'arch', 'hall'],
    null,
    -1,
    0
  ),
];

export const APARTMENT_ZONES: FloorZoneDef[] = [
  makeZone(
    APARTMENT_PATCHES,
    'apartment',
    'Квартира',
    [APARTMENT_RECT],
    ['apartment'],
    null,
    1,
    0
  ),
];

export interface UnmeasuredArea {
  id: string;
  name: string;
  rect: Rect;
}

/** Помещения без замеров: показываем на плане, в расчёт не берём. */
export const UNMEASURED_AREAS: UnmeasuredArea[] = [
  { id: 'stair', name: 'Лестница', rect: rect(-2.1, 0, 0, 2.0) },
  { id: 'wc', name: 'Санузел', rect: rect(4.3, 0, 5.8, 2.0) },
];

export const FLOOR_BOUNDS: Rect = shapeBounds([
  ...FLOOR_PATCHES.map(p => p.rect),
  ...UNMEASURED_AREAS.map(a => a.rect),
]);

const ALL_PATCHES = [...FLOOR_PATCHES, ...APARTMENT_PATCHES];

export function patchById(id: string): FloorPatch {
  const patch = ALL_PATCHES.find(p => p.id === id);
  if (!patch) throw new Error(`Неизвестный участок: ${id}`);
  return patch;
}

export function zoneById(id: string): FloorZoneDef {
  const z = [...FLOOR_ZONES, ...APARTMENT_ZONES].find(v => v.id === id);
  if (!z) throw new Error(`Неизвестная зона: ${id}`);
  return z;
}

/** Локальные координаты поля (u — от окна, v — вдоль окна), м → глобальные. */
export function patchLocalToGlobal(patch: FloorPatch, u: number, v: number): { x: number; y: number } {
  const nx = u / patch.lengthM;
  const ny = v / patch.widthM;

  const fromNorm = (axis: FieldAxis, t: number, lo: number, hi: number): number =>
    axis.sign > 0 ? lo + t * (hi - lo) : hi - t * (hi - lo);

  const x =
    patch.mapX.src === 'x'
      ? fromNorm(patch.mapX, nx, patch.rect.x0, patch.rect.x1)
      : fromNorm(patch.mapX, ny, patch.rect.x0, patch.rect.x1);
  const y =
    patch.mapY.src === 'y'
      ? fromNorm(patch.mapY, ny, patch.rect.y0, patch.rect.y1)
      : fromNorm(patch.mapY, nx, patch.rect.y0, patch.rect.y1);
  return { x, y };
}

/** Глобальные координаты → локальные координаты поля участка (u, v), м. */
export function patchGlobalToLocal(patch: FloorPatch, x: number, y: number): { u: number; v: number } {
  const toNorm = (axis: FieldAxis, p: number, lo: number, hi: number): number => {
    const t = hi === lo ? 0 : (p - lo) / (hi - lo);
    return axis.sign > 0 ? t : 1 - t;
  };

  const nx = patch.mapX.src === 'x'
    ? toNorm(patch.mapX, x, patch.rect.x0, patch.rect.x1)
    : toNorm(patch.mapX, y, patch.rect.y0, patch.rect.y1);
  const ny = patch.mapY.src === 'y'
    ? toNorm(patch.mapY, y, patch.rect.y0, patch.rect.y1)
    : toNorm(patch.mapY, x, patch.rect.x0, patch.rect.x1);

  return { u: nx * patch.lengthM, v: ny * patch.widthM };
}

/** Площадь зоны, м² (по фактическим площадям участков). */
export function zoneAreaM2(z: FloorZoneDef): number {
  return shapeArea(z.shape) > 0 ? z.actualAreaM2 : 0;
}

/** Собирает мелкую сетку (узлы + центры) — совместимый помощник. */
export function buildRoomMeasurements(patch: FloorPatch): {
  measurements: MeasurementGrid;
  grid: GridConfig;
} {
  return { measurements: patch.measurements, grid: patch.grid };
}

export function buildAllProjectMeasurements(): Record<string, MeasurementGrid> {
  const out: Record<string, MeasurementGrid> = {};
  for (const patch of ALL_PATCHES) out[patch.id] = patch.measurements;
  return out;
}
