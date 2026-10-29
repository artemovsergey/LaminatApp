import { describe, expect, it } from 'vitest';
import { APARTMENT_PATCHES, FLOOR_PATCHES, FloorPatch, patchById } from '../../data/floorProject';
import {
  displayToField,
  fieldToDisplay,
  roomOrientation,
  windowPlanSide,
} from '../roomOrientation';
import { roomAxisInfo, roomMeasurementPoints } from '../roomInsights';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
const ALL_PATCHES: FloorPatch[] = [...FLOOR_PATCHES, ...APARTMENT_PATCHES];

describe('roomOrientation', () => {
  it('ставит ряды по горизонтали, а точки по вертикали для всех комнат', () => {
    for (const patch of ALL_PATCHES) {
      const orientation = roomOrientation(patch);
      const rowFieldAxis = patch.transposeMeasurements ? 'x' : 'y';
      const expectedW = rowFieldAxis === 'x' ? patch.lengthM : patch.widthM;
      const expectedH = rowFieldAxis === 'x' ? patch.widthM : patch.lengthM;

      near(orientation.plotW, expectedW);
      near(orientation.plotH, expectedH);

      const bottomLeft = fieldToDisplay(orientation, 0, 0);
      const topRight = fieldToDisplay(orientation, patch.lengthM, patch.widthM);
      near(bottomLeft.x, 0);
      near(bottomLeft.y, expectedH);
      near(topRight.x, expectedW);
      near(topRight.y, 0);
    }
  });

  it('нумерует ряды слева направо, а точки снизу вверх', () => {
    for (const patch of ALL_PATCHES) {
      const orientation = roomOrientation(patch);
      const points = roomMeasurementPoints(patch, 113);

      const rows = [...new Set(points.map(point => point.row))].sort((a, b) => a - b);
      const rowXs = rows.map(row => points.find(point => point.row === row)!.planX);
      for (let index = 1; index < rowXs.length; index++) {
        expect(rowXs[index]).toBeGreaterThan(rowXs[index - 1]);
      }

      const pointNumbers = [...new Set(points.map(point => point.point))].sort((a, b) => a - b);
      const pointYs = pointNumbers.map(
        pointNumber => points.find(point => point.point === pointNumber)!.planY
      );
      for (let index = 1; index < pointYs.length; index++) {
        expect(pointYs[index]).toBeLessThan(pointYs[index - 1]);
      }

      for (const point of points) {
        expect(point.planX).toBeGreaterThanOrEqual(-1e-6);
        expect(point.planX).toBeLessThanOrEqual(orientation.plotW + 1e-6);
        expect(point.planY).toBeGreaterThanOrEqual(-1e-6);
        expect(point.planY).toBeLessThanOrEqual(orientation.plotH + 1e-6);
      }
    }
  });

  it('показывает окно слева для всех комнат с окном', () => {
    for (const patch of ALL_PATCHES) {
      expect(windowPlanSide(patch)).toBe(patch.window ? 'left' : null);
    }
  });

  it('переводит координаты схемы обратно в поле замера', () => {
    for (const patch of ALL_PATCHES) {
      const orientation = roomOrientation(patch);
      const u = patch.lengthM * 0.31;
      const v = patch.widthM * 0.72;

      const display = fieldToDisplay(orientation, u, v);
      const field = displayToField(orientation, display.x, display.y);
      near(field.u, u);
      near(field.v, v);

      const x = orientation.plotW * 0.23;
      const y = orientation.plotH * 0.64;
      const fieldBack = displayToField(orientation, x, y);
      const back = fieldToDisplay(orientation, fieldBack.u, fieldBack.v);
      near(back.x, x);
      near(back.y, y);
    }
  });

  it('всегда подписывает ряды по горизонтали, а точки по вертикали', () => {
    for (const patch of ALL_PATCHES) {
      const axis = roomAxisInfo(patch);
      expect(axis.rowAxis).toBe('x');
      expect(axis.pointAxis).toBe('y');
      expect(axis.rows).toBeGreaterThan(0);
      expect(axis.points).toBeGreaterThan(0);
    }
  });

  it('сохраняет размеры комнат при повороте проекции', () => {
    near(roomOrientation(patchById('garden')).plotW, 5.41);
    near(roomOrientation(patchById('garden')).plotH, 3.47);
    near(roomOrientation(patchById('hall')).plotW, 5.02);
    near(roomOrientation(patchById('hall')).plotH, 5.37);
    near(roomOrientation(patchById('arch')).plotW, 0.28);
    near(roomOrientation(patchById('arch')).plotH, 1.35);
  });
});
