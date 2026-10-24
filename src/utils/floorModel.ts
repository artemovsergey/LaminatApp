import { MeasurementGrid, Rect, RuleArea, Shape, SurfaceField } from '../types';
import {
  APARTMENT_PATCHES,
  APARTMENT_ZONES,
  FLOOR_PATCHES,
  FloorPatch,
  FloorZoneDef,
  FLOOR_ZONES,
  patchGlobalToLocal,
} from '../data/floorProject';
import { buildSurface, sampleMap } from '../utils/surface';
import { rectDistance } from '../utils/shapes';

const SEAM_BAND_M = 0.15;
export const ZONE_DENSE_STEP_M = 0.05;

export interface PatchModel {
  def: FloorPatch;
  field: SurfaceField;
}

export interface ZoneModel {
  def: FloorZoneDef;
  field: SurfaceField;
  /** Форма зоны в локальных координатах поля (от bounds.x0, bounds.y0). */
  shapeLocal: Shape;
  /** Высоты (мм, выше = больше) в глобальных координатах. */
  sample(x: number, y: number): number;
  measuredCount: number;
}

export interface FloorModel {
  patches: PatchModel[];
  zones: ZoneModel[];
  bounds: Rect;
}

function samplePatchGlobal(patch: FloorPatch, field: SurfaceField, x: number, y: number): number {
  const { u, v } = patchGlobalToLocal(patch, x, y);
  return sampleMap(field, u, v);
}

/** Сшивка участков на стыках (арка): взвешенное смешивание в полосе стыка. */
function samplePatches(patches: PatchModel[], x: number, y: number): number {
  let sum = 0;
  let weight = 0;
  let bestDist = Infinity;
  let bestPatch: PatchModel | null = null;

  for (const p of patches) {
    const d = rectDistance(p.def.rect, x, y);
    if (d < bestDist) {
      bestDist = d;
      bestPatch = p;
    }
    if (d < SEAM_BAND_M) {
      const w = 1 - d / SEAM_BAND_M;
      sum += samplePatchGlobal(p.def, p.field, x, y) * w;
      weight += w;
    }
  }

  if (weight > 0) return sum / weight;
  if (bestPatch) return samplePatchGlobal(bestPatch.def, bestPatch.field, x, y);
  return 0;
}

function buildZoneField(zone: FloorZoneDef, patches: PatchModel[]): SurfaceField {
  const { bounds } = zone;
  const lengthM = bounds.x1 - bounds.x0;
  const widthM = bounds.y1 - bounds.y0;

  const countX = Math.max(2, Math.min(401, Math.round(lengthM / ZONE_DENSE_STEP_M) + 1));
  const countY = Math.max(2, Math.min(401, Math.round(widthM / ZONE_DENSE_STEP_M) + 1));
  const stepX = lengthM / (countX - 1);
  const stepY = widthM / (countY - 1);

  const values = new Float32Array(countX * countY);
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (let j = 0; j < countY; j++) {
    const y = bounds.y0 + j * stepY;
    for (let i = 0; i < countX; i++) {
      const x = bounds.x0 + i * stepX;
      const value = samplePatches(patches, x, y);
      values[j * countX + i] = value;
      if (value < minHeight) minHeight = value;
      if (value > maxHeight) maxHeight = value;
    }
  }

  let measuredCount = 0;
  for (const p of patches) measuredCount += p.field.measuredCount;

  return {
    stepX,
    stepY,
    countX,
    countY,
    values,
    lengthM,
    widthM,
    fineHeights: [],
    maxHeight: Number.isFinite(maxHeight) ? maxHeight : 0,
    minHeight: Number.isFinite(minHeight) ? minHeight : 0,
    measuredCount,
  };
}

function shapeToLocal(shape: Shape, bounds: Rect): Shape {
  return {
    rects: shape.rects.map(r => ({
      x0: r.x0 - bounds.x0,
      y0: r.y0 - bounds.y0,
      x1: r.x1 - bounds.x0,
      y1: r.y1 - bounds.y0,
    })),
  };
}

function buildModel(
  patchDefs: FloorPatch[],
  zoneDefs: FloorZoneDef[],
  measurements: Record<string, MeasurementGrid> = {}
): FloorModel {
  const patches: PatchModel[] = patchDefs.map(def => {
    const data = measurements[def.id] ?? def.measurements;
    return { def, field: buildSurface(data, def.grid) };
  });

  const patchMap = new Map(patches.map(p => [p.def.id, p]));

  const zones: ZoneModel[] = zoneDefs.map(def => {
    const zonePatches = def.patchIds.map(id => {
      const p = patchMap.get(id);
      if (!p) throw new Error(`Неизвестный участок зоны ${def.id}: ${id}`);
      return p;
    });
    const field = buildZoneField(def, zonePatches);
    return {
      def,
      field,
      shapeLocal: shapeToLocal(def.shape, def.bounds),
      sample: (x: number, y: number) => sampleMap(field, x - def.bounds.x0, y - def.bounds.y0),
      measuredCount: field.measuredCount,
    };
  });

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of patches) {
    if (p.def.rect.x0 < x0) x0 = p.def.rect.x0;
    if (p.def.rect.y0 < y0) y0 = p.def.rect.y0;
    if (p.def.rect.x1 > x1) x1 = p.def.rect.x1;
    if (p.def.rect.y1 > y1) y1 = p.def.rect.y1;
  }

  return { patches, zones, bounds: { x0, y0, x1, y1 } };
}

/** Строит и кэширует модель всего этажа: поля участков и зон симуляции. */
export function buildFloorModel(
  measurements: Record<string, MeasurementGrid> = {}
): FloorModel {
  return buildModel(FLOOR_PATCHES, FLOOR_ZONES, measurements);
}

/** Отдельная модель комнаты в квартире — не смешивается с этажом. */
export function buildApartmentModel(
  measurements: Record<string, MeasurementGrid> = {}
): FloorModel {
  return buildModel(APARTMENT_PATCHES, APARTMENT_ZONES, measurements);
}

export function patchModelById(model: FloorModel, id: string): PatchModel {
  const p = model.patches.find(v => v.def.id === id);
  if (!p) throw new Error(`Нет участка ${id}`);
  return p;
}

export function zoneModelById(model: FloorModel, id: string): ZoneModel {
  const z = model.zones.find(v => v.def.id === id);
  if (!z) throw new Error(`Нет зоны ${id}`);
  return z;
}

/** Область симуляции правила по зоне (глобальные координаты). */
export function zoneRuleArea(zone: ZoneModel): RuleArea {
  return {
    bounds: zone.def.bounds,
    shape: zone.def.shape,
    sampler: zone.sample,
    scanX: zone.def.scanX,
    scanY: zone.def.scanY,
  };
}
