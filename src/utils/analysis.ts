import {
  AnalysisResult,
  CellAction,
  CellAnalysis,
  Plane,
  RuleSimulationResult,
  ScalarMap,
  Shape,
  SurfaceField,
  SummaryStats,
  Zone,
} from '../types';
import { planeValue } from './plane';
import { shapeContains } from './shapes';

export const DEVIATION_THRESHOLD_MM = 0.5;

/** Карта отклонений высот от опорной плоскости (мм, + выше плоскости). */
export function computeDeviationMap(field: SurfaceField, plane: Plane): ScalarMap {
  const values = new Float32Array(field.countX * field.countY);
  for (let j = 0; j < field.countY; j++) {
    const y = j * field.stepY;
    for (let i = 0; i < field.countX; i++) {
      const x = i * field.stepX;
      values[j * field.countX + i] = field.values[j * field.countX + i] - planeValue(plane, x, y);
    }
  }
  return { stepX: field.stepX, stepY: field.stepY, countX: field.countX, countY: field.countY, values };
}

/** Знаковая карта коррекций по правилу: + шлифовать, − подмазать (мм). */
export function buildRuleColorMap(rule: RuleSimulationResult): ScalarMap {
  const { problemMap } = rule;
  const values = new Float32Array(problemMap.countX * problemMap.countY);
  for (let i = 0; i < values.length; i++) {
    const g = problemMap.grind[i];
    const f = problemMap.fill[i];
    values[i] = g > 0 ? g : f > 0 ? -f : 0;
  }
  return {
    stepX: problemMap.stepX,
    stepY: problemMap.stepY,
    countX: problemMap.countX,
    countY: problemMap.countY,
    values,
  };
}

export function sampleProblem(
  rule: RuleSimulationResult,
  x: number,
  y: number
): { grind: number; fill: number; fails: number } {
  const { problemMap } = rule;
  const i = Math.max(0, Math.min(problemMap.countX - 1, Math.round((x - problemMap.x0) / problemMap.stepX)));
  const j = Math.max(0, Math.min(problemMap.countY - 1, Math.round((y - problemMap.y0) / problemMap.stepY)));
  const idx = j * problemMap.countX + i;
  return {
    grind: problemMap.grind[idx],
    fill: problemMap.fill[idx],
    fails: problemMap.failCount[idx],
  };
}

export interface AnalyzeOptions {
  /** Размер ячейки анализа, м (по умолчанию 25 см). */
  cellM?: number;
  thresholdMm?: number;
  /** Форма области в глобальных координатах: вне неё ячейки не учитываются. */
  shape?: Shape;
  originX?: number;
  originY?: number;
}

function buildCellGrid(
  field: SurfaceField,
  plane: Plane,
  rule: RuleSimulationResult | null,
  options: AnalyzeOptions
): { cells: CellAnalysis[][]; cellMx: number; cellMy: number } {
  const cellM = options.cellM ?? 0.25;
  const threshold = options.thresholdMm ?? DEVIATION_THRESHOLD_MM;
  const originX = options.originX ?? 0;
  const originY = options.originY ?? 0;
  const actionThreshold = 0.05;

  const cols = Math.max(1, Math.round(field.lengthM / cellM));
  const rows = Math.max(1, Math.round(field.widthM / cellM));
  const cellMx = field.lengthM / cols;
  const cellMy = field.widthM / rows;

  const cells: CellAnalysis[][] = [];
  for (let row = 0; row < rows; row++) {
    const line: CellAnalysis[] = [];
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) * cellMx;
      const y = (row + 0.5) * cellMy;
      const globalX = x + originX;
      const globalY = y + originY;
      const inside = !options.shape || shapeContains(options.shape, globalX, globalY, cellM / 2);
      const value0 = sampleMapValue(field, x, y);
      const deviation = value0 - planeValue(plane, x, y);

      let action: CellAction = 'ok';
      let value = Math.abs(deviation);

      if (!inside) {
        value = 0;
      } else if (rule) {
        const { grind, fill } = sampleProblem(rule, globalX, globalY);
        if (grind > actionThreshold && grind >= fill) {
          action = 'grind';
          value = grind;
        } else if (fill > actionThreshold) {
          action = 'fill';
          value = fill;
        } else {
          value = 0;
        }
      } else if (deviation > threshold) {
        action = 'grind';
      } else if (deviation < -threshold) {
        action = 'fill';
      }

      line.push({ row, col, deviation, action, value, x: globalX, y: globalY });
    }
    cells.push(line);
  }

  return { cells, cellMx, cellMy };
}

