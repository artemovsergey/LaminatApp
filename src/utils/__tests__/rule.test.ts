import { describe, expect, it } from 'vitest';
import { computePlane, planeValue } from '../plane';
import { computeGrid, expandNodeGrid } from '../grid';
import { DEFAULT_RULE_OPTIONS, simulateFieldPlacement, simulateRule } from '../rule';
import { buildSurface } from '../surface';
import { analyticField, gaussianBump } from './helpers';

describe('МНК-плоскость', () => {
  it('точно восстанавливает наклонную плоскость', () => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let r = 0; r <= 8; r++) {
      for (let c = 0; c <= 10; c++) {
        xs.push(c * 0.5);
        ys.push(r * 0.5);
      }
    }
    const plane = { a: 2.5, b: -1.5, c: 11 };
    const hs = xs.map((x, i) => planeValue(plane, x, ys[i]));
    const fitted = computePlane(hs, xs, ys);

    expect(fitted.a).toBeCloseTo(2.5, 9);
    expect(fitted.b).toBeCloseTo(-1.5, 9);
    expect(fitted.c).toBeCloseTo(11, 9);
  });

  it('на вырожденных данных возвращает горизонтальную плоскость', () => {
    const fitted = computePlane([1, 2, 3], [0, 0, 0], [0, 0, 0]);
    expect(fitted.a).toBeCloseTo(0, 9);
    expect(fitted.b).toBeCloseTo(0, 9);
    expect(fitted.c).toBeCloseTo(2, 9);
  });
});

describe('Модель опирания правила', () => {
  it('ровный пол: правило лежит без зазоров', () => {
    const field = analyticField(5, 4, () => 0);
    const p = simulateFieldPlacement(field, 0, 2.5, 2, DEFAULT_RULE_OPTIONS);
    expect(p.verdict).toBe('pass');
    expect(p.maxGap).toBeLessThan(0.01);
  });

  it('наклонный, но ровный пол: правило лежит заподлицо (регрессия)', () => {
    const field = analyticField(5, 4, x => x * 5);
    for (const angle of [0, 30, 45, 90, 135]) {
      const p = simulateFieldPlacement(field, angle, 2.5, 2, DEFAULT_RULE_OPTIONS);
      expect(p.verdict, `угол ${angle}`).toBe('pass');
      expect(p.maxGap, `угол ${angle}`).toBeLessThan(0.01);
    }
  });

  it('бугор 3 мм: правило качается, нужно шлифовать', () => {
    const field = analyticField(5, 4, gaussianBump(3, 2.5, 2));
    const p = simulateFieldPlacement(field, 0, 2.5, 2, DEFAULT_RULE_OPTIONS);
    expect(p.verdict).toBe('rock');
    expect(p.maxGap).toBeGreaterThan(2);
    expect(Math.hypot(p.blameX - 2.5, p.blameY - 2)).toBeLessThan(0.25);
    expect(p.contacts.length).toBeGreaterThanOrEqual(1);
    expect(p.blameAmount).toBeCloseTo(p.maxGap - 2, 5);
  });

  it('впадина 3 мм: зазор по центру, нужно подмазать', () => {
    const field = analyticField(5, 4, gaussianBump(-3, 2.5, 2));
    const p = simulateFieldPlacement(field, 0, 2.5, 2, DEFAULT_RULE_OPTIONS);
    expect(p.verdict).toBe('gap');
    expect(p.maxGap).toBeGreaterThan(2);
    expect(Math.hypot(p.blameX - 2.5, p.blameY - 2)).toBeLessThan(0.25);
  });

  it('бугор 1,5 мм: качание 3 мм — вне допуска', () => {
    const field = analyticField(5, 4, gaussianBump(1.5, 2.5, 2));
    const p = simulateFieldPlacement(field, 0, 2.5, 2, DEFAULT_RULE_OPTIONS);
    expect(p.verdict).toBe('rock');
    // бугор по центру поднимает противоположный конец на 2 * высоту бугра
    expect(p.maxGap).toBeCloseTo(3, 1);
  });

  it('граница допуска: бугор 1 мм — проходит, 1,01 мм — нет', () => {
    const ok = simulateFieldPlacement(analyticField(5, 4, gaussianBump(1, 2.5, 2)), 0, 2.5, 2, DEFAULT_RULE_OPTIONS);
    expect(ok.maxGap).toBeLessThanOrEqual(2.001);
    expect(ok.verdict).toBe('pass');

    const bad = simulateFieldPlacement(analyticField(5, 4, gaussianBump(1.01, 2.5, 2)), 0, 2.5, 2, DEFAULT_RULE_OPTIONS);
    expect(bad.maxGap).toBeGreaterThan(2);
    expect(bad.verdict).toBe('rock');
  });
});

describe('Прогон по всем направлениям', () => {
  it('ровный наклонный пол: нарушений нет', () => {
    const field = analyticField(5, 4, x => x * 5);
    const grid = computeGrid(5, 4, 50);
    const result = simulateRule(field, grid, { ...DEFAULT_RULE_OPTIONS, positionStepM: 0.25 });
    expect(result.totalFails).toBe(0);
    expect(result.angles.length).toBe(12);
  });

  it('бугор: находятся нарушения и виновник — шлифовка', () => {
    const field = analyticField(5, 4, gaussianBump(3, 2.5, 2));
    const grid = computeGrid(5, 4, 50);
    const result = simulateRule(field, grid, { ...DEFAULT_RULE_OPTIONS, positionStepM: 0.25 });

    expect(result.totalFails).toBeGreaterThan(0);
    expect(result.rockFails).toBeGreaterThan(0);

    const { problemMap } = result;
    let maxGrind = 0;
    let maxGrindIdx = -1;
    for (let i = 0; i < problemMap.grind.length; i++) {
      if (problemMap.grind[i] > maxGrind) {
        maxGrind = problemMap.grind[i];
        maxGrindIdx = i;
      }
    }
    expect(maxGrind).toBeGreaterThan(0);
    const gi = maxGrindIdx % problemMap.countX;
    const gj = Math.floor(maxGrindIdx / problemMap.countX);
    expect(Math.hypot(gi * problemMap.stepX - 2.5, gj * problemMap.stepX - 2)).toBeLessThan(0.3);
  });

  it('впадина: нарушения классифицируются как зазор', () => {
    const field = analyticField(5, 4, gaussianBump(-3, 2.5, 2));
    const grid = computeGrid(5, 4, 50);
    const result = simulateRule(field, grid, { ...DEFAULT_RULE_OPTIONS, positionStepM: 0.25 });
    expect(result.totalFails).toBeGreaterThan(0);
    expect(result.gapFails).toBeGreaterThan(result.rockFails);

    let maxFill = 0;
    for (const v of result.problemMap.fill) if (v > maxFill) maxFill = v;
    expect(maxFill).toBeGreaterThan(0);
  });
});
