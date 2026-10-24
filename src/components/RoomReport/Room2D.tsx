import React, { useEffect, useRef } from 'react';
import styles from './RoomReport.module.css';
import { FloorPatch } from '../../data/floorProject';
import { SurfaceField } from '../../types';
import { RoomInsights, roomAxisInfo, roomMeasurementPoints } from '../../utils/roomInsights';
import { cssRgb, deltaRgb } from '../../utils/deltaColor';

interface Props {
  patch: FloorPatch;
  field: SurfaceField;
  targetZ: number;
  toleranceMm: number;
  insights: RoomInsights;
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

function drawRoom(canvas: HTMLCanvasElement, props: Props): void {
  const { patch, field, targetZ, toleranceMm, insights } = props;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const padding = { left: 66, right: 46, top: 52, bottom: 74 };
  const maxPlotW = 860;
  const maxPlotH = 540;
  const scale = Math.min(maxPlotW / patch.lengthM, maxPlotH / patch.widthM);
  const plotW = patch.lengthM * scale;
  const plotH = patch.widthM * scale;
  const width = Math.ceil(plotW + padding.left + padding.right);
  const height = Math.ceil(plotH + padding.top + padding.bottom);

  const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.aspectRatio = `${width} / ${height}`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const x0 = padding.left;
  const y0 = padding.top;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  // Плотное поле высот → растровая карта отклонений.
  const off = document.createElement('canvas');
  off.width = field.countX;
  off.height = field.countY;
  const offCtx = off.getContext('2d');
  if (!offCtx) return;
  const image = offCtx.createImageData(field.countX, field.countY);
  let maxAbs = 1;
  for (let j = 0; j < field.countY; j++) {
    for (let i = 0; i < field.countX; i++) {
      const z = -field.values[j * field.countX + i];
      maxAbs = Math.max(maxAbs, Math.abs(z - targetZ));
    }
  }
  const colorScale = Math.max(10, maxAbs);

  for (let j = 0; j < field.countY; j++) {
    for (let i = 0; i < field.countX; i++) {
      const z = -field.values[j * field.countX + i];
      const rgb = deltaRgb(z - targetZ, toleranceMm, colorScale, 'map');
      const k = (j * field.countX + i) * 4;
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
  for (const x of nodeXs) {
    ctx.beginPath();
    ctx.moveTo(x0 + x * scale, y0);
    ctx.lineTo(x0 + x * scale, y0 + plotH);
    ctx.stroke();
  }
  for (const y of nodeYs) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + y * scale);
    ctx.lineTo(x0 + plotW, y0 + y * scale);
    ctx.stroke();
  }
  ctx.restore();

  // Точки замеров: узлы крупнее, центры мельче.
  const points = roomMeasurementPoints(patch, targetZ);
  for (const point of points) {
    const px = x0 + point.x * scale;
    const py = y0 + point.y * scale;
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
    const px = x0 + mark.x * scale;
    const py = y0 + mark.y * scale;
    const color = mark.action === 'grind' ? '#b91c1c' : '#1d4ed8';
    const toRight = mark.x < patch.lengthM * 0.62;
    const below = mark.y < patch.widthM * 0.6;
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

  // Окно.
  if (patch.windowSide) {
    const side = patch.windowSide;
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (side === 'x0' || side === 'x1') {
      const wx = side === 'x0' ? x0 : x0 + plotW;
      ctx.moveTo(wx, y0 + 4);
      ctx.lineTo(wx, y0 + plotH - 4);
    } else {
      const wy = side === 'y0' ? y0 : y0 + plotH;
      ctx.moveTo(x0 + 4, wy);
      ctx.lineTo(x0 + plotW - 4, wy);
    }
    ctx.stroke();

    ctx.font = '700 9px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#0f766e';
    ctx.textBaseline = 'middle';
    if (side === 'x0' || side === 'x1') {
      ctx.textAlign = side === 'x0' ? 'left' : 'right';
      ctx.fillText('ОКНО', side === 'x0' ? x0 + 7 : x0 + plotW - 7, y0 + 12);
    } else {
      ctx.textAlign = 'center';
      ctx.fillText('ОКНО', x0 + plotW / 2, side === 'y0' ? y0 + 12 : y0 + plotH - 12);
    }
  }

  // Размеры.
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
  ctx.fillText(`${fmtM(patch.lengthM)} м`, x0 + plotW / 2, dimY + 7);

  ctx.save();
  ctx.translate(22, y0 + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${fmtM(patch.widthM)} м`, 0, 0);
  ctx.restore();

  // Подписи осей: где ряды, где точки.
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

  // Целевая отметка и допуск — в углу схемы.
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`цель ${fmtCm(targetZ)} см`, x0 + plotW, 12);
  ctx.font = '500 10px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(`допуск ±${fmtCm(toleranceMm)} см`, x0 + plotW, 27);

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

  useEffect(() => {
    if (ref.current) drawRoom(ref.current, props);
  });

  return (
    <canvas
      ref={ref}
      className={styles.canvas}
      role="img"
      aria-label={`2D-карта перепадов комнаты ${props.patch.name}, цель ${(props.targetZ / 10).toFixed(1).replace('.', ',')} см`}
    >
      2D-карта перепадов комнаты {props.patch.name}
    </canvas>
  );
}
