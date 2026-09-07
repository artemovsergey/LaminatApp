import React from 'react';
import styles from './RoomSetup.module.css';

interface Props {
  length: number;
  width: number;
  cellSize: number;
  onChange: (length: number, width: number, cellSize: number) => void;
}

const GRID_PRESETS = [
  { label: '50 × 50 см', value: 50 },
  { label: '25 × 25 см', value: 25 },
  { label: '100 × 100 см', value: 100 },
];

const ROOM_PRESETS = [
  { label: '3 × 4 м', length: 3, width: 4 },
  { label: '4 × 4 м', length: 4, width: 4 },
  { label: '3 × 5 м', length: 3, width: 5 },
  { label: '4 × 6 м', length: 4, width: 6 },
  { label: 'Своя', length: 0, width: 0 },
];

export function RoomSetup({ length, width, cellSize, onChange }: Props) {
  const handleLength = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0) onChange(v, width, cellSize);
  };

  const handleWidth = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0) onChange(length, v, cellSize);
  };

  const handleCellSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = parseInt(e.target.value);
    onChange(length, width, v);
  };

  const handlePreset = (l: number, w: number) => {
    if (l > 0 && w > 0) onChange(l, w, cellSize);
  };

  const cols = Math.round((length * 100) / cellSize);
  const rows = Math.round((width * 100) / cellSize);
  const totalNodes = (cols + 1) * (rows + 1);

  const isCustom = !ROOM_PRESETS.some(p => p.length === length && p.width === width);

  return (
    <div className={styles.container}>
      <h2>Параметры комнаты</h2>

      <div className={styles.section}>
        <label className={styles.label}>Размер комнаты:</label>
        <div className={styles.presetRow}>
          {ROOM_PRESETS.map((p, i) => (
            <button
              key={i}
              className={`${styles.presetBtn} ${p.length === length && p.width === width && !isCustom ? styles.presetActive : ''}`}
              onClick={() => handlePreset(p.length, p.width)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.row}>
        <label>
          Длина (м):
          <input type="number" step="0.1" min="0.5" value={length} onChange={handleLength} />
        </label>
        <label>
          Ширина (м):
          <input type="number" step="0.1" min="0.5" value={width} onChange={handleWidth} />
        </label>
        <label>
          Размер сетки:
          <select value={cellSize} onChange={handleCellSize}>
            {GRID_PRESETS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.info}>
        Сетка: {cols + 1} × {rows + 1} = {totalNodes} точек | {cols} × {rows} клеток
      </div>
    </div>
  );
}
