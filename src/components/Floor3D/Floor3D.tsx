import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Floor3D.module.css';
import { AnalysisResult, RulePlacement, RuleSimulationResult, ViewLayer } from '../../types';
import { FloorModel } from '../../utils/floorModel';
import { FloorPatch, patchGlobalToLocal, patchLocalToGlobal } from '../../data/floorProject';
import { getFloorPlanGeometry } from '../../utils/floorPlanGeometry';
import { sampleMap } from '../../utils/surface';
import { sampleProblem } from '../../utils/analysis';
import { rampColor, shade, Rgb, rgbCss } from '../../utils/color';

interface Props {
  model: FloorModel;
  rules: Record<string, RuleSimulationResult>;
  analyses: Record<string, AnalysisResult>;
  layer: ViewLayer;
  activeZoneId: string;
  currentPlacement: RulePlacement | null;
  mode?: 'analysis' | 'leveling' | 'layout';
  targetZ?: number;
  toleranceMm?: number;
  layoutPattern?: LayoutPattern;
  continuousLayout?: boolean;
  protectVisibleLanes?: boolean;
  showUnderlay?: boolean;
}

export type LayoutPattern = 'half' | 'third' | 'diagonal' | 'herringbone';

interface PatchMesh {
  patch: FloorPatch;
  sceneRoom?: SceneRoom;
  mx: number;
  my: number;
  gx: Float32Array;
  gy: Float32Array;
  h: Float32Array;
}

const MESH_STEP_M = 0.16;

interface SceneRoom {
  x: number;
  y: number;
  width: number;
  depth: number;
}

function sceneRooms(model: FloorModel): Record<string, SceneRoom> {
  return getFloorPlanGeometry(model).rooms;
}

function planCoordinates(
  id: string,
  room: SceneRoom,
  u: number,
  v: number
): { x: number; y: number } {
  switch (id) {
    case 'garden':
      return { x: room.x + u, y: room.y + room.depth - v };
    case 'small':
      return { x: room.x + room.width - u, y: room.y + v };
    case 'corridor':
      return { x: room.x + room.width - u, y: room.y + v };
    case 'hall':
      return { x: room.x + room.width - u, y: room.y + room.depth - v };
    case 'yard':
      return { x: room.x + room.width - v, y: room.y + room.depth - u };
    case 'arch':
      return { x: room.x + u, y: room.y + v };
    default:
      return { x: room.x + u, y: room.y + v };
  }
}

function localCoordinates(
  id: string,
  room: SceneRoom,
  x: number,
  y: number
): { u: number; v: number } {
  switch (id) {
    case 'garden':
      return { u: x - room.x, v: room.y + room.depth - y };
    case 'small':
      return { u: room.x + room.width - x, v: room.y + room.depth - y };
    case 'corridor':
      return { u: room.x + room.width - x, v: y - room.y };
    case 'hall':
      return { u: room.x + room.width - x, v: room.y + room.depth - y };
    case 'yard':
      return { u: room.y + room.depth - y, v: room.x + room.width - x };
    case 'arch':
      return { u: x - room.x, v: y - room.y };
    default:
      return { u: x - room.x, v: y - room.y };
  }
}

function buildMesh(model: FloorModel, levelView: boolean): PatchMesh[] {
  const rooms = levelView ? sceneRooms(model) : undefined;
  return model.patches
    .filter(({ def }) => !levelView || def.kind !== 'sill')
    .map(({ def, field }) => {
    const mx = Math.max(2, Math.min(64, Math.round(def.lengthM / MESH_STEP_M)));
    const my = Math.max(2, Math.min(64, Math.round(def.widthM / MESH_STEP_M)));
    const count = (mx + 1) * (my + 1);
    const gx = new Float32Array(count);
    const gy = new Float32Array(count);
    const h = new Float32Array(count);
    for (let j = 0; j <= my; j++) {
      const v = (j / my) * def.widthM;
      for (let i = 0; i <= mx; i++) {
        const u = (i / mx) * def.lengthM;
        const idx = j * (mx + 1) + i;
        const room = rooms?.[def.id];
        const g = room ? planCoordinates(def.id, room, u, v) : patchLocalToGlobal(def, u, v);
        gx[idx] = g.x;
        gy[idx] = g.y;
        h[idx] = sampleMap(field, u, v);
      }
    }
    return { patch: def, sceneRoom: rooms?.[def.id], mx, my, gx, gy, h };
    });
}

interface WalkWaypoint {
  x: number;
  y: number;
  room: string;
}

function buildWalkPath(model: FloorModel): WalkWaypoint[] {
  const rooms = sceneRooms(model);
  const garden = rooms.garden;
  const small = rooms.small;
  const corridor = rooms.corridor;
  const hall = rooms.hall;
  const yard = rooms.yard;
  const c = (room: SceneRoom) => ({ x: room.x + room.width / 2, y: room.y + room.depth / 2 });
  const corridorCenter = c(corridor);
  const gardenDoor = { x: 1, y: garden.y + garden.depth, room: 'Коридор' };
  const smallDoor = { x: 3, y: small.y + small.depth, room: 'Коридор' };
  const archDoor = { x: rooms.arch.x + rooms.arch.width / 2, y: hall.y, room: 'Зал' };
  const yardDoor = { x: yard.x + yard.width / 2, y: corridor.y + corridor.depth, room: 'Комната во двор' };
  return [
    { ...corridorCenter, room: 'Коридор' },
    gardenDoor,
    { ...c(garden), room: 'Комната на огород' },
    gardenDoor,
    { ...corridorCenter, room: 'Коридор' },
    smallDoor,
    { ...c(small), room: 'Малая комната' },
    smallDoor,
    { ...corridorCenter, room: 'Коридор' },
    archDoor,
    { ...c(hall), room: 'Зал' },
    { x: hall.x + hall.width / 2, y: hall.y + hall.depth - 0.25, room: 'Зал' },
    { ...c(hall), room: 'Зал' },
    archDoor,
    yardDoor,
    { x: yardDoor.x, y: yard.y + yard.depth / 2, room: 'Комната во двор' },
    { x: yard.x + 0.3, y: yard.y + yard.depth - 0.25, room: 'Комната во двор' },
    { x: yard.x + yard.width / 2, y: yard.y + yard.depth - 0.25, room: 'Комната во двор' },
  ];
}

