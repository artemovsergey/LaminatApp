import { describe, expect, it } from 'vitest';
import { analyzeFloor } from '../analysis';
import { computePlaneFromMap } from '../plane';
import { computeGrid } from '../grid';
import { buildSurface, fieldToMap, sampleMap } from '../surface';
import { DEFAULT_RULE_OPTIONS, simulateRule } from '../rule';
import { gaussianBump, measurementsFromHeights, measurementsAtNodesOnly } from './helpers';

describe('Анализ пола', () => {
  const grid = computeGrid(5, 4, 50);

  it('плоский пол: нет зон коррекции', () => {
    const field = buildSurface(measurementsFromHeights(grid, () => -11), grid);
    const plane = computePlaneFromMap(fieldToMap(field));
    const rule = simulateRule(field, grid, DEFAULT_RULE_OPTIONS);
    const result = analyzeFloor(field, plane, rule);

    expect(rule.totalFails).toBe(0);
    expect(result.grindZones.length).toBe(0);
    expect(result.fillZones.length).toBe(0);
    expect(result.stats.okCount).toBe(grid.fineCols * grid.fineRows);
    expect(result.violationCount).toBe(0);
  });

  it('наклонный пол: плоскость вбирает уклон, нарушений нет', () => {
    const field = buildSurface(measurementsFromHeights(grid, (x, y) => -11 + x * 5 + y * 2), grid);
    const plane = computePlaneFromMap(fieldToMap(field));
    const rule = simulateRule(field, grid, DEFAULT_RULE_OPTIONS);
    const result = analyzeFloor(field, plane, rule);

    expect(plane.a).toBeCloseTo(5, 1);
    expect(plane.b).toBeCloseTo(2, 1);
    expect(rule.totalFails).toBe(0);
    for (const value of result.deviation.values) {
      expect(Math.abs(value)).toBeLessThan(0.01);
    }
  });

  it('бугор определяется как зона шлифовки, впадина — как зона подмазки', () => {
    const bumpField = buildSurface(
      measurementsFromHeights(grid, gaussianBump(3, 2.5, 2, 0.3)),
      grid
    );
    const bumpPlane = computePlaneFromMap(fieldToMap(bumpField));
    const bumpRule = simulateRule(bumpField, grid, DEFAULT_RULE_OPTIONS);
    const bumpResult = analyzeFloor(bumpField, bumpPlane, bumpRule);

    expect(bumpResult.grindZones.length).toBeGreaterThan(0);
    const zone = bumpResult.grindZones[0];
    expect(Math.hypot(zone.centerX - 2.5, zone.centerY - 2)).toBeLessThan(0.5);
    expect(zone.maxDepth).toBeGreaterThan(0.1);
    expect(bumpResult.stats.grindArea).toBeGreaterThan(0);
    expect(bumpResult.violationCount).toBeGreaterThan(0);

    const holeField = buildSurface(
      measurementsFromHeights(grid, gaussianBump(-3, 2.5, 2, 0.3)),
      grid
    );
    const holePlane = computePlaneFromMap(fieldToMap(holeField));
    const holeRule = simulateRule(holeField, grid, DEFAULT_RULE_OPTIONS);
    const holeResult = analyzeFloor(holeField, holePlane, holeRule);

    expect(holeResult.fillZones.length).toBeGreaterThan(0);
    expect(Math.hypot(holeResult.fillZones[0].centerX - 2.5, holeResult.fillZones[0].centerY - 2)).toBeLessThan(0.5);
  });

  it('центры клеток сглаживают поверхность по сравнению с одними узлами', () => {
    const fn = gaussianBump(3, 2.35, 1.85, 0.4);
    const nodesField = buildSurface(measurementsAtNodesOnly(grid, fn), grid);
    const allField = buildSurface(measurementsFromHeights(grid, fn), grid);

    const scanPeak = (f: typeof nodesField) => {
      let peak = -Infinity;
      for (let x = 1.8; x <= 2.9; x += 0.02) {
        for (let y = 1.3; y <= 2.4; y += 0.02) {
          peak = Math.max(peak, sampleMap(f, x, y));
        }
      }
      return peak;
    };

    const nodesPeak = scanPeak(nodesField);
    const allPeak = scanPeak(allField);
    expect(Math.abs(allPeak - 3)).toBeLessThan(Math.abs(nodesPeak - 3));
  });
});
