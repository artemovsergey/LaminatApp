import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './RoomReport.module.css';
import { FloorPatch } from '../../data/floorProject';
import { SurfaceField } from '../../types';
import { RoomInsights, RoomPoint, roomAxisInfo, roomMeasurementPoints } from '../../utils/roomInsights';
import { cssRgb, deltaRgb } from '../../utils/deltaColor';
import { PlotGeometry, roomPlotGeometry } from '../../utils/roomPlotGeometry';
import {
  displayToField,
  fieldToDisplay,
  roomOrientation,
  windowPlanSide,
} from '../../utils/roomOrientation';
import { sampleMap } from '../../utils/surface';

interface Props {
  patch: FloorPatch;
  field: SurfaceField;
  targetZ: number;
  toleranceMm: number;
  insights: RoomInsights;
}

interface HoverState {
  point: RoomPoint;
  /** Положение подсказки относительно полотна, 0…1. */
  nx: number;
  ny: number;
}

const fmtM = (v: number): string => v.toFixed(2).replace('.', ',');
const fmtCm = (v: number): string => (v / 10).toFixed(1).replace('.', ',');

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawRoom(
  canvas: HTMLCanvasElement,
  props: Props,
  points: RoomPoint[],
  geometry: PlotGeometry
): void {
  const { patch, field, targetZ, toleranceMm, insights } = props;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { x0, y0, plotW, plotH, width, height, scale } = geometry;
  const orientation = roomOrientation(patch);

  const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.aspectRatio = `${width} / ${height}`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  // Плотное поле высот → растровая карта отклонений на проекции комнаты.
  let maxAbs = 1;
  for (let j = 0; j < field.countY; j++) {
    for (let i = 0; i < field.countX; i++) {
      const z = -field.values[j * field.countX + i];
      maxAbs = Math.max(maxAbs, Math.abs(z - targetZ));
    }
  }
  const colorScale = Math.max(10, maxAbs);

  const imageW = Math.max(2, Math.min(900, Math.round(plotW)));
  const imageH = Math.max(2, Math.min(620, Math.round(plotH)));
  const off = document.createElement('canvas');
  off.width = imageW;
  off.height = imageH;
  const offCtx = off.getContext('2d');
  if (!offCtx) return;
  const image = offCtx.createImageData(imageW, imageH);

  for (let py = 0; py < imageH; py++) {
    const planY = ((py + 0.5) / imageH) * orientation.plotH;
    for (let px = 0; px < imageW; px++) {
      const planX = ((px + 0.5) / imageW) * orientation.plotW;
      const fieldPoint = displayToField(orientation, planX, planY);
      const z = -sampleMap(field, fieldPoint.u, fieldPoint.v);
      const rgb = deltaRgb(z - targetZ, toleranceMm, colorScale, 'map');
      const k = (py * imageW + px) * 4;
      image.data[k] = rgb[0];
      image.data[k + 1] = rgb[1];
      image.data[k + 2] = rgb[2];
      image.data[k + 3] = 255;
    }
  }
  offCtx.putImageData(image, 0, 0);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, plotW, plotH);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, x0, y0, plotW, plotH);

  // Сетка по фактическим узлам замеров (обычно через 50 см).
  const nodeXs = patch.grid.fineCoordinatesX?.filter((_, i) => i % 2 === 0) ?? [];
  const nodeYs = patch.grid.fineCoordinatesY?.filter((_, i) => i % 2 === 0) ?? [];
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
  ctx.lineWidth = 0.8;
  for (const u of nodeXs) {
    const a = fieldToDisplay(orientation, u, 0);
    const b = fieldToDisplay(orientation, u, patch.widthM);
    ctx.beginPath();
    ctx.moveTo(x0 + a.x * scale, y0 + a.y * scale);
    ctx.lineTo(x0 + b.x * scale, y0 + b.y * scale);
    ctx.stroke();
  }
  for (const v of nodeYs) {
    const a = fieldToDisplay(orientation, 0, v);
    const b = fieldToDisplay(orientation, patch.lengthM, v);
    ctx.beginPath();
    ctx.moveTo(x0 + a.x * scale, y0 + a.y * scale);
    ctx.lineTo(x0 + b.x * scale, y0 + b.y * scale);
    ctx.stroke();
  }
  ctx.restore();

  // Точки замеров: узлы крупнее, центры мельче.
  for (const point of points) {
    const px = x0 + point.planX * scale;
    const py = y0 + point.planY * scale;
    ctx.beginPath();
    ctx.arc(px, py, point.kind === 'узел' ? 2.5 : 1.5, 0, Math.PI * 2);
    ctx.fillStyle = point.kind === 'узел' ? 'rgba(15, 23, 42, 0.86)' : 'rgba(15, 23, 42, 0.42)';
    ctx.fill();
    if (point.kind === 'узел') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Метки самых заметных бугров и ям.
  const marks = [
    ...insights.grind.slice(0, 3).map(p => ({ ...p, action: 'grind' as const })),
    ...insights.fill.slice(0, 3).map(p => ({ ...p, action: 'fill' as const })),
  ];
  for (const mark of marks) {
    const px = x0 + mark.planX * scale;
    const py = y0 + mark.planY * scale;
    const color = mark.action === 'grind' ? '#b91c1c' : '#1d4ed8';
    const toRight = mark.planX < orientation.plotW * 0.62;
    const below = mark.planY < orientation.plotH * 0.6;
    const badgeW = 42;
    const badgeH = 20;
    const bx = toRight ? px + 12 : px - 12 - badgeW;
    const by = below ? py + 12 : py - 12 - badgeH;
    const clampedX = Math.max(x0 + 2, Math.min(x0 + plotW - badgeW - 2, bx));
    const clampedY = Math.max(y0 + 2, Math.min(y0 + plotH - badgeH - 2, by));

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(toRight ? clampedX : clampedX + badgeW, below ? clampedY : clampedY + badgeH);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    roundedRect(ctx, clampedX, clampedY, badgeW, badgeH, 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const value = `${mark.delta > 0 ? '+' : '−'}${Math.abs(Math.round(mark.delta))}`;
    ctx.fillText(value, clampedX + badgeW / 2, clampedY + badgeH / 2 + 0.5);
  }

  // Контур комнаты.
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x0, y0, plotW, plotH);

  // Окно всегда слева: проекция развёрнута рядами от окна вправо.
  if (windowPlanSide(patch)) {
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + 4);
    ctx.lineTo(x0, y0 + plotH - 4);
    ctx.stroke();

    const label = 'ОКНО';
    ctx.font = '700 9px "Segoe UI", system-ui, sans-serif';
    const labelW = ctx.measureText(label).width + 10;
    const labelH = 16;
    const lx = x0 + 7;
    const ly = y0 + 9;
    roundedRect(ctx, lx, ly, labelW, labelH, 4);
    ctx.fillStyle = 'rgba(240, 253, 250, 0.94)';
    ctx.fill();
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#0f766e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx + labelW / 2, ly + labelH / 2 + 0.5);
  }

  // Размеры: низ — горизонталь схемы, слева — вертикаль схемы.
  ctx.strokeStyle = '#64748b';
  ctx.fillStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
  const dimY = y0 + plotH + 30;
  ctx.beginPath();
  ctx.moveTo(x0, dimY);
  ctx.lineTo(x0 + plotW, dimY);
  ctx.moveTo(x0, dimY - 4);
  ctx.lineTo(x0, dimY + 4);
  ctx.moveTo(x0 + plotW, dimY - 4);
  ctx.lineTo(x0 + plotW, dimY + 4);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${fmtM(orientation.plotW)} м`, x0 + plotW / 2, dimY + 7);

  ctx.save();
  ctx.translate(Math.max(22, x0 - 44), y0 + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${fmtM(orientation.plotH)} м`, 0, 0);
  ctx.restore();

  // Подписи осей: ряды идут по горизонтали, точки — по вертикали.
  const axis = roomAxisInfo(patch);
  ctx.fillStyle = '#64748b';
  ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';
  const topLabel = axis.rowAxis === 'x'
    ? `РЯДЫ 1 → ${axis.rows}`
    : `ТОЧКИ 1 → ${axis.points}`;
  ctx.fillText(topLabel, x0 + plotW / 2, y0 - 10);

  ctx.save();
  ctx.translate(x0 - 14, y0 + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const leftLabel = axis.rowAxis === 'y'
    ? `РЯДЫ 1 → ${axis.rows}`
    : `ТОЧКИ 1 → ${axis.points}`;
  ctx.fillText(leftLabel, 0, 0);
  ctx.restore();

  // Целевая отметка и допуск — в правом верхнем углу полотна.
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`цель ${fmtCm(targetZ)} см`, width - 12, 12);
  ctx.font = '500 10px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(`допуск ±${fmtCm(toleranceMm)} см`, width - 12, 27);

  // Легенда внизу слева.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '500 10px "Segoe UI", system-ui, sans-serif';
  const legendY = height - 16;
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(x0, legendY - 4, 12, 8);
  ctx.fillStyle = '#475569';
  ctx.fillText('снять', x0 + 17, legendY);
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(x0 + 62, legendY - 4, 12, 8);
  ctx.fillStyle = '#475569';
  ctx.fillText('подмазать', x0 + 79, legendY);
  const ok = deltaRgb(0, toleranceMm, colorScale, 'map');
  ctx.fillStyle = cssRgb(ok);
  ctx.fillRect(x0 + 155, legendY - 4, 12, 8);
  ctx.fillStyle = '#475569';
  ctx.fillText('в допуске', x0 + 172, legendY);
}