function routeLength(path: WalkWaypoint[]): number {
  return path.slice(1).reduce((total, point, index) => {
    const previous = path[index];
    return total + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

function walkerAt(path: WalkWaypoint[], distance: number): WalkWaypoint & { nextX: number; nextY: number } {
  let remaining = distance;
  for (let index = 1; index < path.length; index++) {
    const from = path[index - 1];
    const to = path[index];
    const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
    if (remaining <= segmentLength || index === path.length - 1) {
      const t = segmentLength === 0 ? 0 : Math.min(1, remaining / segmentLength);
      return {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        room: to.room,
        nextX: to.x,
        nextY: to.y,
      };
    }
    remaining -= segmentLength;
  }
  const last = path[path.length - 1];
  return { ...last, nextX: last.x, nextY: last.y };
}

function layoutOrientation(id: string): 'x' | 'y' {
  return id === 'garden' || id === 'small' ? 'x' : 'y';
}

function drawFlooringLayout(
  ctx: CanvasRenderingContext2D,
  meshes: PatchMesh[],
  project: (x: number, y: number, z: number) => number[],
  targetZ: number,
  pattern: LayoutPattern,
  continuous: boolean,
  protectVisibleLanes: boolean,
  showUnderlay: boolean,
  canvasWidth: number
) {
  const plankLength = 1.2;
  const plankWidth = 0.127;
  const pitch = pattern === 'herringbone' ? plankLength + plankWidth : plankWidth;
  const colors = ['#93613f', '#865638', '#9d6946', '#784a31', '#a16d49'];
  const floorMeshes = meshes.filter(mesh => mesh.sceneRoom);
  const worldAnchorX = floorMeshes.reduce(
    (sum, mesh) => sum + (mesh.sceneRoom!.x + mesh.sceneRoom!.width / 2),
    0
  ) / Math.max(1, floorMeshes.length);
  const worldAnchorY = floorMeshes.reduce(
    (sum, mesh) => sum + (mesh.sceneRoom!.y + mesh.sceneRoom!.depth / 2),
    0
  ) / Math.max(1, floorMeshes.length);

  for (const mesh of floorMeshes) {
    const room = mesh.sceneRoom!;
    const connected = mesh.patch.id === 'hall' || mesh.patch.id === 'corridor' || mesh.patch.id === 'arch';
    const axis = continuous || connected ? 'y' : layoutOrientation(mesh.patch.id);
    const bounds = [
      [room.x, room.y],
      [room.x + room.width, room.y],
      [room.x + room.width, room.y + room.depth],
      [room.x, room.y + room.depth],
    ].map(([x, y]) => project(x, y, -targetZ));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bounds[0][0], bounds[0][1]);
    for (let i = 1; i < bounds.length; i++) ctx.lineTo(bounds[i][0], bounds[i][1]);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = '#765034';
    ctx.fillRect(0, 0, canvasWidth * 2, canvasWidth * 2);
    if (showUnderlay) {
      const sheetX = continuous ? worldAnchorX : room.x;
      const sheetY = continuous ? worldAnchorY : room.y;
      for (let y = Math.floor((room.y - sheetY) / 0.5) * 0.5 + sheetY; y < room.y + room.depth; y += 0.5) {
        for (let x = Math.floor((room.x - sheetX) / 0.75) * 0.75 + sheetX; x < room.x + room.width; x += 0.75) {
          const tile = [
            project(x, y, -targetZ + 1),
            project(x + 0.75, y, -targetZ + 1),
            project(x + 0.75, y + 0.5, -targetZ + 1),
            project(x, y + 0.5, -targetZ + 1),
          ];
          ctx.beginPath();
          ctx.moveTo(tile[0][0], tile[0][1]);
          for (let i = 1; i < tile.length; i++) ctx.lineTo(tile[i][0], tile[i][1]);
          ctx.closePath();
          ctx.fillStyle = '#dbeaf0';
          ctx.fill();
          ctx.strokeStyle = '#7199a7';
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    } else {
      const shortStart = axis === 'x' ? room.y : room.x;
      const shortLength = axis === 'x' ? room.depth : room.width;
      const longStart = axis === 'x' ? room.x : room.y;
      const longLength = axis === 'x' ? room.width : room.depth;
      const anchored = continuous
        ? (axis === 'x' ? worldAnchorX : worldAnchorY)
        : connected
          ? (axis === 'x' ? 0 : floorMeshes.find(item => item.patch.id === 'corridor')?.sceneRoom?.y ?? longStart)
          : longStart;
      const visible = protectVisibleLanes
        ? (axis === 'x' ? room.x + room.width * 0.7 : room.y + room.depth * 0.18)
        : anchored;
      const phase = pattern === 'third' ? plankLength / 3 : plankLength / 2;
      const origin = continuous
        ? anchored - ((anchored - visible + plankLength / 2) % plankLength + plankLength) % plankLength
        : connected
          ? anchored
          : visible - plankLength / 2;
      const rowStart = continuous
        ? Math.floor((shortStart - (axis === 'x' ? worldAnchorY : worldAnchorX)) / pitch) * pitch +
          (axis === 'x' ? worldAnchorY : worldAnchorX)
        : shortStart;

      if (pattern === 'diagonal') {
        const centerX = continuous ? worldAnchorX : room.x + room.width / 2;
        const centerY = continuous ? worldAnchorY : room.y + room.depth / 2;
        const reach = Math.hypot(room.width, room.depth) * 1.5;
        const cos = Math.SQRT1_2;
        const sin = Math.SQRT1_2;
        const firstRow = Math.floor(-reach / pitch);
        const lastRow = Math.ceil(reach / pitch);
        for (let row = firstRow; row <= lastRow; row++) {
          const rowOffset = row * pitch;
          const lengthStart = Math.floor(-reach / plankLength) * plankLength;
          for (let along = lengthStart; along < reach; along += plankLength) {
            const corners = [
              [along, rowOffset],
              [along + plankLength, rowOffset],
              [along + plankLength, rowOffset + plankWidth],
              [along, rowOffset + plankWidth],
            ].map(([u, v]) => {
              const x = centerX + u * cos - v * sin;
              const y = centerY + u * sin + v * cos;
              return project(x, y, -targetZ + 1);
            });
            ctx.beginPath();
            ctx.moveTo(corners[0][0], corners[0][1]);
            for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i][0], corners[i][1]);
            ctx.closePath();
            ctx.fillStyle = colors[(row - firstRow) % colors.length];
            ctx.fill();
            ctx.strokeStyle = '#493222';
            ctx.lineWidth = 0.65;
            ctx.stroke();
          }
        }
      } else if (pattern === 'herringbone') {
        const module = plankLength + plankWidth;
        const pitch = module / 2;
        const originX = continuous ? worldAnchorX : connected ? 0 : room.x;
        const originY = continuous ? worldAnchorY : connected ? 0 : room.y;
        const startX = originX + Math.floor((room.x - originX) / pitch) * pitch - module;
        const startY = originY + Math.floor((room.y - originY) / pitch) * pitch - module;
        const drawBoard = (x: number, y: number, width: number, depth: number, shadeIndex: number) => {
          const corners = [
            [x, y],
            [x + width, y],
            [x + width, y + depth],
            [x, y + depth],
          ].map(([px, py]) => project(px, py, -targetZ + 1));
          ctx.beginPath();
          ctx.moveTo(corners[0][0], corners[0][1]);
          for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i][0], corners[i][1]);
          ctx.closePath();
          ctx.fillStyle = colors[shadeIndex % colors.length];
          ctx.fill();
          ctx.strokeStyle = '#493222';
          ctx.lineWidth = 0.55;
          ctx.stroke();
        };
        for (let y = startY, row = 0; y < room.y + room.depth + module; y += pitch, row++) {
          for (let x = startX, col = 0; x < room.x + room.width + module; x += pitch, col++) {
            const flip = (row + col) % 2 === 1;
            const boards = flip
              ? [
                  [x + plankLength, y, plankWidth, plankLength],
                  [x - plankLength + plankWidth, y + plankLength - plankWidth, plankLength, plankWidth],
                ]
              : [
                  [x, y, plankWidth, plankLength],
                  [x + plankWidth, y + plankLength - plankWidth, plankLength, plankWidth],
                ];
            for (const [px, py, boardWidth, boardDepth] of boards) {
              drawBoard(px, py, boardWidth, boardDepth, row + col);
            }
          }
        }
      } else {
        let row = 0;
        for (let cross = rowStart; cross < shortStart + shortLength; cross += pitch, row++) {
          const stagger = (row % 2) * phase;
          let along = origin + stagger;
          while (along > longStart) along -= plankLength;
          for (; along < longStart + longLength; along += plankLength) {
            const x0 = axis === 'x' ? along : cross;
            const y0 = axis === 'x' ? cross : along;
            const x1 = axis === 'x' ? along + plankLength : cross + plankWidth;
            const y1 = axis === 'x' ? cross + plankWidth : along + plankLength;
            const corners = [
              [x0, y0],
              [x1, y0],
              [x1, y1],
              [x0, y1],
            ].map(([x, y]) => project(x, y, -targetZ + 1));
            ctx.beginPath();
            ctx.moveTo(corners[0][0], corners[0][1]);
            for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i][0], corners[i][1]);
            ctx.closePath();
            ctx.fillStyle = colors[(row + Math.abs(Math.floor(along / plankLength))) % colors.length];
            ctx.fill();
            ctx.strokeStyle = '#493222';
            ctx.lineWidth = 0.65;
            ctx.stroke();
          }
        }
      }
    }

    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(bounds[0][0], bounds[0][1]);
    for (let i = 1; i < bounds.length; i++) ctx.lineTo(bounds[i][0], bounds[i][1]);
    ctx.closePath();
    ctx.strokeStyle = '#39271d';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

}

