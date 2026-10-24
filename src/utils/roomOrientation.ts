import { FloorPatch } from '../data/floorProject';

/** Сторона схемы в ориентации общего плана: верх — та же сторона, что у плана. */
export type PlanSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * Ориентация поля замера относительно общего плана.
 *
 * Поле замера всегда хранится как прямоугольник lengthM × widthM:
 * u — от первого ряда вглубь, v — вдоль первого ряда. На плане комната
 * может быть повёрнута на 90° или отражена, поэтому для схемы комнаты
 * переводим (u, v) в координаты плана (x — вправо, y — вниз).
 */
export interface RoomOrientation {
  /** Ширина схемы в метрах (по горизонтали плана). */
  plotW: number;
  /** Высота схемы в метрах (по вертикали плана). */
  plotH: number;
  /** Ось u поля идёт по горизонтали схемы. */
  uHorizontal: boolean;
  /** Ось u поля направлена против горизонтали плана. */
  flipX: boolean;
  /** Ось v поля направлена против вертикали плана. */
  flipY: boolean;
  uAxis: 'x' | 'y';
  vAxis: 'x' | 'y';
}

export function roomOrientation(patch: FloorPatch): RoomOrientation {
  const uAxis: 'x' | 'y' = patch.mapX.src === 'x' ? 'x' : 'y';
  const vAxis: 'x' | 'y' = uAxis === 'x' ? 'y' : 'x';
  // mapX/mapY описывают именно оси поля u/v, а не глобальные x/y.
  const uSign = patch.mapX.sign;
  const vSign = patch.mapY.sign;
  const uHorizontal = uAxis === 'x';

  return {
    uAxis,
    vAxis,
    plotW: uHorizontal ? patch.lengthM : patch.widthM,
    plotH: uHorizontal ? patch.widthM : patch.lengthM,
    uHorizontal,
    flipX: uHorizontal ? uSign < 0 : vSign < 0,
    flipY: uHorizontal ? vSign < 0 : uSign < 0,
  };
}

/** Координаты поля замера (u, v) → координаты схемы (x, y) в ориентации плана. */
export function fieldToDisplay(
  orientation: RoomOrientation,
  u: number,
  v: number
): { x: number; y: number } {
  const x = orientation.uHorizontal ? u : v;
  const y = orientation.uHorizontal ? v : u;
  return {
    x: orientation.flipX ? orientation.plotW - x : x,
    y: orientation.flipY ? orientation.plotH - y : y,
  };
}

/** Координаты схемы (x, y) → координаты поля замера (u, v). */
export function displayToField(
  orientation: RoomOrientation,
  x: number,
  y: number
): { u: number; v: number } {
  const fx = orientation.flipX ? orientation.plotW - x : x;
  const fy = orientation.flipY ? orientation.plotH - y : y;
  return orientation.uHorizontal ? { u: fx, v: fy } : { u: fy, v: fx };
}

/** Какая ось схемы соответствует оси поля. */
export function fieldAxisOnDisplay(
  orientation: RoomOrientation,
  axis: 'x' | 'y'
): 'x' | 'y' {
  if (axis === 'x') return orientation.uHorizontal ? 'x' : 'y';
  return orientation.uHorizontal ? 'y' : 'x';
}

/** Сторона окна на схеме по глобальной стороне света. */
export function windowPlanSide(patch: FloorPatch): PlanSide | null {
  if (patch.window === 'west') return 'left';
  if (patch.window === 'east') return 'right';
  if (patch.window === 'north') return 'top';
  if (patch.window === 'south') return 'bottom';
  return null;
}
