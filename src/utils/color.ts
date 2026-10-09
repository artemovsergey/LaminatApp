export type Rgb = [number, number, number];

const NEUTRAL: Rgb = [238, 238, 238];
const GRIND: Rgb = [214, 40, 40];
const FILL: Rgb = [37, 86, 214];

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * Цвет по знаковой коррекции: + шлифовать (красный), − подмазать (синий).
 * Квадратичный корень делает малые значения заметными.
 */
export function rampColor(value: number, maxAbs: number): Rgb {
  if (!Number.isFinite(value) || value === 0) return NEUTRAL;
  const scale = maxAbs > 0 ? maxAbs : 1;
  const t = Math.min(1, Math.sqrt(Math.abs(value) / scale));
  return value > 0 ? mix(NEUTRAL, GRIND, t) : mix(NEUTRAL, FILL, t);
}

export function rgbCss(c: Rgb): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function shade(c: Rgb, intensity: number): Rgb {
  const k = Math.max(0.25, Math.min(1.35, intensity));
  return [
    Math.min(255, Math.round(c[0] * k)),
    Math.min(255, Math.round(c[1] * k)),
    Math.min(255, Math.round(c[2] * k)),
  ];
}

export function maxAbsOf(values: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < values.length; i++) {
    const v = Math.abs(values[i]);
    if (v > max) max = v;
  }
  return max;
}
