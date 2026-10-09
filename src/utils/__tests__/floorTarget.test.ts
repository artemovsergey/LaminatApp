import { describe, expect, it } from 'vitest';
import { FLOOR_PATCHES, FLOOR_ZONES } from '../../data/floorProject';
import { buildFloorModel } from '../floorModel';
import {
  buildHeightHistogram,
  computeFloorLevel,
  computeFloorReference,
  LevelRoomInput,
} from '../floorTarget';
import { analyticField } from './helpers';

const model = buildFloorModel();

function zoneInputs(): LevelRoomInput[] {
  return model.zones.map(zone => ({
    id: zone.def.id,
    name: zone.def.name,
    areaM2: zone.def.actualAreaM2,
    field: zone.field,
  }));
}

describe('Данные реальных замеров', () => {
  it('сетки соответствуют таблицам', () => {
    for (const patch of FLOOR_PATCHES) {
      expect(patch.measurements.length, `${patch.name}: ряды`).toBe(patch.grid.fineCountY);
      expect(patch.measurements[0].length, `${patch.name}: точки`).toBe(patch.grid.fineCountX);
    }
  });

  it('количество и диапазон замеров совпадают со сводкой', () => {
    const expected: Record<string, { count: number; min: number; max: number }> = {
      hall: { count: 132 + 110, min: 105, max: 121 },
      corridor: { count: 45 + 32, min: 108, max: 114 },
      arch: { count: 12 + 4, min: 105, max: 110 },
      garden: { count: 96 + 77, min: 104, max: 117 },
      yard: { count: 88 + 70, min: 108, max: 115 },
      small: { count: 64 + 49, min: 108, max: 119 },
      'sill-garden': { count: 6, min: 109, max: 110 },
      'sill-yard': { count: 6, min: 115, max: 115 },
      'sill-small': { count: 6, min: 112, max: 114 },
    };

    for (const patch of FLOOR_PATCHES) {
      let count = 0;
      let min = Infinity;
      let max = -Infinity;
      for (const row of patch.measurements) {
        for (const v of row) {
          if (v === null || v === undefined) continue;
          count++;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      const exp = expected[patch.id];
      expect(count, `${patch.name}: количество`).toBe(exp.count);
      expect(min, `${patch.name}: минимум`).toBe(exp.min);
      expect(max, `${patch.name}: максимум`).toBe(exp.max);
    }
  });

  it('зон симуляции четыре, коридор и зал объединены', () => {
    expect(FLOOR_ZONES.map(z => z.id)).toEqual(['garden', 'small', 'yard', 'corridor-hall']);
    const combined = FLOOR_ZONES.find(z => z.id === 'corridor-hall');
    expect(combined?.patchIds).toEqual(['corridor', 'arch', 'hall']);
  });
});

describe('Расчёт единой отметки этажа', () => {
  it('опорные значения по реальным замерам', () => {
    const reference = computeFloorReference(zoneInputs());
    expect(reference.minZ).toBeGreaterThan(104 - 1);
    expect(reference.minZ).toBeLessThan(104 + 1);
    expect(reference.maxZ).toBeGreaterThan(121 - 1);
    expect(reference.maxZ).toBeLessThan(121 + 1);

    const histogram = buildHeightHistogram(zoneInputs());
    expect(histogram.length).toBeGreaterThan(10);
    const histArea = histogram.reduce((s, b) => s + b.areaM2, 0);
    const zoneArea = FLOOR_ZONES.reduce((s, z) => s + z.actualAreaM2, 0);
    expect(histArea).toBeCloseTo(zoneArea, 0);
  });

  it('цель по самой высокой точке — только подмазка', () => {
    const result = computeFloorLevel(zoneInputs(), 104, 2);
    expect(result.totals.maxGrind).toBeLessThan(1);
    expect(result.totals.maxFill).toBeGreaterThan(15);
    expect(result.totals.grindAreaM2).toBe(0);
    expect(result.totals.fillMassKg).toBeGreaterThan(100);
  });

  it('цель по самой низкой точке — только шлифовка', () => {
    const result = computeFloorLevel(zoneInputs(), 121, 2);
    expect(result.totals.maxFill).toBeLessThan(1);
    expect(result.totals.maxGrind).toBeGreaterThan(15);
    expect(result.totals.fillAreaM2).toBe(0);
    expect(result.totals.fillMassKg).toBeLessThan(1);
  });

  it('медиана даёт минимальный суммарный объём коррекций', () => {
    const inputs = zoneInputs();
    const reference = computeFloorReference(inputs);
    const atMedian = computeFloorLevel(inputs, reference.medianZ, 2);
    const atMean = computeFloorLevel(inputs, reference.meanZ, 2);
    const totalWork = (r: ReturnType<typeof computeFloorLevel>) => r.totals.fillLiters + r.totals.grindLiters;

    expect(totalWork(atMedian)).toBeLessThanOrEqual(totalWork(atMean) + 1);
    const outside = atMedian.totals.grindAreaM2 + atMedian.totals.fillAreaM2;
    expect(outside).toBeGreaterThan(0);
    expect(outside).toBeLessThan(atMedian.totals.areaM2);
  });

  it('все помещения попадают в отчёт, площади суммируются', () => {
    const inputs = zoneInputs();
    const result = computeFloorLevel(inputs, computeFloorReference(inputs).medianZ, 2);
    expect(result.rooms).toHaveLength(FLOOR_ZONES.length);
    const expectedArea = FLOOR_ZONES.reduce((s, z) => s + z.actualAreaM2, 0);
    expect(result.totals.areaM2).toBeCloseTo(expectedArea, 1);
  });
});

describe('Арифметика выравнивания', () => {
  it('ровный пол: коррекций нет', () => {
    const field = analyticField(4, 3, () => -1100);
    const result = computeFloorLevel([{ id: 'a', name: 'A', areaM2: 12, field }], 1100, 2);
    expect(result.totals.fillAreaM2).toBe(0);
    expect(result.totals.grindAreaM2).toBe(0);
    expect(result.totals.okPercent).toBeCloseTo(100, 6);
    expect(result.totals.fillMassKg).toBe(0);
  });

  it('объёмы и массы: ровно 5 мм на 10 м² = 50 л = 80 кг', () => {
    const field = analyticField(4, 2.5, () => -1105);
    const result = computeFloorLevel([{ id: 'a', name: 'A', areaM2: 10, field }], 1100, 2);
    expect(result.totals.fillLiters).toBeCloseTo(50, 0);
    expect(result.totals.fillMassKg).toBeCloseTo(80, 0);
    expect(result.totals.maxFill).toBeCloseTo(5, 3);
    expect(result.totals.fillAreaM2).toBeCloseTo(10, 1);
  });

  it('допуск ±2 мм: близкие к цели точки считаются нормой', () => {
    const field = analyticField(1, 1, (x, y) => -1100 - (x + y));
    const result = computeFloorLevel([{ id: 'a', name: 'A', areaM2: 1, field }], 1101, 2);
    expect(result.totals.okPercent).toBeCloseTo(100, 0);
    expect(result.totals.fillLiters).toBeGreaterThan(0);
    expect(result.totals.fillAreaM2).toBe(0);
  });
});
