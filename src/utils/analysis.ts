import { MeasurementGrid, CellAnalysis, AnalysisResult, CellAction, GridConfig } from '../types';

export function analyzeFloor(measurements: MeasurementGrid, grid: GridConfig): AnalysisResult {
  const { cols, rows, cellSize } = grid;

  let sum = 0, count = 0;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      sum += measurements[r][c];
      count++;
    }
  }
  const avg = sum / count;

  const cells: CellAnalysis[][] = [];

  for (let r = 0; r < rows; r++) {
    cells[r] = [];
    for (let c = 0; c < cols; c++) {
      const corners = [
        measurements[r][c],
        measurements[r][c + 1],
        measurements[r + 1][c],
        measurements[r + 1][c + 1],
      ];
      const cellAvg = corners.reduce((s, v) => s + v, 0) / 4;
      const deviation = cellAvg - avg;

      let action: CellAction = 'ok';
      let value = 0;
      if (deviation > 0.3) {
        action = 'grind';
        value = deviation;
      } else if (deviation < -0.3) {
        action = 'fill';
        value = Math.abs(deviation);
      }

      cells[r][c] = { row: r, col: c, deviation, action, value };
    }
  }

  const span = Math.round(2.0 / cellSize);
  const ruleViolations: { row: number; col: number }[] = [];

  for (let r = 0; r <= rows - span; r++) {
    for (let c = 0; c <= cols - span; c++) {
      let min = Infinity, max = -Infinity;
      for (let dr = 0; dr < span; dr++) {
        for (let dc = 0; dc < span; dc++) {
          const dev = cells[r + dr][c + dc].deviation;
          if (dev < min) min = dev;
          if (dev > max) max = dev;
        }
      }
      if (max - min > 2.0) {
        ruleViolations.push({ row: r, col: c });
      }
    }
  }

  let grindCount = 0, fillCount = 0, okCount = 0;
  let maxGrind = 0, maxFill = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r][c];
      if (cell.action === 'grind') {
        grindCount++;
        if (cell.value > maxGrind) maxGrind = cell.value;
      } else if (cell.action === 'fill') {
        fillCount++;
        if (cell.value > maxFill) maxFill = cell.value;
      } else {
        okCount++;
      }
    }
  }

  const cellArea = (cellSize * cellSize);

  return {
    cells,
    plane: { a: 0, b: 0, c: avg },
    ruleViolations,
    stats: {
      grindCount,
      fillCount,
      okCount,
      grindArea: grindCount * cellArea,
      fillArea: fillCount * cellArea,
      maxGrind,
      maxFill,
    },
  };
}

export function findZones(cells: CellAnalysis[][], action: CellAction): { row: number; col: number }[][] {
  const rows = cells.length;
  const cols = cells[0].length;
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const zones: { row: number; col: number }[][] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!visited[r][c] && cells[r][c].action === action) {
        const zone: { row: number; col: number }[] = [];
        const queue: { row: number; col: number }[] = [{ row: r, col: c }];
        visited[r][c] = true;

        while (queue.length > 0) {
          const current = queue.shift()!;
          zone.push(current);

          const neighbors = [
            { row: current.row - 1, col: current.col },
            { row: current.row + 1, col: current.col },
            { row: current.row, col: current.col - 1 },
            { row: current.row, col: current.col + 1 },
          ];

          for (const n of neighbors) {
            if (
              n.row >= 0 && n.row < rows &&
              n.col >= 0 && n.col < cols &&
              !visited[n.row][n.col] &&
              cells[n.row][n.col].action === action
            ) {
              visited[n.row][n.col] = true;
              queue.push(n);
            }
          }
        }

        zones.push(zone);
      }
    }
  }

  return zones;
}
