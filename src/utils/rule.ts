import {
  AngleStats,
  GridConfig,
  ProblemMap,
  Rect,
  RuleArea,
  RuleContact,
  RuleOptions,
  RulePlacement,
  RuleSimulationResult,
  RuleVerdict,
  Shape,
  SurfaceField,
} from '../types';
import { sampleMap } from './surface';
import { segmentInsideShape } from './shapes';

export const DEFAULT_RULE_OPTIONS: RuleOptions = {
  lengthM: 2,
  toleranceMm: 2,
  angleStepDeg: 15,
  positionStepM: 0.2,
  sampleCount: 65,
};

export const ANIMATION_POSITION_STEP_M = 0.08;

export type Sampler = (x: number, y: number) => number;

interface RestLine {
  startHeight: number;
  endHeight: number;
  maxGap: number;
  maxGapIndex: number;
  contacts: number[];
  contactMinT: number;
  contactMaxT: number;
}

/**
 * Верхняя выпуклая оболочка профиля (монотонная цепь).
 * Наклоны звеньев строго убывают.
 */
function upperHull(ts: number[], hs: number[]): number[] {
  const hull: number[] = [];
  for (let i = 0; i < ts.length; i++) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const cross = (ts[b] - ts[a]) * (hs[i] - hs[a]) - (hs[b] - hs[a]) * (ts[i] - ts[a]);
      if (cross >= 0) hull.pop();
      else break;
    }
    hull.push(i);
  }
  return hull;
}

/**
 * Модель опирания жёсткой линейки: линейка ложится на поверхность, не
 * проникая в неё. Устойчивые положения — звенья верхней выпуклой оболочки
 * профиля (касательные линии выше всех точек). Выбирается звено с
 * минимальным максимальным зазором — наилучшее возможное положение.
 */
export function restLine(ts: number[], hs: number[]): RestLine {
  const hull = upperHull(ts, hs);
  const n = ts.length;

  const evaluate = (ia: number, ib: number): RestLine => {
    const ta = ts[ia];
    const tb = ts[ib];
    const ha = hs[ia];
    const hb = hs[ib];
    const slope = tb === ta ? 0 : (hb - ha) / (tb - ta);
    const valueAt = (t: number) => ha + slope * (t - ta);

    let maxGap = -Infinity;
    let maxGapIndex = 0;
    const contacts: number[] = [];
    for (let i = 0; i < n; i++) {
      const gap = valueAt(ts[i]) - hs[i];
      if (gap > maxGap) {
        maxGap = gap;
        maxGapIndex = i;
      }
      if (gap <= 1e-6) contacts.push(i);
    }

    return {
      startHeight: valueAt(0),
      endHeight: valueAt(ts[n - 1]),
      maxGap,
      maxGapIndex,
      contacts,
      contactMinT: contacts.length > 0 ? ts[contacts[0]] : 0,
      contactMaxT: contacts.length > 0 ? ts[contacts[contacts.length - 1]] : 0,
    };
  };

  let best: RestLine | null = null;
  if (hull.length === 1) {
    best = evaluate(hull[0], hull[0]);
  } else {
    for (let k = 0; k < hull.length - 1; k++) {
      const cand = evaluate(hull[k], hull[k + 1]);
      if (!best || cand.maxGap < best.maxGap) best = cand;
    }
  }
  return best as RestLine;
}

export interface ProfileResult {
  ts: number[];
  hs: number[];
  line: RestLine;
  verdict: RuleVerdict;
  blameIndex: number;
}

/** Профиль поверхности вдоль линейки и вердикт по допуску. */
export function evaluateRuleProfile(
  sample: Sampler,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  options: RuleOptions
): ProfileResult {
  const n = Math.max(5, options.sampleCount);
  const ts: number[] = new Array(n);
  const hs: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const ratio = i / (n - 1);
    ts[i] = ratio * options.lengthM;
    hs[i] = sample(startX + (endX - startX) * ratio, startY + (endY - startY) * ratio);
  }

  const line = restLine(ts, hs);
  const L = options.lengthM;
  const coversStart = line.contactMinT <= 0.12 * L;
  const coversEnd = line.contactMaxT >= 0.88 * L;

  let verdict: RuleVerdict = 'pass';
  let blameIndex = line.maxGapIndex;

  if (line.maxGap > options.toleranceMm) {
    if (coversStart && coversEnd) {
      verdict = 'gap';
    } else {
      verdict = 'rock';
      let bump = line.contacts[0] ?? line.maxGapIndex;
      for (const ci of line.contacts) {
        if (hs[ci] > hs[bump]) bump = ci;
      }
      blameIndex = bump;
    }
  }

  return { ts, hs, line, verdict, blameIndex };
}

