import { FloorPatch } from '../data/floorProject';

/** Сторона проекции комнаты. */
export type PlanSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * Ориентация проекции комнаты.
 *
 * Поле замера хранится как прямоугольник lengthM × widthM:
 * u — вдоль первого ряда, v — вглубь от окна. На отдельной проекции
 * ряды всегда идут слева направо, а точки — снизу вверх, поэтому
 * проекция не зависит от поворота комнаты на общем плане.
 */
export interface RoomOrientation {
  /** Ширина проекции в метрах: вдоль рядов. */
  plotW: number;
  /** Высота проекции в метрах: вдоль точек. */
  plotH: number;
  /** Ось поля, вдоль которой идут ряды. */
  rowFieldAxis: 'x' | 'y';
}

export function roomOrientation(patch: FloorPatch): RoomOrientation {
  const rowFieldAxis: 'x' | 'y' = patch.transposeMeasurements ? 'x' : 'y';
  return {
    rowFieldAxis,
    plotW: rowFieldAxis === 'x' ? patch.lengthM : patch.widthM,
    plotH: rowFieldAxis === 'x' ? patch.widthM : patch.lengthM,
  };
}

/**
 * Координаты поля замера (u, v) → координаты проекции (x, y).
 * Ряд 1 и точка 1 всегда оказываются в левом нижнем углу.
 */
export function fieldToDisplay(
  orientation: RoomOrientation,
  u: number,
  v: number
): { x: number; y: number } {
  if (orientation.rowFieldAxis === 'x') {
    return { x: u, y: orientation.plotH - v };
  }
  return { x: v, y: orientation.plotH - u };
}

/** Координаты проекции (x, y) → координаты поля замера (u, v). */
export function displayToField(
  orientation: RoomOrientation,
  x: number,
  y: number
): { u: number; v: number } {
  if (orientation.rowFieldAxis === 'x') {
    return { u: x, v: orientation.plotH - y };
  }
  return { u: orientation.plotH - y, v: x };
}

/** Сторона окна на проекции комнаты: окно всегда слева. */
export function windowPlanSide(patch: FloorPatch): PlanSide | null {
  return patch.window ? 'left' : null;
}
