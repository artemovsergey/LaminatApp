import React, { useEffect, useRef, useState } from 'react';
import styles from './RoomReport.module.css';
import { FloorPatch } from '../../data/floorProject';
import { SurfaceField } from '../../types';
import { RoomInsights } from '../../utils/roomInsights';
import { sampleMap } from '../../utils/surface';
import { deltaRgb } from '../../utils/deltaColor';

interface Props {
  patch: FloorPatch;
  field: SurfaceField;
  targetZ: number;
  toleranceMm: number;
  insights: RoomInsights;
}

interface Camera {
  yaw: number;
  pitch: number;
  zoom: number;
  exaggeration: number;
}

const DEFAULT_CAMERA: Camera = { yaw: -0.68, pitch: 0.98, zoom: 1, exaggeration: 1 };

function drawRoom3D(canvas: HTMLCanvasElement, props: Props, camera: Camera): void {
  const { patch, field, targetZ, toleranceMm, insights } = props;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = 1000;
  const height = 620;
  const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#0b1220');
  bg.addColorStop(0.55, '#0e1728');
  bg.addColorStop(1, '#111c30');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Мягкое свечение под моделью.
  const glow = ctx.createRadialGradient(width / 2, height * 0.58, 40, width / 2, height * 0.58, width * 0.55);
  glow.addColorStop(0, 'rgba(56, 189, 248, 0.10)');
  glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  let maxAbs = 1;
  for (let j = 0; j < field.countY; j++) {
    for (let i = 0; i < field.countX; i++) {
      const z = -field.values[j * field.countX + i];
      maxAbs = Math.max(maxAbs, Math.abs(z - targetZ));
    }
  }
  const colorScale = Math.max(8, maxAbs);
  const verticalScale = (0.42 / (colorScale / 1000)) * camera.exaggeration;

  const L = patch.lengthM;
  const W = patch.widthM;
  const maxDim = Math.max(L, W);
  const cosY = Math.cos(camera.yaw);
  const sinY = Math.sin(camera.yaw);
  const cosP = Math.cos(camera.pitch);
  const sinP = Math.sin(camera.pitch);
  const scale = Math.min(width / (maxDim * 1.42), height / (maxDim * 1.02)) * camera.zoom;
  const camDist = maxDim * 2.2;
  const cx = width / 2;
  const cy = height * 0.54;

  const project = (x: number, z: number, y: number): { x: number; y: number; depth: number } => {
    const px = x - L / 2;
    const pz = z - W / 2;
    const rx = px * cosY - pz * sinY;
    const rz = px * sinY + pz * cosY;
    const sy = rz * sinP - y * cosP;
    const depth = rz * cosP + y * sinP;
    const persp = camDist / Math.max(1, camDist + depth + maxDim * 0.25);
    return {
      x: cx + rx * scale * persp,
      y: cy + sy * scale * persp,
      depth,
    };
  };

  const worldY = (delta: number): number => -(delta / 1000) * verticalScale;

  // Плоскость-цель: сетка 50 см.
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.18)';
  for (let x = 0; x <= L + 0.001; x += 0.5) {
    const a = project(Math.min(x, L), 0, 0);
    const b = project(Math.min(x, L), W, 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (let z = 0; z <= W + 0.001; z += 0.5) {
    const a = project(0, Math.min(z, W), 0);
    const b = project(L, Math.min(z, W), 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(45, 212, 191, 0.5)';
  ctx.lineWidth = 1.4;
  const corners = [
    project(0, 0, 0),
    project(L, 0, 0),
    project(L, W, 0),
    project(0, W, 0),
  ];
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.stroke();

  const nx = Math.max(24, Math.min(64, Math.round(L / 0.11)));
  const nz = Math.max(24, Math.min(64, Math.round(W / 0.11)));
  const vx = new Float32Array((nx + 1) * (nz + 1));
  const vy = new Float32Array((nx + 1) * (nz + 1));
  const vyWorld = new Float32Array((nx + 1) * (nz + 1));
  const vDelta = new Float32Array((nx + 1) * (nz + 1));
  const vDepth = new Float32Array((nx + 1) * (nz + 1));

  for (let j = 0; j <= nz; j++) {
    const z = (j / nz) * W;
    for (let i = 0; i <= nx; i++) {
      const x = (i / nx) * L;
      const h = sampleMap(field, x, z);
      const delta = -h - targetZ;
      const y = worldY(delta);
      const p = project(x, z, y);
      const idx = j * (nx + 1) + i;
      vx[idx] = p.x;
      vy[idx] = p.y;
      vyWorld[idx] = y;
      vDelta[idx] = delta;
      vDepth[idx] = p.depth;
    }
  }

  interface Quad {
    idx: number[];
    depth: number;
    delta: number;
    color: string;
  }

  const light = (() => {
    const v = [-0.42, 0.82, -0.38];
    const len = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / len, v[1] / len, v[2] / len];
  })();

  const quads: Quad[] = [];
  const dx = L / nx;
  const dz = W / nz;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + (nx + 1);
      const d = c + 1;
      const avgDepth = (vDepth[a] + vDepth[b] + vDepth[c] + vDepth[d]) / 4;
      const avgDelta = (vDelta[a] + vDelta[b] + vDelta[c] + vDelta[d]) / 4;

      const slopeX = (vyWorld[b] - vyWorld[a]) / dx;
      const slopeZ = (vyWorld[c] - vyWorld[a]) / dz;
      const n = [-slopeX, 1, -slopeZ];
      const nLen = Math.hypot(n[0], n[1], n[2]);
      const diffuse = Math.max(0, (n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / nLen);
      const shade = 0.76 + 0.34 * diffuse;
      const base = deltaRgb(avgDelta, toleranceMm, colorScale, 'surface');
      const color = `rgb(${Math.min(255, Math.round(base[0] * shade))}, ${Math.min(255, Math.round(base[1] * shade))}, ${Math.min(255, Math.round(base[2] * shade))})`;

      quads.push({ idx: [a, b, d, c], depth: avgDepth, delta: avgDelta, color });
    }
  }
  quads.sort((a, b) => b.depth - a.depth);

  for (const q of quads) {
    const [a, b, d, c] = q.idx;
    ctx.beginPath();
    ctx.moveTo(vx[a], vy[a]);
    ctx.lineTo(vx[b], vy[b]);
    ctx.lineTo(vx[d], vy[d]);
    ctx.lineTo(vx[c], vy[c]);
    ctx.closePath();
    ctx.fillStyle = q.color;
    ctx.fill();
    ctx.strokeStyle = q.color;
    ctx.lineWidth = 0.55;
    ctx.stroke();
  }

  // Вертикальные «маячки» на самых заметных неровностях.
  const marks = [
    ...insights.grind.slice(0, 2).map(p => ({ ...p, action: 'grind' as const })),
    ...insights.fill.slice(0, 2).map(p => ({ ...p, action: 'fill' as const })),
  ];
  for (const mark of marks) {
    if (Math.abs(mark.delta) <= toleranceMm) continue;
    const top = project(mark.x, mark.y, worldY(mark.delta));
    const base = project(mark.x, mark.y, 0);
    const color = mark.action === 'grind' ? '#f87171' : '#60a5fa';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(top.x, top.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const label = `${mark.delta > 0 ? '+' : '−'}${Math.abs(Math.round(mark.delta))}`;
    const bw = 34;
    const bh = 18;
    const bx = Math.max(6, Math.min(width - bw - 6, top.x + 9));
    const by = Math.max(6, Math.min(height - bh - 6, top.y - 9 - bh));
    ctx.fillStyle = 'rgba(8, 15, 28, 0.88)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '700 10px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bw / 2, by + bh / 2 + 0.5);
  }

  // Оси координат.
  const axisOrigin = { x: 58, y: height - 54 };
  ctx.lineWidth = 1.8;
  ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#38bdf8';
  ctx.fillStyle = '#7dd3fc';
  ctx.beginPath();
  ctx.moveTo(axisOrigin.x, axisOrigin.y);
  ctx.lineTo(axisOrigin.x + 30, axisOrigin.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(axisOrigin.x, axisOrigin.y);
  ctx.lineTo(axisOrigin.x, axisOrigin.y - 30);
  ctx.stroke();
  ctx.fillText('длина', axisOrigin.x + 15, axisOrigin.y + 14);
  ctx.fillText('глуб.', axisOrigin.x - 20, axisOrigin.y - 15);

  // Верхняя подпись сцены.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
  ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`РЕЛЬЕФ · ×${verticalScale.toFixed(0)} ПО ВЫСОТЕ`, 22, 18);
}

export function Room3D(props: Props): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; camera: Camera } | null>(null);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);

  useEffect(() => {
    if (ref.current) drawRoom3D(ref.current, props, camera);
  }, [camera, props]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, camera };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    setCamera({
      ...drag.current.camera,
      yaw: drag.current.camera.yaw + dx * 0.008,
      pitch: Math.max(0.24, Math.min(1.46, drag.current.camera.pitch + dy * 0.006)),
    });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const onWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    const next = Math.max(0.65, Math.min(2.2, camera.zoom * (event.deltaY > 0 ? 0.94 : 1.06)));
    setCamera({ ...camera, zoom: next });
  };

  return (
    <div className={styles.model3d}>
      <canvas
        ref={ref}
        className={`${styles.canvas} ${styles.canvas3d}`}
        role="img"
        aria-label={`3D-модель комнаты ${props.patch.name}, цель ${(props.targetZ / 10).toFixed(1).replace('.', ',')} см`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        3D-модель комнаты {props.patch.name}
      </canvas>
      <div className={styles.viewControls}>
        <button type="button" onClick={() => setCamera(DEFAULT_CAMERA)}>Сброс</button>
        <button type="button" onClick={() => setCamera({ ...camera, yaw: 0, pitch: 1.45, zoom: 1 })}>
          Сверху
        </button>
        <button type="button" onClick={() => setCamera({ ...camera, yaw: 0, pitch: 0.28, zoom: 1 })}>
          Сбоку
        </button>
        <label className={styles.heightControl}>
          <span>Рельеф</span>
          <input
            type="range"
            min={0.5}
            max={2.4}
            step={0.1}
            value={camera.exaggeration}
            onChange={event => setCamera({ ...camera, exaggeration: Number(event.target.value) })}
            aria-label="Усиление рельефа по высоте"
          />
        </label>
      </div>
    </div>
  );
}