function sampleMapValue(field: SurfaceField, x: number, y: number): number {
  const i = Math.max(0, Math.min(field.countX - 1, Math.round(x / field.stepX)));
  const j = Math.max(0, Math.min(field.countY - 1, Math.round(y / field.stepY)));
  return field.values[j * field.countX + i];
}

function formatCoord(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function buildZones(
  cells: CellAnalysis[][],
  action: Exclude<CellAction, 'ok'>,
  cellMx: number,
  cellMy: number
): Zone[] {
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  const visited = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  const zones: Zone[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (visited[r][c] || cells[r][c].action !== action) continue;

      const queue: { row: number; col: number }[] = [{ row: r, col: c }];
      visited[r][c] = true;
      const members: { row: number; col: number }[] = [];

      let minRow = r;
      let maxRow = r;
      let minCol = c;
      let maxCol = c;
      let maxDepth = 0;
      let sumX = 0;
      let sumY = 0;

      while (queue.length > 0) {
        const cur = queue.pop() as { row: number; col: number };
        members.push(cur);
        const cell = cells[cur.row][cur.col];
        if (cell.value > maxDepth) maxDepth = cell.value;
        if (cur.row < minRow) minRow = cur.row;
        if (cur.row > maxRow) maxRow = cur.row;
        if (cur.col < minCol) minCol = cur.col;
        if (cur.col > maxCol) maxCol = cur.col;
        sumX += cell.x;
        sumY += cell.y;

        const neighbors = [
          { row: cur.row - 1, col: cur.col },
          { row: cur.row + 1, col: cur.col },
          { row: cur.row, col: cur.col - 1 },
          { row: cur.row, col: cur.col + 1 },
        ];
        for (const n of neighbors) {
          if (
            n.row >= 0 &&
            n.row < rows &&
            n.col >= 0 &&
            n.col < cols &&
            !visited[n.row][n.col] &&
            cells[n.row][n.col].action === action
          ) {
            visited[n.row][n.col] = true;
            queue.push(n);
          }
        }
      }

      zones.push({
        id: zones.length + 1,
        action,
        cells: members,
        area: members.length * cellMx * cellMy,
        maxDepth,
        centerX: sumX / members.length,
        centerY: sumY / members.length,
        rowFrom: minRow,
        rowTo: maxRow,
        colFrom: minCol,
        colTo: maxCol,
        label: `${formatCoord(sumX / members.length)} м, ${formatCoord(sumY / members.length)} м`,
      });
    }
  }

  zones.sort((a, b) => b.maxDepth - a.maxDepth);
  zones.forEach((z, i) => {
    z.id = i + 1;
  });
  return zones;
}

export function analyzeFloor(
  field: SurfaceField,
  plane: Plane,
  rule: RuleSimulationResult | null,
  options: AnalyzeOptions = {}
): AnalysisResult {
  const originX = options.originX ?? 0;
  const originY = options.originY ?? 0;
  const deviation = computeDeviationMap(field, plane);
  const { cells, cellMx, cellMy } = buildCellGrid(field, plane, rule, options);
  const grindZones = buildZones(cells, 'grind', cellMx, cellMy);
  const fillZones = buildZones(cells, 'fill', cellMx, cellMy);

  const stats: SummaryStats = {
    grindCount: 0,
    fillCount: 0,
    okCount: 0,
    grindArea: 0,
    fillArea: 0,
    okArea: 0,
    maxGrind: 0,
    maxFill: 0,
  };

  let violationCount = 0;
  const ruleViolationCells: boolean[][] = [];
  const cellArea = cellMx * cellMy;

  for (let r = 0; r < cells.length; r++) {
    ruleViolationCells.push(new Array<boolean>(cells[r].length).fill(false));
    for (let c = 0; c < cells[r].length; c++) {
      const cell = cells[r][c];
      if (cell.action === 'grind') {
        stats.grindCount++;
        stats.grindArea += cellArea;
        if (cell.value > stats.maxGrind) stats.maxGrind = cell.value;
      } else if (cell.action === 'fill') {
        stats.fillCount++;
        stats.fillArea += cellArea;
        if (cell.value > stats.maxFill) stats.maxFill = cell.value;
      } else {
        stats.okCount++;
        stats.okArea += cellArea;
      }

      if (rule) {
        const { fails } = sampleProblem(rule, cell.x, cell.y);
        if (fails > 0) {
          ruleViolationCells[r][c] = true;
          violationCount++;
        }
      }
    }
  }

  return {
    plane,
    deviation,
    cells,
    grindZones,
    fillZones,
    stats,
    ruleViolationCells,
    violationCount,
    originX,
    originY,
  };
}
