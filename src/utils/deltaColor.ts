/**
 * Единая палитра отклонений: красный — бугор (снять), синий — яма (подмазать).
 * Внутри допуска цвет почти нейтральный, чтобы глаза не цеплялись за шум.
 */
export type DeltaRgb = [number, number, number];

const MAP_NEUTRAL: DeltaRgb = [226, 232, 240];
const SURFACE_NEUTRAL: DeltaRgb = [100, 116, 139];
const FILL_BASE: DeltaRgb = [191, 219, 254];
const FILL_DEEP: DeltaRgb = [29, 78, 216];
const GRIND_BASE: DeltaRgb = [254, 226, 226];
const GRIND_DEEP: DeltaRgb = [185, 28, 28];

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

function mix(a: DeltaRgb, b: DeltaRgb, t: number): DeltaRgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function deltaRgb(
  deltaMm: number,
  toleranceMm: number,
  scaleMm: number,
  variant: 'map' | 'surface' = 'map'
): DeltaRgb {
  const abs = Math.abs(deltaMm);
  const scale = Math.max(scaleMm, toleranceMm + 1);
  const neutral = variant === 'map' ? MAP_NEUTRAL : SURFACE_NEUTRAL;
  const base = deltaMm >= 0
    ? variant === 'map' ? FILL_BASE : [96, 165, 250] as DeltaRgb
    : variant === 'map' ? GRIND_BASE : [248, 113, 113] as DeltaRgb;
  const deep = deltaMm >= 0 ? FILL_DEEP : GRIND_DEEP;

  if (abs <= toleranceMm) {
    const t = toleranceMm > 0 ? (abs / toleranceMm) * 0.22 : 0;
    return mix(neutral, base, t);
  }

  const t = clamp01((abs - toleranceMm) / Math.max(1, scale - toleranceMm));
  return mix(base, deep, Math.pow(t, 0.7));
}

export function cssRgb(rgb: DeltaRgb, alpha = 1): string {
  return alpha >= 1 ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}
