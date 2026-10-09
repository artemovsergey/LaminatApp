import { SurfaceField } from '../types';

/**
 * Выравнивание этажа в единую плоскость.
 *
 * Замеры всех помещений сделаны от одной горизонтальной линии лазера,
 * поэтому значение z — расстояние от линии до пола (мм): больше z = ниже пол.
 * Целевая отметка targetZ задаёт плоскость, к которой приводится весь этаж:
 *   коррекция c = z − targetZ  →  c > 0: подмазать на c мм, c < 0: шлифовать.
 */
export interface LevelRoomInput {
  id: string;
  name: string;
  /** Фактическая площадь помещения, м². */
  areaM2: number;
  field: SurfaceField;
}

export interface RoomLevelStats {
  id: string;
  name: string;
  areaM2: number;
  minZ: number;
  maxZ: number;
  spread: number;
  meanZ: number;
  maxGrind: number;
  maxFill: number;
  grindAreaM2: number;
  fillAreaM2: number;
  okAreaM2: number;
  fillLiters: number;
  grindLiters: number;
  fillMassKg: number;
}

export interface FloorLevelTotals {
  areaM2: number;
  maxGrind: number;
  maxFill: number;
  grindAreaM2: number;
  fillAreaM2: number;
  okAreaM2: number;
  fillLiters: number;
  grindLiters: number;
  fillMassKg: number;
  fillBags: number;
  okPercent: number;
}

export interface FloorLevelResult {
  targetZ: number;
  toleranceMm: number;
  globalMinZ: number;
  globalMaxZ: number;
  medianZ: number;
  meanZ: number;
  rooms: RoomLevelStats[];
  totals: FloorLevelTotals;
}

export interface FloorReference {
  minZ: number;
  maxZ: number;
  medianZ: number;
  meanZ: number;
  areaM2: number;
}

export const FILL_DENSITY_KG_PER_L = 1.6;
export const BAG_KG = 25;

interface Sample {
  z: number;
  w: number;
}

function forEachCell(room: LevelRoomInput, cb: (z: number, w: number) => void): void {
  const { field } = room;
  const gridArea = field.lengthM * field.widthM;
  const areaScale = gridArea > 0 ? room.areaM2 / gridArea : 1;
  const w = field.stepX * field.stepY * areaScale;
  const { countX, countY } = field;

  for (let j = 0; j < countY - 1; j++) {
    for (let i = 0; i < countX - 1; i++) {
      // высота в модели отрицательна, а для выравнивания нужно расстояние от
      // лазера до пола: z = −высота
      const z =
        -(field.values[j * countX + i] +
          field.values[j * countX + i + 1] +
          field.values[(j + 1) * countX + i] +
          field.values[(j + 1) * countX + i + 1]) /
        4;
      cb(z, w);
    }
  }
}

function weightedMedian(samples: Sample[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a.z - b.z);
  let total = 0;
  for (const s of sorted) total += s.w;
  let acc = 0;
  for (const s of sorted) {
    acc += s.w;
    if (acc >= total / 2) return s.z;
  }
  return sorted[sorted.length - 1].z;
}

/** Опорные отметки этажа: самая высокая/низкая точка, медиана и среднее. */
export function computeFloorReference(rooms: LevelRoomInput[]): FloorReference {
  let minZ = Infinity;
  let maxZ = -Infinity;
  let sumWZ = 0;
  let sumW = 0;
  const samples: Sample[] = [];

  for (const room of rooms) {
    if (room.field.measuredCount === 0) continue;
    forEachCell(room, (z, w) => {
      samples.push({ z, w });
      sumWZ += z * w;
      sumW += w;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    });
  }

  if (!Number.isFinite(minZ)) {
    return { minZ: 0, maxZ: 0, medianZ: 0, meanZ: 0, areaM2: 0 };
  }

  return {
    minZ,
    maxZ,
    medianZ: weightedMedian(samples),
    meanZ: sumWZ / sumW,
    areaM2: sumW,
  };
}

function emptyTotals(): FloorLevelTotals {
  return {
    areaM2: 0,
    maxGrind: 0,
    maxFill: 0,
    grindAreaM2: 0,
    fillAreaM2: 0,
    okAreaM2: 0,
    fillLiters: 0,
    grindLiters: 0,
    fillMassKg: 0,
    fillBags: 0,
    okPercent: 0,
  };
}