function drawUnmeasuredPlanAreas(
  ctx: CanvasRenderingContext2D,
  project: (x: number, y: number, z: number) => number[],
  targetZ: number,
  model: FloorModel
) {
  const geometry = getFloorPlanGeometry(model);
  const areas = [
    { name: 'Лестница', rect: geometry.stair, fill: '#e8e8e4', hatch: true },
    { name: 'Санузел', rect: geometry.wc, fill: '#e8eef0', hatch: false },
  ];
  for (const area of areas) {
    const { x, y, width, depth } = area.rect;
    const corners = [
      [x, y],
      [x + width, y],
      [x + width, y + depth],
      [x, y + depth],
    ].map(([px, py]) => project(px, py, -targetZ));
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i][0], corners[i][1]);
    ctx.closePath();
    ctx.fillStyle = area.fill;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = '#a7b0b6';
    ctx.lineWidth = 0.8;
    const start = Math.floor((x - y) / 0.18) * 0.18;
    for (let offset = start; offset < x + width - y + depth; offset += 0.18) {
      const a = project(x + offset, y, -targetZ + 0.5);
      const b = project(x + offset + depth, y + depth, -targetZ + 0.5);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#54616a';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i][0], corners[i][1]);
    ctx.closePath();
    ctx.stroke();
    const center = project(x + width / 2, y + depth / 2, -targetZ - 1);
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#374151';
    ctx.fillText(area.name, center[0], center[1]);
  }
}

function useContainerWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export function Floor3D({
  model,
  rules,
  analyses,
  layer,
  activeZoneId,
  currentPlacement,
  mode = 'analysis',
  targetZ = 0,
  toleranceMm = 2,
  layoutPattern = 'half',
  continuousLayout = false,
  protectVisibleLanes = true,
  showUnderlay = false,
}: Props) {
  const { ref: containerRef, width } = useContainerWidth();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(48);
  const [floorFlipped, setFloorFlipped] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [zScale, setZScale] = useState(80);
  const [dragging, setDragging] = useState(false);
  const [walking, setWalking] = useState(false);
  const [walkSpeed, setWalkSpeed] = useState(0.8);
  const [walkDistance, setWalkDistance] = useState(0);

  const drag = useRef<{ x: number; y: number } | null>(null);
  const pending = useRef<{ dx: number; dy: number } | null>(null);
  const raf = useRef<number | null>(null);

  const height = Math.max(mode === 'leveling' || mode === 'layout' ? 280 : 380, Math.min(640, Math.round(width * 0.58)));

  const visiblePatches = useMemo(
    () => model.patches.filter(p => mode !== 'analysis'
      ? p.def.kind !== 'sill'
      : p.def.zoneId === activeZoneId),
    [model.patches, activeZoneId, mode]
  );

  const meshes = useMemo(
    () => buildMesh({ ...model, patches: visiblePatches }, mode !== 'analysis'),
    [model, visiblePatches, mode]
  );

  const bounds = useMemo(() => {
    if (visiblePatches.length === 0) return model.bounds;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const mesh of meshes) {
      for (let i = 0; i < mesh.gx.length; i++) {
        x0 = Math.min(x0, mesh.gx[i]);
        y0 = Math.min(y0, mesh.gy[i]);
        x1 = Math.max(x1, mesh.gx[i]);
        y1 = Math.max(y1, mesh.gy[i]);
      }
    }
    if (mode === 'leveling' || mode === 'layout') {
      const geometry = getFloorPlanGeometry(model);
      for (const area of [geometry.stair, geometry.wc]) {
        x0 = Math.min(x0, area.x);
        y0 = Math.min(y0, area.y);
        x1 = Math.max(x1, area.x + area.width);
        y1 = Math.max(y1, area.y + area.depth);
      }
    }
    return { x0, y0, x1, y1 };
  }, [visiblePatches, meshes, model.bounds, model, mode]);

  const zRange = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const patch of meshes) {
      const heights = patch.h;
      for (let i = 0; i < heights.length; i++) {
        if (heights[i] < min) min = heights[i];
        if (heights[i] > max) max = heights[i];
      }
    }
    if (mode === 'leveling' || mode === 'layout') {
      const targetHeight = -targetZ;
      min = Math.min(min, targetHeight);
      max = Math.max(max, targetHeight);
    }
    return { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0 };
  }, [meshes, mode, targetZ]);

  const maxAbs = useMemo(() => {
    let max = 0.5;
    if (mode === 'leveling' || mode === 'layout') {
      for (const mesh of meshes) {
        for (const value of mesh.h) max = Math.max(max, Math.abs(value + targetZ));
      }
      return max;
    }
    const visibleZones = model.zones.filter(zone => zone.def.id === activeZoneId);
    for (const zone of visibleZones) {
      if (layer === 'rule') {
        const rule = rules[zone.def.id];
        if (!rule) continue;
        const { grind, fill } = rule.problemMap;
        for (let i = 0; i < grind.length; i++) {
          const v = Math.max(grind[i], fill[i]);
          if (v > max) max = v;
        }
      } else {
        const analysis = analyses[zone.def.id];
        if (!analysis) continue;
        for (const v of analysis.deviation.values) {
          const a = Math.abs(v);
          if (a > max) max = a;
        }
      }
    }
    return max;
  }, [layer, model.zones, rules, analyses, activeZoneId, mode, meshes, targetZ]);

  const walkPath = useMemo(() => buildWalkPath(model), [model]);
  const walkLength = useMemo(() => routeLength(walkPath), [walkPath]);
  const walker = useMemo(() => walkerAt(walkPath, walkDistance), [walkPath, walkDistance]);

  useEffect(() => {
    if (!walking || mode !== 'leveling') return;
    const timer = window.setInterval(() => {
      setWalkDistance(current => {
        return Math.min(walkLength, current + walkSpeed * 0.05);
      });
    }, 50);
    return () => window.clearInterval(timer);
  }, [walking, walkSpeed, walkLength, mode]);

  useEffect(() => {
    if (walking && walkDistance >= walkLength) setWalking(false);
  }, [walking, walkDistance, walkLength]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = width;
    const h = height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#f2f5f9');
    bg.addColorStop(1, '#dfe5ec');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const b = bounds;
    const L = b.x1 - b.x0;
    const W = b.y1 - b.y0;
    const cx0 = (b.x0 + b.x1) / 2;
    const cy0 = (b.y0 + b.y1) / 2;

    const cosY = Math.cos((yaw * Math.PI) / 180);
    const sinY = Math.sin((yaw * Math.PI) / 180);
    const cosP = Math.cos((pitch * Math.PI) / 180);
    const sinP = Math.sin((pitch * Math.PI) / 180);
    const zk = zScale / 1000;
    const zMid = (zRange.min + zRange.max) / 2;

    const diag = Math.hypot(L, W);
    const scale = (zoom * Math.min(w * 0.9, h * 1.15)) / diag;
    const ox = w / 2;
    const oy = h / 2 + h * 0.06;

    const project = (x: number, y: number, zMm: number): number[] => {
      const px = x - cx0;
      const py = floorFlipped ? cy0 - y : y - cy0;
      const ax = cosY * px - sinY * py;
      const ay = sinY * px + cosY * py;
      const z = (zMm - zMid) * zk;
      return [ox + ax * scale, oy - (ay * sinP + z * cosP) * scale, -ay * cosP + z * sinP];
    };

    if (mode === 'layout') {
      drawFlooringLayout(
        ctx,
        meshes,
        project,
        targetZ,
        layoutPattern,
        continuousLayout,
        protectVisibleLanes,
        showUnderlay,
        w
      );
      drawUnmeasuredPlanAreas(ctx, project, targetZ, model);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const mesh of meshes) {
        const room = mesh.sceneRoom;
        if (!room || mesh.patch.kind === 'arch') continue;
        const center = project(room.x + room.width / 2, room.y + room.depth / 2, -targetZ - 1);
        ctx.font = '700 11px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(45, 30, 20, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.strokeText(mesh.patch.name, center[0], center[1]);
        ctx.fillText(mesh.patch.name, center[0], center[1]);
      }
      return;
    }

    const light: Rgb = [0.5, 0.35, 0.78];
    const lightLen = Math.hypot(light[0], light[1], light[2]);
    const lx = -light[0] / lightLen;
    const ly = -light[1] / lightLen;
    const lz = light[2] / lightLen;

    const colorCache = new Map<number, string>();
    const VALUE_STEPS = 97;
    const INT_STEPS = 8;
    const colorFor = (value: number, intensity: number): string => {
      if (mode === 'leveling') {
        const base: Rgb = value > toleranceMm
          ? [224, 84, 73]
          : value < -toleranceMm
            ? [73, 144, 204]
            : [112, 170, 128];
        return rgbCss(shade(base, 0.72 + Math.max(0, intensity - 0.62) * 0.5));
      }
      const t = Math.max(-1, Math.min(1, value / maxAbs));
      const vi = Math.round((t * 0.5 + 0.5) * (VALUE_STEPS - 1));
      const ii = Math.max(0, Math.min(INT_STEPS - 1, Math.round((intensity - 0.5) * 12)));
      const key = vi * INT_STEPS + ii;
      const cached = colorCache.get(key);
      if (cached) return cached;
      const base = rampColor(t * maxAbs, maxAbs);
      const css = rgbCss(shade(base, 0.55 + ii / (INT_STEPS - 1) * 0.75));
      colorCache.set(key, css);
      return css;
    };

    interface QuadRun {
      color: string;
      quads: number[];
    }

    const quadColor: string[] = [];
    const quadDepth: number[] = [];
    const projectedByMesh: Float32Array[] = [];
    const targetProjectedByMesh: Float32Array[] = [];

    for (const mesh of meshes) {
      const { mx, my, gx, gy, h: heights, patch } = mesh;
      const count = (mx + 1) * (my + 1);
      const projected = new Float32Array(count * 2);
      const targetProjected = new Float32Array(count * 2);
      for (let k = 0; k < count; k++) {
        const p = project(gx[k], gy[k], heights[k]);
        projected[k * 2] = p[0];
        projected[k * 2 + 1] = p[1];
        const targetPoint = project(gx[k], gy[k], -targetZ);
        targetProjected[k * 2] = targetPoint[0];
        targetProjected[k * 2 + 1] = targetPoint[1];
      }
      projectedByMesh.push(projected);
      targetProjectedByMesh.push(targetProjected);
      const stepX = patch.lengthM / mx;
      const stepY = patch.widthM / my;
      const zoneId = patch.zoneId;
      const analysis = zoneId ? analyses[zoneId] : undefined;
      const rule = zoneId ? rules[zoneId] : undefined;

      for (let j = 0; j < my; j++) {
        for (let i = 0; i < mx; i++) {
          const i00 = j * (mx + 1) + i;
          const i10 = i00 + 1;
          const i01 = i00 + (mx + 1);
          const i11 = i01 + 1;

          const hx = (heights[i10] - heights[i00]) / stepX;
          const hy = (heights[i01] - heights[i00]) / stepY;
          const dzdx = (hx / 1000) * zScale;
          const dzdy = (hy / 1000) * zScale;
          const nLen = Math.hypot(-dzdx, -dzdy, 1);
          const intensity = 0.62 + 0.55 * Math.max(0, (-dzdx / nLen) * lx + (-dzdy / nLen) * ly + (1 / nLen) * lz);

          let value = 0;
          if (mode === 'leveling') {
            const currentHeight =
              (heights[i00] + heights[i10] + heights[i01] + heights[i11]) / 4;
            value = currentHeight + targetZ;
          } else if (zoneId && (rule || analysis)) {
            const cx = (gx[i00] + gx[i10] + gx[i01] + gx[i11]) / 4;
            const cy = (gy[i00] + gy[i10] + gy[i01] + gy[i11]) / 4;
            if (layer === 'rule') {
              if (rule) {
                const s = sampleProblem(rule, cx, cy);
                value = s.grind > 0 ? s.grind : s.fill > 0 ? -s.fill : 0;
              }
            } else if (analysis) {
              const local = patchGlobalToLocal(patch, cx, cy);
              value = sampleMap(analysis.deviation, local.u, local.v);
            }
          }

          quadColor.push(colorFor(value, intensity));
          quadDepth.push(
            (projected[i00 * 2 + 1] + projected[i10 * 2 + 1] + projected[i11 * 2 + 1] + projected[i01 * 2 + 1]) / 4
          );
        }
      }
    }

    const order: number[] = quadColor.map((_, i) => i);
    order.sort((a, b2) => quadDepth[a] - quadDepth[b2]);

    const meshByQuad = new Int32Array(quadColor.length);
    const meshOffset = new Int32Array(meshes.length);
    {
      let acc = 0;
      for (let m = 0; m < meshes.length; m++) {
        const n = meshes[m].mx * meshes[m].my;
        meshOffset[m] = acc;
        for (let k = 0; k < n; k++) meshByQuad[acc + k] = m;
        acc += n;
      }
    }

    // painter's algorithm with runs of the same color
    let run: QuadRun | null = null;
    const flush = () => {
      if (!run || run.quads.length === 0) return;
      ctx.beginPath();
      for (const qi of run.quads) {
        const m = meshByQuad[qi];
        const mesh = meshes[m];
        const { mx } = mesh;
        const local = qi - meshOffset[m];
        const i = local % mx;
        const j = Math.floor(local / mx);
        const i00 = j * (mx + 1) + i;
        const i10 = i00 + 1;
        const i01 = i00 + (mx + 1);
        const i11 = i01 + 1;
        const proj = projectedByMesh[m];
        ctx.moveTo(proj[i00 * 2], proj[i00 * 2 + 1]);
        ctx.lineTo(proj[i10 * 2], proj[i10 * 2 + 1]);
        ctx.lineTo(proj[i11 * 2], proj[i11 * 2 + 1]);
        ctx.lineTo(proj[i01 * 2], proj[i01 * 2 + 1]);
        ctx.closePath();
      }
      ctx.fillStyle = run.color;
      ctx.strokeStyle = run.color;
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
      run = null;
    };

    for (const qi of order) {
      const color = quadColor[qi];
      if (!run || run.color !== color) {
        flush();
        run = { color, quads: [qi] };
      } else {
        run.quads.push(qi);
      }
    }
    flush();

    if (mode === 'leveling') {
      ctx.save();
      ctx.fillStyle = 'rgba(31, 138, 180, 0.13)';
      ctx.strokeStyle = 'rgba(19, 99, 132, 0.66)';
      ctx.lineWidth = width < 520 ? 0.65 : 0.85;
      for (let meshIndex = 0; meshIndex < meshes.length; meshIndex++) {
        const mesh = meshes[meshIndex];
        const { mx, my } = mesh;
        const projected = targetProjectedByMesh[meshIndex];
        for (let j = 0; j < my; j++) {
          for (let i = 0; i < mx; i++) {
            const i00 = j * (mx + 1) + i;
            const i10 = i00 + 1;
            const i01 = i00 + mx + 1;
            const i11 = i01 + 1;
            ctx.beginPath();
            ctx.moveTo(projected[i00 * 2], projected[i00 * 2 + 1]);
            ctx.lineTo(projected[i10 * 2], projected[i10 * 2 + 1]);
            ctx.lineTo(projected[i11 * 2], projected[i11 * 2 + 1]);
            ctx.lineTo(projected[i01 * 2], projected[i01 * 2 + 1]);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    drawUnmeasuredPlanAreas(ctx, project, targetZ, model);

    // подписи помещений с габаритами
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const mesh of meshes) {
      const { patch, mx, my, gx, gy, h: heights } = mesh;
      if (patch.kind === 'sill') continue;
      const mi = Math.floor(mx / 2);
      const mj = Math.floor(my / 2);
      const idx = mj * (mx + 1) + mi;
      const p = project(gx[idx], gy[idx], heights[idx]);
      const title = patch.name;
      const dims = `${patch.lengthM.toFixed(2).replace('.', ',')} × ${patch.widthM.toFixed(2).replace('.', ',')} м`;
      ctx.font = '700 11px sans-serif';
      const tw = Math.max(ctx.measureText(title).width, 0) + 10;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillRect(p[0] - tw / 2, p[1] - 14, tw, 26);
      ctx.fillStyle = '#1f2937';
      ctx.fillText(title, p[0], p[1] - 4);
      ctx.font = '600 10px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(dims, p[0], p[1] + 8);
    }

    if (mode === 'leveling') {
      const pose = walker;
      const currentMesh = meshes.find(mesh => {
        const room = mesh.sceneRoom;
        return room !== undefined &&
          pose.x >= room.x - 0.001 && pose.x <= room.x + room.width + 0.001 &&
          pose.y >= room.y - 0.001 && pose.y <= room.y + room.depth + 0.001;
      });
      if (currentMesh?.sceneRoom) {
        const field = model.patches.find(patch => patch.def.id === currentMesh.patch.id)?.field;
        const local = localCoordinates(currentMesh.patch.id, currentMesh.sceneRoom, pose.x, pose.y);
        const floorHeight = field
          ? sampleMap(
              field,
              Math.max(0, Math.min(currentMesh.patch.lengthM, local.u)),
              Math.max(0, Math.min(currentMesh.patch.widthM, local.v))
            )
          : -targetZ;
        const poseProjected = project(pose.x, pose.y, floorHeight + 4);
        const heading = project(pose.nextX, pose.nextY, -targetZ);
        const angle = Math.atan2(heading[1] - poseProjected[1], heading[0] - poseProjected[0]);
        ctx.save();
        ctx.translate(poseProjected[0], poseProjected[1]);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
        ctx.beginPath();
        ctx.ellipse(0, 4, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate(angle);
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -12, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(0, 3);
        ctx.moveTo(0, -1);
        ctx.lineTo(-5, 3);
        ctx.moveTo(0, -1);
        ctx.lineTo(5, 3);
        ctx.moveTo(0, 3);
        ctx.lineTo(-4, 9);
        ctx.moveTo(0, 3);
        ctx.lineTo(4, 9);
        ctx.stroke();
        ctx.restore();
        ctx.font = '700 12px sans-serif';
        const location = pose.room;
        const locationWidth = ctx.measureText(location).width + 18;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
        ctx.beginPath();
        ctx.roundRect(12, 12, locationWidth, 28, 8);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(location, 21, 26);
      }

      const targetText = `ЦЕЛЬ · ${Math.round(targetZ)} мм от лазера`;
      ctx.font = '700 12px sans-serif';
      const targetWidth = ctx.measureText(targetText).width + 16;
      const targetX = w - targetWidth / 2 - 10;
      const targetY = 22;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(targetX - targetWidth / 2, targetY - 10, targetWidth, 20);
      ctx.strokeStyle = '#13789a';
      ctx.lineWidth = 1;
      ctx.strokeRect(targetX - targetWidth / 2, targetY - 10, targetWidth, 20);
      ctx.fillStyle = '#075985';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(targetText, targetX, targetY);
    }

    // линейка в текущем положении
    if (currentPlacement) {
      const p = currentPlacement;
      const lengthM = Math.hypot(p.endX - p.startX, p.endY - p.startY) || 1;
      const ux = (p.endX - p.startX) / lengthM;
      const uy = (p.endY - p.startY) / lengthM;
      const vx = -uy;
      const vy = ux;
      const halfWidth = 0.035;
      const segments = 24;
      const baseColor: Rgb =
        p.verdict === 'pass' ? [34, 156, 74] : p.verdict === 'rock' ? [214, 40, 40] : [37, 86, 214];
      const lineHeightAt = (t: number) =>
        p.startHeight + (p.endHeight - p.startHeight) * (t / lengthM);
      const segs: { p: number[][]; color: string; depth: number }[] = [];
      for (let k = 0; k < segments; k++) {
        const t0 = (k / segments) * lengthM;
        const t1 = ((k + 1) / segments) * lengthM;
        const x0 = p.startX + ux * t0;
        const y0 = p.startY + uy * t0;
        const x1 = p.startX + ux * t1;
        const y1 = p.startY + uy * t1;
        const z0 = lineHeightAt(t0);
        const z1 = lineHeightAt(t1);
        const pts = [
          project(x0 + vx * halfWidth, y0 + vy * halfWidth, z0),
          project(x1 + vx * halfWidth, y1 + vy * halfWidth, z1),
          project(x1 - vx * halfWidth, y1 - vy * halfWidth, z1),
          project(x0 - vx * halfWidth, y0 - vy * halfWidth, z0),
        ];
        segs.push({
          p: pts,
          color: rgbCss(shade(baseColor, k % 2 === 0 ? 1.12 : 0.94)),
          depth: (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4,
        });
      }
      segs.sort((a, b2) => a.depth - b2.depth);
      for (const s of segs) {
        ctx.beginPath();
        ctx.moveTo(s.p[0][0], s.p[0][1]);
        ctx.lineTo(s.p[1][0], s.p[1][1]);
        ctx.lineTo(s.p[2][0], s.p[2][1]);
        ctx.lineTo(s.p[3][0], s.p[3][1]);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
      }

      const stroke = p.verdict === 'pass' ? '#15803d' : p.verdict === 'rock' ? '#b91c1c' : '#1d4ed8';
      const h1 = project(p.startX, p.startY, p.startHeight);
      const h2 = project(p.endX, p.endY, p.endHeight);
      ctx.beginPath();
      ctx.moveTo(h1[0], h1[1]);
      ctx.lineTo(h2[0], h2[1]);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }, [
    width,
    height,
    yaw,
    pitch,
    zoom,
    zScale,
    meshes,
    model,
    rules,
    analyses,
    layer,
    currentPlacement,
    maxAbs,
    zRange,
    mode,
    floorFlipped,
    layoutPattern,
    continuousLayout,
    protectVisibleLanes,
    showUnderlay,
    targetZ,
    toleranceMm,
    walker,
  ]);

  const scheduleDrag = () => {
    if (raf.current !== null) return;
    raf.current = window.requestAnimationFrame(() => {
      const delta = pending.current;
      if (delta) {
        setYaw(prev => prev + delta.dx * 0.4);
        setPitch(prev => Math.max(6, Math.min(88, prev + delta.dy * 0.35)));
      }
      pending.current = null;
      raf.current = null;
    });
  };

  useEffect(
    () => () => {
      if (raf.current !== null) window.cancelAnimationFrame(raf.current);
    },
    []
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    pending.current = { dx, dy };
    scheduleDrag();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    setZoom(prev => Math.max(0.35, Math.min(4, prev * Math.exp(-e.deltaY * 0.0012))));
  };

  const toggleWalk = () => {
    if (walkDistance >= walkLength) setWalkDistance(0);
    setWalking(value => !value);
  };

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <div className={styles.controls}>
        <button
          className={styles.btn}
          onClick={() => {
            setYaw(0);
            setPitch(48);
            setZoom(1);
          }}
        >
          Изометрия
        </button>
        <button
          className={styles.btn}
          onClick={() => {
            setYaw(0);
            setPitch(89);
          }}
        >
          Сверху
        </button>
        {mode !== 'analysis' && (
          <button
            className={styles.btn}
            type="button"
            aria-pressed={floorFlipped}
            onClick={() => setFloorFlipped(value => !value)}
          >
            {floorFlipped ? 'Вернуть вид по плану' : 'Перевернуть этаж'}
          </button>
        )}
        {mode === 'leveling' ? (
          <>
            <button className={styles.btn} type="button" onClick={toggleWalk}>
              {walking ? 'Пауза прогулки' : 'Пройти по комнатам'}
            </button>
            <button
              className={styles.btn}
              type="button"
              onClick={() => {
                setWalking(false);
                setWalkDistance(0);
              }}
            >
              С начала
            </button>
            <label className={styles.sliderLabel}>
              Скорость {walkSpeed.toFixed(1)} м/с
              <input
                className={styles.slider}
                type="range"
                min={0.4}
                max={1.8}
                step={0.1}
                value={walkSpeed}
                onChange={event => setWalkSpeed(Number(event.target.value))}
              />
            </label>
            <span className={styles.targetValue}>Целевой уровень: {Math.round(targetZ)} мм от лазера</span>
          </>
        ) : mode === 'layout' ? (
          <span className={styles.targetValue}>
            {continuousLayout ? 'Единое полотно всего этажа' : 'Комнаты изолированы · зал, арка и коридор связаны'}
          </span>
        ) : (
          <>
            <button
              className={styles.btn}
              onClick={() => {
                setYaw(0);
                setPitch(8);
              }}
            >
              Сбоку
            </button>
            <label className={styles.sliderLabel}>
              Высота ×{zScale}
              <input
                className={styles.slider}
                type="range"
                min={10}
                max={300}
                step={5}
                value={zScale}
                onChange={e => setZScale(Number(e.target.value))}
              />
            </label>
          </>
        )}
        <span className={styles.hint}>{dragging ? 'Поворот…' : 'Проведите пальцем для поворота · масштабируйте жестом или колесом'}</span>
      </div>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label={mode === 'leveling'
          ? `3D-модель пола. Сейчас: ${walker.room}. Целевой уровень ${Math.round(targetZ)} миллиметров.`
          : mode === 'layout'
          ? `3D-раскладка ламината, схема ${layoutPattern}, ${continuousLayout ? 'единое полотно' : 'комнаты раздельно'}, ${floorFlipped ? 'этаж перевернут' : 'вид по плану'}.`
          : '3D-модель поверхности пола'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      />
      {mode === 'leveling' ? (
        <div className={styles.legend}>
          <span className={styles.legendItem}><i className={styles.grindSwatch} /> Сошлифовать выступы</span>
          <span className={styles.legendItem}><i className={styles.fillSwatch} /> Подмазать впадины</span>
          <span className={styles.legendItem}><i className={styles.okSwatch} /> В допуске ±{toleranceMm} мм</span>
          <span className={styles.legendItem}><i className={styles.targetSwatch} /> Целевая плоскость</span>
          <span className={styles.legendNote}>
            Рельеф пола показан с преувеличением по вертикали. Фигура проходит по комнатам по маршруту.
          </span>
        </div>
      ) : mode === 'layout' ? (
        <div className={styles.legend}>
          <span className={styles.legendItem}><i style={{ background: '#93613f' }} /> Ламели 1200 × 127 мм</span>
          <span className={styles.legendNote}>
            {protectVisibleLanes ? 'Стыки сдвинуты от центрального направления взгляда из окна.' : 'Сдвиг стыков не оптимизируется.'}
            {showUnderlay ? ' Показана раскладка листов подложки.' : ''}
          </span>
        </div>
      ) : (
        <div className={styles.legend}>
          <span className={styles.legendText}>{layer === 'rule' ? 'Подмазать' : 'Ниже плоскости'}</span>
          <span className={styles.legendBar} />
          <span className={styles.legendText}>{layer === 'rule' ? 'Шлифовать' : 'Выше плоскости'}</span>
          <span className={styles.legendNote}>
            {layer === 'rule' ? 'цвет — требуемая коррекция по правилу 2 м' : 'цвет — отклонение от опорной плоскости'}
          </span>
        </div>
      )}
    </div>
  );
}