/** Одно положение линейки. */
export function simulatePlacement(
  sample: Sampler,
  angleDeg: number,
  cx: number,
  cy: number,
  options: RuleOptions
): RulePlacement {
  const rad = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const half = options.lengthM / 2;

  const startX = cx - ux * half;
  const startY = cy - uy * half;
  const endX = cx + ux * half;
  const endY = cy + uy * half;

  const profile = evaluateRuleProfile(sample, startX, startY, endX, endY, options);
  const count = profile.ts.length;

  const contacts: RuleContact[] = profile.line.contacts.map(i => {
    const ratio = i / (count - 1);
    return {
      x: startX + (endX - startX) * ratio,
      y: startY + (endY - startY) * ratio,
      t: profile.ts[i],
    };
  });

  const blameRatio = profile.blameIndex / (count - 1);
  const blameX = startX + (endX - startX) * blameRatio;
  const blameY = startY + (endY - startY) * blameRatio;

  return {
    angleDeg,
    cx,
    cy,
    startX,
    startY,
    endX,
    endY,
    startHeight: profile.line.startHeight,
    endHeight: profile.line.endHeight,
    verdict: profile.verdict,
    maxGap: profile.line.maxGap,
    contacts,
    blameX,
    blameY,
    blameAmount:
      profile.verdict === 'pass' ? 0 : Math.max(0, profile.line.maxGap - options.toleranceMm),
  };
}

function createProblemMap(bounds: Rect, stepM = 0.1): ProblemMap {
  const countX = Math.max(2, Math.round((bounds.x1 - bounds.x0) / stepM) + 1);
  const countY = Math.max(2, Math.round((bounds.y1 - bounds.y0) / stepM) + 1);
  return {
    x0: bounds.x0,
    y0: bounds.y0,
    stepX: (bounds.x1 - bounds.x0) / (countX - 1),
    stepY: (bounds.y1 - bounds.y0) / (countY - 1),
    countX,
    countY,
    grind: new Float32Array(countX * countY),
    fill: new Float32Array(countX * countY),
    failCount: new Uint16Array(countX * countY),
    totalCount: new Uint16Array(countX * countY),
    maxGap: new Float32Array(countX * countY),
  };
}

function mapIndices(map: ProblemMap, x: number, y: number): { i: number; j: number } {
  const i = Math.max(0, Math.min(map.countX - 1, Math.round((x - map.x0) / map.stepX)));
  const j = Math.max(0, Math.min(map.countY - 1, Math.round((y - map.y0) / map.stepY)));
  return { i, j };
}

function accumulatePlacement(map: ProblemMap, p: RulePlacement): void {
  const lengthM = Math.hypot(p.endX - p.startX, p.endY - p.startY);
  const pathStep = Math.min(map.stepX, map.stepY);
  const steps = Math.max(2, Math.ceil(lengthM / pathStep));
  for (let s = 0; s <= steps; s++) {
    const x = p.startX + ((p.endX - p.startX) * s) / steps;
    const y = p.startY + ((p.endY - p.startY) * s) / steps;
    const { i, j } = mapIndices(map, x, y);
    const idx = j * map.countX + i;
    map.totalCount[idx] = Math.min(65535, map.totalCount[idx] + 1);
    if (p.verdict !== 'pass') {
      map.failCount[idx] = Math.min(65535, map.failCount[idx] + 1);
      if (p.maxGap > map.maxGap[idx]) map.maxGap[idx] = p.maxGap;
    }
  }

  if (p.verdict === 'pass') return;

  const { i, j } = mapIndices(map, p.blameX, p.blameY);
  const idx = j * map.countX + i;
  if (p.verdict === 'rock') {
    if (p.blameAmount > map.grind[idx]) map.grind[idx] = p.blameAmount;
  } else if (p.blameAmount > map.fill[idx]) {
    map.fill[idx] = p.blameAmount;
  }
}

/**
 * Возможные центры линейки для заданного угла: линейка целиком внутри
 * области. Решётка с шагом stepM, включая крайние положения.
 */
