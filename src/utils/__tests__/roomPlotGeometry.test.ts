import { describe, expect, it } from 'vitest';
import { patchById } from '../../data/floorProject';
import { MIN_CANVAS_WIDTH, roomPlotGeometry } from '../roomPlotGeometry';

describe('roomPlotGeometry', () => {
  it('центрирует узкую проекцию арки и не даёт канвасу вытянуться в узкую полосу', () => {
    const geometry = roomPlotGeometry(patchById('arch'));

    expect(geometry.width).toBe(MIN_CANVAS_WIDTH);
    expect(geometry.plotW).toBeLessThan(geometry.width / 3);
    expect(geometry.x0).toBeGreaterThan(66);
    expect(geometry.width - (geometry.x0 + geometry.plotW)).toBeCloseTo(geometry.x0, 5);
  });

  it('сохраняет обычные отступы для широких комнат', () => {
    const geometry = roomPlotGeometry(patchById('garden'));

    expect(geometry.width).toBeGreaterThan(MIN_CANVAS_WIDTH);
    expect(geometry.x0).toBe(66);
    expect(geometry.plotW).toBeGreaterThan(800);
    expect(geometry.plotH).toBe(540);
  });
});
