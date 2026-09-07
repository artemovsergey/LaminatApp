import React, { useState, useEffect, useRef } from 'react';
import styles from './RuleChecker.module.css';
import { MeasurementGrid, GridConfig } from '../../types';

interface Props {
  measurements: MeasurementGrid;
  grid: GridConfig;
}

type Direction = 'horizontal' | 'vertical' | 'diagonal';

interface StraightedgePosition {
  row: number;
  col: number;
  points: { row: number; col: number }[];
  max: number;
  min: number;
  diff: number;
  passes: boolean;
}

function getPositions(measurements: MeasurementGrid, grid: GridConfig, dir: Direction): StraightedgePosition[] {
  const { cols, rows } = grid;
  const positions: StraightedgePosition[] = [];

  if (dir === 'horizontal') {
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols - 4; c++) {
        const points = [];
        for (let i = 0; i <= 4; i++) {
          points.push({ row: r, col: c + i });
        }
        const vals = points.map(p => measurements[p.row]?.[p.col]).filter(v => v !== undefined);
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        positions.push({ row: r, col: c, points, max, min, diff: max - min, passes: max - min <= 2.0 });
      }
    }
  } else if (dir === 'vertical') {
    for (let c = 0; c <= cols; c++) {
      for (let r = 0; r <= rows - 4; r++) {
        const points = [];
        for (let i = 0; i <= 4; i++) {
          points.push({ row: r + i, col: c });
        }
        const vals = points.map(p => measurements[p.row]?.[p.col]).filter(v => v !== undefined);
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        positions.push({ row: r, col: c, points, max, min, diff: max - min, passes: max - min <= 2.0 });
      }
    }
  } else {
    const diagSpan = 3;
    for (let r = 0; r <= rows - diagSpan; r++) {
      for (let c = 0; c <= cols - diagSpan; c++) {
        const points = [];
        for (let i = 0; i <= diagSpan; i++) {
          points.push({ row: r + i, col: c + i });
        }
        const vals = points.map(p => measurements[p.row]?.[p.col]).filter(v => v !== undefined);
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        positions.push({ row: r, col: c, points, max, min, diff: max - min, passes: max - min <= 2.0 });
      }
    }
    for (let r = diagSpan; r <= rows; r++) {
      for (let c = 0; c <= cols - diagSpan; c++) {
        const points = [];
        for (let i = 0; i <= diagSpan; i++) {
          points.push({ row: r - i, col: c + i });
        }
        const vals = points.map(p => measurements[p.row]?.[p.col]).filter(v => v !== undefined);
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        positions.push({ row: r, col: c, points, max, min, diff: max - min, passes: max - min <= 2.0 });
      }
    }
  }

  return positions;
}