export function shapePlacementCenters(
  shape: Shape,
  bounds: Rect,
  angleDeg: number,
  lengthM: number,
  stepM: number
): number[][] {
  const rad = (angleDeg * Math.PI) / 180;
  const half = lengthM / 2;
  const ux = Math.cos(rad) * half;
  const uy = Math.sin(rad) * half;

  const width = bounds.x1 - bounds.x0;
  const height = bounds.y1 - bounds.y0;
  if (width <= 0 || height <= 0) return [];

  const nx = Math.max(1, Math.ceil(width / stepM));
  const ny = Math.max(1, Math.ceil(height / stepM));
  const dx = width / nx;
  const dy = height / ny;

  const centers: number[][] = [];
  for (let j = 0; j <= ny; j++) {
    const cy = bounds.y0 + j * dy;
    for (let i = 0; i <= nx; i++) {
      const cx = bounds.x0 + i * dx;
      if (
        segmentInsideShape(shape, cx - ux, cy - uy, cx + ux, cy + uy)
      ) {
        centers.push([cx, cy]);
      }
    }
  }
  return centers;
}

/**
 * Прогон правила по всем направлениям для произвольной области (комната или
 * объединённый контур). Результат агрегируется в карту проблем.
 */
export function simulateAreaRule(
  area: RuleArea,
  options: RuleOptions = DEFAULT_RULE_OPTIONS
): RuleSimulationResult {
  const problemMap = createProblemMap(area.bounds);
  const angles: AngleStats[] = [];
  const worst: RulePlacement[] = [];

  let totalFails = 0;
  let rockFails = 0;
  let gapFails = 0;
  let totalPlacements = 0;

  const angleCount = Math.max(1, Math.round(180 / options.angleStepDeg));

  for (let a = 0; a < angleCount; a++) {
    const angleDeg = a * options.angleStepDeg;
    const centers = shapePlacementCenters(
      area.shape,
      area.bounds,
      angleDeg,
      options.lengthM,
      options.positionStepM
    );
    let fails = 0;
    let maxGap = 0;

    for (const [cx, cy] of centers) {
      const p = simulatePlacement(area.sampler, angleDeg, cx, cy, options);
      accumulatePlacement(problemMap, p);
      totalPlacements++;

      if (p.verdict === 'pass') continue;

      fails++;
      totalFails++;
      if (p.verdict === 'rock') rockFails++;
      else gapFails++;
      if (p.maxGap > maxGap) maxGap = p.maxGap;
      worst.push(p);
    }

    angles.push({ angleDeg, placements: centers.length, fails, maxGap });
  }

  worst.sort((a, b) => b.maxGap - a.maxGap);
  const topWorst = worst.slice(0, 40);

  return {
    placements: topWorst,
    angles,
    problemMap,
    totalPlacements,
    totalFails,
    rockFails,
    gapFails,
    worst: topWorst,
    options,
  };
}

/** Все положения линейки одного угла по порядку движения (для анимации). */
export function simulateAreaAngle(
  area: RuleArea,
  angleDeg: number,
  options: RuleOptions,
  stepM = ANIMATION_POSITION_STEP_M
): RulePlacement[] {
  const centers = shapePlacementCenters(
    area.shape,
    area.bounds,
    angleDeg,
    options.lengthM,
    stepM
  );

  const scanX = area.scanX ?? 0;
  const scanY = area.scanY ?? 0;
  if (scanX !== 0 || scanY !== 0) {
    centers.sort((a, b) => scanX * a[0] + scanY * a[1] - (scanX * b[0] + scanY * b[1]));
  }

  return centers.map(([x, y]) => simulatePlacement(area.sampler, angleDeg, x, y, options));
}

/** Совместимый прогон по всей прямоугольной комнате (тесты). */
export function simulateRule(
  field: SurfaceField,
  grid: GridConfig,
  options: RuleOptions = DEFAULT_RULE_OPTIONS
): RuleSimulationResult {
  const rect: Rect = { x0: 0, y0: 0, x1: grid.lengthM, y1: grid.widthM };
  return simulateAreaRule(
    { bounds: rect, shape: { rects: [rect] }, sampler: (x, y) => sampleMap(field, x, y) },
    options
  );
}

/** Совместимое одно положение по полю (тесты). */
export function simulateFieldPlacement(
  field: SurfaceField,
  angleDeg: number,
  cx: number,
  cy: number,
  options: RuleOptions
): RulePlacement {
  return simulatePlacement((x, y) => sampleMap(field, x, y), angleDeg, cx, cy, options);
}
