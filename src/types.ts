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
}

export type MeasurementGrid = number[][];

export type CellAction = 'grind' | 'fill' | 'ok';

export interface CellAnalysis {
  row: number;
  col: number;
  deviation: number;
  action: CellAction;
  value: number;
}

export interface AnalysisResult {
  cells: CellAnalysis[][];
  plane: { a: number; b: number; c: number };
  ruleViolations: { row: number; col: number }[];
  stats: {
    grindCount: number;
    fillCount: number;
    okCount: number;
    grindArea: number;
    fillArea: number;
    maxGrind: number;
    maxFill: number;
  };
}

export interface Zone {
  id: number;
  action: CellAction;
  cells: { row: number; col: number }[];
  area: number;
  maxValue: number;
}
