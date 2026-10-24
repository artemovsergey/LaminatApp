import { describe, expect, it } from 'vitest';
import { patchById } from '../../data/floorProject';
import {
  displayToField,
  fieldToDisplay,
  roomOrientation,
  windowPlanSide,
} from '../roomOrientation';
import { roomAxisInfo, roomMeasurementPoints } from '../roomInsights';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('roomOrientation', () => {
  it('строит схему зала как на плане: поле идёт вправо и вверх', () => {
    const patch = patchById('hall')!;
    const orientation = roomOrientation(patch);

    expect(orientation.plotW).toBe(patch.lengthM);
    expect(orientation.plotH).toBe(patch.widthM);
    near(fieldToDisplay(orientation, 0, 0).x, 0);
    near(fieldToDisplay(orientation, 0, 0).y, patch.widthM);
    near(fieldToDisplay(orientation, patch.lengthM, patch.widthM).x, patch.lengthM);
    near(fieldToDisplay(orientation, patch.lengthM, patch.widthM).y, 0);
  });

  it('разворачивает малую комнату окном вправо', () => {
    const patch = patchById('small')!;
    const orientation = roomOrientation(patch);

    near(fieldToDisplay(orientation, 0, 0).x, patch.lengthM);
    near(fieldToDisplay(orientation, 0, 0).y, 0);
    expect(windowPlanSide(patch)).toBe('right');
  });

  it('ставит комнату во двор окном вниз', () => {
    const patch = patchById('yard')!;
    const orientation = roomOrientation(patch);

    expect(orientation.uHorizontal).toBe(false);
    near(fieldToDisplay(orientation, 0, 0).x, 0);
    near(fieldToDisplay(orientation, 0, 0).y, patch.lengthM);
    expect(windowPlanSide(patch)).toBe('bottom');
  });

  it('оставляет арку и квартиру без зеркалирования', () => {
    for (const id of ['arch', 'apartment']) {
      const patch = patchById(id)!;
      const orientation = roomOrientation(patch);
      near(fieldToDisplay(orientation, 0, 0).x, 0);
      near(fieldToDisplay(orientation, 0, 0).y, 0);
      near(fieldToDisplay(orientation, patch.lengthM, patch.widthM).x, patch.lengthM);
      near(fieldToDisplay(orientation, patch.lengthM, patch.widthM).y, patch.widthM);
    }
  });

  it('переводит координаты схемы обратно в поле замера', () => {
    for (const id of ['garden', 'small', 'yard', 'hall', 'corridor', 'arch', 'apartment']) {
      const patch = patchById(id)!;
      const orientation = roomOrientation(patch);
      const plan = fieldToDisplay(orientation, patch.lengthM * 0.31, patch.widthM * 0.72);
      const field = displayToField(orientation, plan.x, plan.y);
      near(field.u, patch.lengthM * 0.31);
      near(field.v, patch.widthM * 0.72);
    }
  });

  it('ставит замер ряд 1 точка 1 в правильный угол схемы', () => {
    const garden = patchById('garden')!;
    const gardenPoints = roomMeasurementPoints(garden, 113);
    const gardenCorner = gardenPoints.find(p => p.row === 1 && p.point === 1 && p.kind === 'узел')!;
    near(gardenCorner.planX, 0);
    near(gardenCorner.planY, garden.widthM);

    const small = patchById('small')!;
    const smallPoints = roomMeasurementPoints(small, 113);
    const smallCorner = smallPoints.find(p => p.row === 1 && p.point === 1 && p.kind === 'узел')!;
    near(smallCorner.planX, small.lengthM);
    near(smallCorner.planY, 0);
  });

  it('подписывает оси рядов и точек в ориентации плана', () => {
    expect(roomAxisInfo(patchById('garden')!).rowAxis).toBe('x');
    expect(roomAxisInfo(patchById('hall')!).rowAxis).toBe('y');
    expect(roomAxisInfo(patchById('yard')!).rowAxis).toBe('y');
  });
});