export function RuleChecker({ measurements, grid }: Props) {
  const [direction, setDirection] = useState<Direction>('horizontal');
  const [posIndex, setPosIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(300);
  const intervalRef = useRef<number | null>(null);

  const positions = getPositions(measurements, grid, direction);
  const current = positions[posIndex] ?? null;

  useEffect(() => {
    setPosIndex(0);
  }, [direction]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = window.setInterval(() => {
        setPosIndex(prev => {
          const next = prev + 1;
          if (next >= positions.length) {
            setPlaying(false);
            return 0;
          }
          return next;
        });
      }, speed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, speed, positions.length]);

  const { cols, rows } = grid;
  const cellPx = 50;
  const gridW = cols * cellPx;
  const gridH = rows * cellPx;

  const failCount = positions.filter(p => !p.passes).length;

  const pointSet = new Set(current?.points.map(p => `${p.row},${p.col}`) ?? []);

  return (
    <div className={styles.container}>
      <h2>Проверка провилом 2м</h2>

      <div className={styles.controls}>
        <div className={styles.dirButtons}>
          <button className={`${styles.dirBtn} ${direction === 'horizontal' ? styles.dirActive : ''}`} onClick={() => setDirection('horizontal')}>
            ↔ Вдоль
          </button>
          <button className={`${styles.dirBtn} ${direction === 'vertical' ? styles.dirActive : ''}`} onClick={() => setDirection('vertical')}>
            ↕ Поперёк
          </button>
          <button className={`${styles.dirBtn} ${direction === 'diagonal' ? styles.dirActive : ''}`} onClick={() => setDirection('diagonal')}>
            ↘ По диагонали
          </button>
        </div>

        <div className={styles.playControls}>
          <button className={styles.playBtn} onClick={() => setPlaying(!playing)}>
            {playing ? '⏸ Пауза' : '▶ Воспроизвести'}
          </button>
          <button className={styles.stepBtn} onClick={() => setPosIndex(Math.max(0, posIndex - 1))}>◀</button>
          <button className={styles.stepBtn} onClick={() => setPosIndex(Math.min(positions.length - 1, posIndex + 1))}>▶</button>
          <select className={styles.speedSelect} value={speed} onChange={e => setSpeed(Number(e.target.value))}>
            <option value={500}>Медленно</option>
            <option value={300}>Нормально</option>
            <option value={100}>Быстро</option>
          </select>
          <span className={styles.posLabel}>{posIndex + 1} / {positions.length}</span>
        </div>
      </div>

      <div className={styles.stats}>
        <span className={`${styles.stat} ${styles.statPass}`}>✓ Проходит: {positions.length - failCount}</span>
        <span className={`${styles.stat} ${styles.statFail}`}>✕ Нарушений: {failCount}</span>
      </div>

      <div className={styles.scrollContainer}>
        <div className={styles.heatmapContainer} style={{ width: gridW, height: gridH }}>
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const isOnLine = pointSet.has(`${r},${c}`);
              return (
                <div
                  key={`rc-${r}-${c}`}
                  className={`${styles.cell} ${isOnLine ? styles.cellOnLine : ''}`}
                  style={{
                    left: c * cellPx,
                    top: r * cellPx,
                    width: cellPx,
                    height: cellPx,
                  }}
                />
              );
            })
          )}

          {current && (
            <svg className={styles.lineSvg} style={{ width: gridW, height: gridH }}>
              <line
                x1={current.points[0].col * cellPx + cellPx / 2}
                y1={current.points[0].row * cellPx + cellPx / 2}
                x2={current.points[current.points.length - 1].col * cellPx + cellPx / 2}
                y2={current.points[current.points.length - 1].row * cellPx + cellPx / 2}
                stroke={current.passes ? '#28a745' : '#dc3545'}
                strokeWidth={4}
                strokeLinecap="round"
              />
              {current.points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.col * cellPx + cellPx / 2}
                  cy={p.row * cellPx + cellPx / 2}
                  r={6}
                  fill={current.passes ? '#28a745' : '#dc3545'}
                  stroke="#fff"
                  strokeWidth={2}
                />
              ))}
            </svg>
          )}
        </div>
      </div>

      {current && (
        <div className={`${styles.resultBar} ${current.passes ? styles.resultPass : styles.resultFail}`}>
          <span className={styles.resultIcon}>{current.passes ? '✓' : '✕'}</span>
          <span>Перепад: {current.diff.toFixed(2)} мм</span>
          <span className={styles.resultDetail}>
            (min {current.min.toFixed(1)} — max {current.max.toFixed(1)})
          </span>
          {!current.passes && (
            <span className={styles.resultAction}>
              {current.diff > 2 ? `Превышение на ${(current.diff - 2).toFixed(2)} мм` : ''}
            </span>
          )}
        </div>
      )}

      <div className={styles.failList}>
        {positions.filter(p => !p.passes).length > 0 && (
          <>
            <h3>Проблемные участки ({positions.filter(p => !p.passes).length}):</h3>
            <div className={styles.failGrid}>
              {positions.filter(p => !p.passes).map((p, i) => (
                <div
                  key={i}
                  className={styles.failItem}
                  onClick={() => setPosIndex(positions.indexOf(p))}
                >
                  {direction === 'horizontal' && `[${p.row}, ${p.col}→${p.col + 4}]`}
                  {direction === 'vertical' && `[${p.row}→${p.row + 4}, ${p.col}]`}
                  {direction === 'diagonal' && `[${p.row}→${p.row + 3}, ${p.col}→${p.col + 3}]`}
                  <span className={styles.failDiff}>{p.diff.toFixed(2)}мм</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
