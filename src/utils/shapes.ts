import { Rect, Shape } from '../types';

export function rect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
}

export function rectWidth(r: Rect): number {
  return r.x1 - r.x0;
}

export function rectHeight(r: Rect): number {
  return r.y1 - r.y0;
}

export function rectCenter(r: Rect): { x: number; y: number } {
  return { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
}

export function shapeBounds(rects: Rect[]): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    if (r.x0 < x0) x0 = r.x0;
    if (r.y0 < y0) y0 = r.y0;
    if (r.x1 > x1) x1 = r.x1;
    if (r.y1 > y1) y1 = r.y1;
  }
  if (!Number.isFinite(x0)) return rect(0, 0, 0, 0);
  return { x0, y0, x1, y1 };
}

export function shapeArea(shape: Shape): number {
  let area = 0;
  for (const r of shape.rects) area += rectWidth(r) * rectHeight(r);
  return area;
}

export function rectContains(r: Rect, x: number, y: number, eps = 1e-9): boolean {
  return x >= r.x0 - eps && x <= r.x1 + eps && y >= r.y0 - eps && y <= r.y1 + eps;
}

export function shapeContains(shape: Shape, x: number, y: number, eps = 1e-9): boolean {
  for (const r of shape.rects) {
    if (rectContains(r, x, y, eps)) return true;
  }
  return false;
}

/** Расстояние от точки до прямоугольника (0 внутри). */
export function rectDistance(r: Rect, x: number, y: number): number {
  const dx = Math.max(r.x0 - x, 0, x - r.x1);
  const dy = Math.max(r.y0 - y, 0, y - r.y1);
  return Math.hypot(dx, dy);
}

/**
 * Отрезок целиком внутри объединения прямоугольников.
 * Точное покрытие параметра t ∈ [0, 1] интервалами пересечений с прямоугольниками.
 */
export function segmentInsideShape(
  shape: Shape,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  eps = 1e-7
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const intervals: [number, number][] = [];

  for (const r of shape.rects) {
    let t0 = 0;
    let t1 = 1;
    let ok = true;

    const clip = (p: number, q: number): boolean => {
      if (Math.abs(p) < 1e-12) return q >= 0;
      const t = q / p;
      if (p < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
      return true;
    };

    ok = clip(-dx, x0 - r.x0);
    if (ok) ok = clip(dx, r.x1 - x0);
    if (ok) ok = clip(-dy, y0 - r.y0);
    if (ok) ok = clip(dy, r.y1 - y0);

    if (ok && t1 >= t0 - eps) intervals.push([t0, t1]);
  }

  if (intervals.length === 0) return false;
  intervals.sort((a, b) => a[0] - b[0]);

  let covered = 0;
  for (const [a, b] of intervals) {
    if (b <= covered + eps) continue;
    if (a > covered + eps) return false;
    covered = Math.max(covered, b);
    if (covered >= 1 - eps) return true;
  }
  return covered >= 1 - eps;
}