export function Room2D(props: Props): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const geometry = useMemo(() => roomPlotGeometry(props.patch), [props.patch]);
  const points = useMemo(
    () => roomMeasurementPoints(props.patch, props.targetZ),
    [props.patch, props.targetZ]
  );

  useEffect(() => {
    if (ref.current) drawRoom(ref.current, props, points, geometry);
  }, [props.patch, props.field, props.targetZ, props.toleranceMm, props.insights, points, geometry]);

  const pickPoint = (clientX: number, clientY: number): void => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const sx = ((clientX - rect.left) / rect.width) * geometry.width;
    const sy = ((clientY - rect.top) / rect.height) * geometry.height;
    const hitRadius = Math.max(9, 12 * (geometry.width / rect.width));

    let best: RoomPoint | null = null;
    let bestDist = hitRadius;
    for (const point of points) {
      const px = geometry.x0 + point.planX * geometry.scale;
      const py = geometry.y0 + point.planY * geometry.scale;
      const dist = Math.hypot(px - sx, py - sy);
      if (dist <= bestDist) {
        best = point;
        bestDist = dist;
      }
    }

    if (!best) {
      setHover(null);
      return;
    }
    setHover({
      point: best,
      nx: (geometry.x0 + best.planX * geometry.scale) / geometry.width,
      ny: (geometry.y0 + best.planY * geometry.scale) / geometry.height,
    });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pickPoint(event.clientX, event.clientY);
  };

  return (
    <div className={styles.canvasWrap}>
      <canvas
        ref={ref}
        className={styles.canvas}
        role="img"
        aria-label={`2D-карта перепадов комнаты ${props.patch.name}, ряды слева направо, точки снизу вверх${props.patch.window ? ', окно слева' : ''}, цель ${(props.targetZ / 10).toFixed(1).replace('.', ',')} см`}
        onPointerMove={onPointerMove}
        onClick={event => pickPoint(event.clientX, event.clientY)}
        onPointerLeave={event => {
          if (event.pointerType === 'mouse') setHover(null);
        }}
      >
        2D-карта перепадов комнаты {props.patch.name}
      </canvas>
      {hover ? (
        <>
          <span
            className={styles.hoverDot}
            style={{ left: `${hover.nx * 100}%`, top: `${hover.ny * 100}%` }}
            aria-hidden="true"
          />
          <div
            className={styles.tooltip}
            style={{ left: `${hover.nx * 100}%`, top: `${hover.ny * 100}%` }}
            role="status"
          >
            <strong>{fmtCm(hover.point.z)} см</strong>
            <span>{hover.point.gridRef} · {hover.point.kind}</span>
            <span>по схеме: x {fmtM(hover.point.planX)} · y {fmtM(hover.point.planY)} м</span>
            <span className={hover.point.delta >= 0 ? styles.tooltipFill : styles.tooltipGrind}>
              {hover.point.delta >= 0 ? '+' : '−'}{Math.abs(Math.round(hover.point.delta))} мм к цели
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
