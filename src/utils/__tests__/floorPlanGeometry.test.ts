import { describe, expect, it } from 'vitest';
import { buildFloorModel } from '../floorModel';
import { getFloorPlanGeometry } from '../floorPlanGeometry';

describe('Геометрия плана этажа', () => {
  it('использует одни габариты и координаты для комнат 2D- и 3D-плана', () => {
    const { rooms } = getFloorPlanGeometry(buildFloorModel());

    expect(rooms.garden).toMatchObject({ y: 0, width: 5.41, depth: 3.47 });
    expect(rooms.garden.x).toBeCloseTo(-3.3, 8);
    expect(rooms.small).toMatchObject({ x: 2.11, y: 0, width: 3.5, depth: 3.47 });
    expect(rooms.corridor).toMatchObject({ x: 0, y: 3.47, width: 4.3, depth: 2 });
    expect(rooms.hall).toMatchObject({ width: 5.37, depth: 5.02 });
    expect(rooms.hall.y).toBeCloseTo(5.47, 8);
    expect(rooms.hall.x).toBeCloseTo(-3.26, 8);
    expect(rooms.yard).toMatchObject({ width: 3.55, depth: 4.87 });
    expect(rooms.yard.x).toBeCloseTo(2.06, 8);
    expect(rooms.yard.y).toBeCloseTo(5.62, 8);
    expect(rooms.arch).toMatchObject({ width: 1.35, depth: 0.28 });
    expect(rooms.arch.x).toBeCloseTo(0.55, 8);
    expect(rooms.arch.y).toBeCloseTo(5.47, 8);
  });

  it('привязывает лестницу и санузел к коридору, не смещая обмеренные комнаты', () => {
    const geometry = getFloorPlanGeometry(buildFloorModel());

    expect(geometry.stair).toEqual({ x: -1.2, y: 3.47, width: 1.2, depth: 2 });
    expect(geometry.wc.x).toBeCloseTo(4.3, 8);
    expect(geometry.wc.y).toBeCloseTo(3.47, 8);
    expect(geometry.wc.width).toBeCloseTo(1.31, 8);
    expect(geometry.wc.depth).toBeCloseTo(2.15, 8);
  });
});