/** Полный расчёт коррекций для выбранной целевой отметки. */
export function computeFloorLevel(
  rooms: LevelRoomInput[],
  targetZ: number,
  toleranceMm = 2
): FloorLevelResult {
  const roomStats: RoomLevelStats[] = [];
  const totals = emptyTotals();

  let globalMinZ = Infinity;
  let globalMaxZ = -Infinity;
  let sumWZ = 0;
  let sumW = 0;
  const samples: Sample[] = [];

  for (const room of rooms) {
    if (room.field.measuredCount === 0) continue;

    const stats: RoomLevelStats = {
      id: room.id,
      name: room.name,
      areaM2: room.areaM2,
      minZ: Infinity,
      maxZ: -Infinity,
      spread: 0,
      meanZ: 0,
      maxGrind: 0,
      maxFill: 0,
      grindAreaM2: 0,
      fillAreaM2: 0,
      okAreaM2: 0,
      fillLiters: 0,
      grindLiters: 0,
      fillMassKg: 0,
    };
    let roomSumWZ = 0;
    let roomSumW = 0;

    forEachCell(room, (z, w) => {
      samples.push({ z, w });
      roomSumWZ += z * w;
      roomSumW += w;
      sumWZ += z * w;
      sumW += w;
      if (z < stats.minZ) stats.minZ = z;
      if (z > stats.maxZ) stats.maxZ = z;
      if (z < globalMinZ) globalMinZ = z;
      if (z > globalMaxZ) globalMaxZ = z;

      const c = z - targetZ;
      if (c > 0) {
        if (c > stats.maxFill) stats.maxFill = c;
        stats.fillLiters += c * w;
      } else if (c < 0) {
        if (-c > stats.maxGrind) stats.maxGrind = -c;
        stats.grindLiters += -c * w;
      }

      if (c > toleranceMm) stats.fillAreaM2 += w;
      else if (c < -toleranceMm) stats.grindAreaM2 += w;
      else stats.okAreaM2 += w;
    });

    stats.spread = stats.maxZ - stats.minZ;
    stats.meanZ = roomSumW > 0 ? roomSumWZ / roomSumW : 0;
    stats.fillMassKg = stats.fillLiters * FILL_DENSITY_KG_PER_L;

    totals.areaM2 += room.areaM2;
    totals.grindAreaM2 += stats.grindAreaM2;
    totals.fillAreaM2 += stats.fillAreaM2;
    totals.okAreaM2 += stats.okAreaM2;
    totals.fillLiters += stats.fillLiters;
    totals.grindLiters += stats.grindLiters;
    totals.fillMassKg += stats.fillMassKg;
    if (stats.maxGrind > totals.maxGrind) totals.maxGrind = stats.maxGrind;
    if (stats.maxFill > totals.maxFill) totals.maxFill = stats.maxFill;

    roomStats.push(stats);
  }

  totals.fillBags = totals.fillMassKg / BAG_KG;
  totals.okPercent = totals.areaM2 > 0 ? (totals.okAreaM2 / totals.areaM2) * 100 : 0;

  return {
    targetZ,
    toleranceMm,
    globalMinZ: Number.isFinite(globalMinZ) ? globalMinZ : 0,
    globalMaxZ: Number.isFinite(globalMaxZ) ? globalMaxZ : 0,
    medianZ: weightedMedian(samples),
    meanZ: sumW > 0 ? sumWZ / sumW : 0,
    rooms: roomStats,
    totals,
  };
}

export interface HistogramBin {
  z: number;
  areaM2: number;
}

/** Гистограмма площадей по отметкам — для выбора целевой плоскости. */
export function buildHeightHistogram(rooms: LevelRoomInput[], binCount = 36): HistogramBin[] {
  const all: Sample[] = [];
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const room of rooms) {
    if (room.field.measuredCount === 0) continue;
    forEachCell(room, (z, w) => {
      all.push({ z, w });
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    });
  }

  if (all.length === 0) return [];

  const span = Math.max(1, maxZ - minZ);
  const binSize = span / binCount;
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    z: minZ + (i + 0.5) * binSize,
    areaM2: 0,
  }));

  for (const s of all) {
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor((s.z - minZ) / binSize)));
    bins[idx].areaM2 += s.w;
  }

  return bins;
}
