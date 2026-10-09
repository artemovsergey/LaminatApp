export type MeasurementValue = number | null;

/**
 * Мелкая сетка замеров с шагом cellSize/2 (25 см при клетке 50 см).
 * Чётные индексы по каждой оси — узлы сетки, нечётные — центры клеток.
 */
export type MeasurementGrid = MeasurementValue[][];

export interface RoomDimensions {
  length: number;
  width: number;
}

export interface GridConfig {
  cellSize: number;
  cols: number;
  rows: number;
  nodeCountX: number;
  nodeCountY: number;
  fineCols: number;
  fineRows: number;
  fineCountX: number;
  fineCountY: number;
  /** Шаг мелкой сетки по X, м. */
  stepX: number;
  /** Шаг мелкой сетки по Y, м. */
  stepY: number;
  /** Координаты мелкой сетки; заданы явно для сетки с неполными крайними клетками. */
  fineCoordinatesX?: number[];
  fineCoordinatesY?: number[];
  lengthM: number;
  widthM: number;
}

export interface Plane {
  a: number;
  b: number;
  c: number;
}

/** Прямоугольник в глобальных координатах плана, м. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Область пола как объединение прямоугольников (осевое выравнивание). */
export interface Shape {
  rects: Rect[];
}

/** Равномерная скалярная карта (значения в мм). */
export interface ScalarMap {
  stepX: number;
  stepY: number;
  countX: number;
  countY: number;
  values: Float32Array;
}

/** Виртуальная модель поверхности пола: высоты в мм (больше = выше пол). */
export interface SurfaceField extends ScalarMap {
  lengthM: number;
  widthM: number;
  fineHeights: number[][];
  maxHeight: number;
  minHeight: number;
  measuredCount: number;
}

export type ViewLayer = 'rule' | 'deviation';

export interface ColorData {
  map: ScalarMap;
  maxAbs: number;
}

export type RuleVerdict = 'pass' | 'rock' | 'gap';

export interface RuleContact {
  x: number;
  y: number;
  t: number;
}

export interface RulePlacement {
  angleDeg: number;
  cx: number;
  cy: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startHeight: number;
  endHeight: number;
  verdict: RuleVerdict;
  maxGap: number;
  contacts: RuleContact[];
  blameX: number;
  blameY: number;
  blameAmount: number;
}

export interface AngleStats {
  angleDeg: number;
  placements: number;
  fails: number;
  maxGap: number;
}

/**
 * Карта проблемных мест по результатам прогона правила.
 * grind/fill — требуемая коррекция в мм, failCount — сколько положений
 * правила в данной точке дали нарушение.
 */
export interface ProblemMap {
  x0: number;
  y0: number;
  stepX: number;
  stepY: number;
  countX: number;
  countY: number;
  grind: Float32Array;
  fill: Float32Array;
  failCount: Uint16Array;
  totalCount: Uint16Array;
  maxGap: Float32Array;
}

export interface RuleOptions {
  lengthM: number;
  toleranceMm: number;
  angleStepDeg: number;
  positionStepM: number;
  sampleCount: number;
}

export interface RuleSimulationResult {
  placements: RulePlacement[];
  angles: AngleStats[];
  problemMap: ProblemMap;
  totalPlacements: number;
  totalFails: number;
  rockFails: number;
  gapFails: number;
  worst: RulePlacement[];
  options: RuleOptions;
}

export type CellAction = 'grind' | 'fill' | 'ok';

export interface CellAnalysis {
  row: number;
  col: number;
  deviation: number;
  action: CellAction;
  value: number;
  x: number;
  y: number;
}

export interface Zone {
  id: number;
  action: Exclude<CellAction, 'ok'>;
  cells: { row: number; col: number }[];
  area: number;
  maxDepth: number;
  centerX: number;
  centerY: number;
  rowFrom: number;
  rowTo: number;
  colFrom: number;
  colTo: number;
  label: string;
}

export interface SummaryStats {
  grindCount: number;
  fillCount: number;
  okCount: number;
  grindArea: number;
  fillArea: number;
  okArea: number;
  maxGrind: number;
  maxFill: number;
}

export interface AnalysisResult {
  plane: Plane;
  deviation: ScalarMap;
  cells: CellAnalysis[][];
  grindZones: Zone[];
  fillZones: Zone[];
  stats: SummaryStats;
  ruleViolationCells: boolean[][];
  violationCount: number;
  /** Смещение локальных координат поля к глобальным координатам плана. */
  originX: number;
  originY: number;
}

/** Готовое поле зоны симуляции: форма на плане + сэмплер высот. */
export interface ZoneSurface {
  id: string;
  name: string;
  shape: Shape;
  bounds: Rect;
  lengthM: number;
  widthM: number;
  field: SurfaceField;
  areaM2: number;
  measuredCount: number;
  window: 'north' | 'south' | 'east' | 'west' | null;
  /** Единичный вектор от первого ряда вглубь (для порядка отчёта). */
  scanX: number;
  scanY: number;
}

/** Область для симуляции правила: контур, сэмплер высот и порядок обхода. */
export interface RuleArea {
  bounds: Rect;
  shape: Shape;
  sampler: (x: number, y: number) => number;
  scanX?: number;
  scanY?: number;
}
