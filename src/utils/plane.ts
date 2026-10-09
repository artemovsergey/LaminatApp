import { Plane, ScalarMap } from '../types';

/**
 * МНК-подгонка плоскости h(x, y) = a * x + b * y + c по значениям высот (мм).
 * Координаты — в метрах. Используется центрированная система, что устойчиво
 * к большим абсолютным координатам.
 */
export function computePlane(heights: number[] | Float32Array, xs: number[], ys: number[]): Plane {
  const n = heights.length;
  if (n === 0) return { a: 0, b: 0, c: 0 };

  let xm = 0;
  let ym = 0;
  let zm = 0;
  for (let i = 0; i < n; i++) {
    xm += xs[i];
    ym += ys[i];
    zm += heights[i];
  }
  xm /= n;
  ym /= n;
  zm /= n;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let sxz = 0;
  let syz = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xm;
    const dy = ys[i] - ym;
    const dz = heights[i] - zm;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
    sxz += dx * dz;
    syz += dy * dz;
  }

  const det = sxx * syy - sxy * sxy;
  if (Math.abs(det) < 1e-9) {
    return { a: 0, b: 0, c: zm };
  }

  const a = (sxz * syy - syz * sxy) / det;
  const b = (syz * sxx - sxz * sxy) / det;
  const c = zm - a * xm - b * ym;
  return { a, b, c };
}

export function planeValue(plane: Plane, x: number, y: number): number {
  return plane.a * x + plane.b * y + plane.c;
}

export function computePlaneFromMap(map: ScalarMap): Plane {
  const n = map.countX * map.countY;
  if (n === 0) return { a: 0, b: 0, c: 0 };

  let xs = 0;
  let ys = 0;
  let zm = 0;
  for (let j = 0; j < map.countY; j++) {
    for (let i = 0; i < map.countX; i++) {
      xs += i * map.stepX;
      ys += j * map.stepY;
      zm += map.values[j * map.countX + i];
    }
  }
  const xm = xs / n;
  const ym = ys / n;
  zm /= n;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let sxz = 0;
  let syz = 0;
  for (let j = 0; j < map.countY; j++) {
    const dy = j * map.stepY - ym;
    for (let i = 0; i < map.countX; i++) {
      const dx = i * map.stepX - xm;
      const dz = map.values[j * map.countX + i] - zm;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
      sxz += dx * dz;
      syz += dy * dz;
    }
  }

  const det = sxx * syy - sxy * sxy;
  if (Math.abs(det) < 1e-9) {
    return { a: 0, b: 0, c: zm };
  }

  const a = (sxz * syy - syz * sxy) / det;
  const b = (syz * sxx - sxz * sxy) / det;
  const c = zm - a * xm - b * ym;
  return { a, b, c };
}
