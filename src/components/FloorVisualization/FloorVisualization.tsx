import React, { useState, useRef, useEffect } from 'react';
import styles from './FloorVisualization.module.css';
import { MeasurementGrid, CellAnalysis, GridConfig } from '../../types';

interface Props {
  measurements: MeasurementGrid;
  cells: CellAnalysis[][] | null;
  grid: GridConfig;
  ruleViolations: { row: number; col: number }[];
  onMeasurementChange: (row: number, col: number, value: number) => void;
}

type RuleDir = 'off' | 'horizontal' | 'vertical' | 'diagonal';

interface RulePos {
  points: { row: number; col: number }[];
  values: number[];
  max: number;
  min: number;
  diff: number;
  passes: boolean;
  rocks: boolean;
  gapFail: boolean;
  rockIndex: number;
}

function analyzeLine(values: number[], points: { row: number; col: number }[]): RulePos {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const diff = max - min;

  let rockIndex = -1;
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
      rockIndex = i;
      break;
    }
  }

  const rocks = rockIndex >= 0;
  const gapFail = diff > 2.0;

  return { points, values, max, min, diff, passes: !rocks && !gapFail, rocks, gapFail, rockIndex };
}

function getRulePositions(measurements: MeasurementGrid, grid: GridConfig, dir: Exclude<RuleDir, 'off'>): RulePos[] {
  const { cols, rows } = grid;
  const out: RulePos[] = [];

  if (dir === 'horizontal') {
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols - 4; c++) {
        const points = Array.from({ length: 5 }, (_, i) => ({ row: r, col: c + i }));
        const values = points.map(p => measurements[p.row]?.[p.col] ?? 0);
        out.push(analyzeLine(values, points));
      }
    }
  } else if (dir === 'vertical') {
    for (let c = 0; c <= cols; c++) {
      for (let r = 0; r <= rows - 4; r++) {
        const points = Array.from({ length: 5 }, (_, i) => ({ row: r + i, col: c }));
        const values = points.map(p => measurements[p.row]?.[p.col] ?? 0);
        out.push(analyzeLine(values, points));
      }
    }
  } else {
    for (let r = 0; r <= rows - 3; r++) {
      for (let c = 0; c <= cols - 3; c++) {
        const points = Array.from({ length: 4 }, (_, i) => ({ row: r + i, col: c + i }));
        const values = points.map(p => measurements[p.row]?.[p.col] ?? 0);
        out.push(analyzeLine(values, points));
      }
    }
    for (let r = 3; r <= rows; r++) {
      for (let c = 0; c <= cols - 3; c++) {
        const points = Array.from({ length: 4 }, (_, i) => ({ row: r - i, col: c + i }));
        const values = points.map(p => measurements[p.row]?.[p.col] ?? 0);
        out.push(analyzeLine(values, points));
      }
    }
  }
  return out;
}

function interpolateColor(value: number, max: number, red: boolean): string {
  if (max === 0) return 'rgba(200,200,200,0.15)';
  const t = Math.max(0, Math.min(1, (Math.abs(value) - 0.3) / (max - 0.3)));
  if (red) return `rgb(255, ${Math.round(220 - t * 170)}, ${Math.round(220 - t * 170)})`;
  return `rgb(${Math.round(220 - t * 200)}, ${Math.round(220 - t * 100)}, 255)`;
}

function getCellColor(cell: CellAnalysis, maxGrind: number, maxFill: number): string {
  if (cell.action === 'grind') return interpolateColor(cell.value, maxGrind, true);
  if (cell.action === 'fill') return interpolateColor(cell.value, maxFill, false);
  return 'rgba(230,230,230,0.3)';
}

export function FloorVisualization({ measurements, cells, grid, ruleViolations, onMeasurementChange }: Props) {
  const [editing, setEditing] = useState<{ row: number; col: number; value: string } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number; x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [ruleDir, setRuleDir] = useState<RuleDir>('off');
  const [ruleIdx, setRuleIdx] = useState(0);
  const [rulePlaying, setRulePlaying] = useState(false);
  const [ruleSpeed, setRuleSpeed] = useState(300);
  const ruleTimer = useRef<number | null>(null);

  const { cols, rows, cellSize } = grid;
  const violationSet = new Set(ruleViolations.map(v => `${v.row},${v.col}`));

  const rulePositions = ruleDir !== 'off' ? getRulePositions(measurements, grid, ruleDir) : [];
  const currentRule = rulePositions[ruleIdx] ?? null;

  useEffect(() => { setRuleIdx(0); }, [ruleDir]);

  useEffect(() => {
    if (rulePlaying && rulePositions.length > 0) {
      ruleTimer.current = window.setInterval(() => {
        setRuleIdx(prev => {
          const next = prev + 1;
          if (next >= rulePositions.length) { setRulePlaying(false); return 0; }
          return next;
        });
      }, ruleSpeed);
    }
    return () => { if (ruleTimer.current) clearInterval(ruleTimer.current); };
  }, [rulePlaying, ruleSpeed, rulePositions.length]);

  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editing]);

  let maxGrind = 0, maxFill = 0;
  if (cells) {
    for (const row of cells) {
      for (const cell of row) {
        if (cell.action === 'grind' && cell.value > maxGrind) maxGrind = cell.value;
        if (cell.action === 'fill' && cell.value > maxFill) maxFill = cell.value;
      }
    }
  }

  const commitValue = () => {
    if (!editing) return;
    const v = parseFloat(editing.value);
    if (!isNaN(v)) onMeasurementChange(editing.row, editing.col, v);
    setEditing(null);
  };

  const handleCellClick = (r: number, c: number, e: React.MouseEvent) => {
    if (editing) commitValue();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const nodeR = Math.max(0, Math.min(rows, relY < 0.5 ? r : r + 1));
    const nodeC = Math.max(0, Math.min(cols, relX < 0.5 ? c : c + 1));
    setEditing({ row: nodeR, col: nodeC, value: measurements[nodeR][nodeC].toString() });
  };

  const cellPx = 60;
  const gridW = cols * cellPx;
  const gridH = rows * cellPx;

  const failRock = rulePositions.filter(p => p.rocks);
  const failGap = rulePositions.filter(p => p.gapFail);

  return (
    <div className={styles.wrapper}>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendGrad} style={{ background: 'linear-gradient(to right, #ffdddd, #ff0000)' }} />
          Шлифовать
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendGrad} style={{ background: 'linear-gradient(to right, #dde8ff, #0055ff)' }} />
          Подмазать
        </span>
      </div>

      {editing && (
        <div className={styles.toolbar}>
          <span className={styles.toolbarLabel}>Узел [{editing.row}, {editing.col}]</span>
          <input ref={inputRef} className={styles.toolbarInput} type="number" step="0.1" value={editing.value}
            onChange={e => setEditing({ ...editing, value: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') commitValue(); if (e.key === 'Escape') setEditing(null); }} />
          <span className={styles.toolbarUnit}>мм</span>
          <button className={styles.toolbarBtn} onClick={commitValue}>OK</button>
          <button className={styles.toolbarBtnCancel} onClick={() => setEditing(null)}>Отмена</button>
        </div>
      )}

      <div className={styles.ruleToolbar}>
        <span className={styles.ruleLabel}>Провило 2м:</span>
        <button className={`${styles.ruleBtn} ${ruleDir === 'off' ? styles.ruleBtnActive : ''}`} onClick={() => { setRuleDir('off'); setRulePlaying(false); }}>Выкл</button>
        <button className={`${styles.ruleBtn} ${ruleDir === 'horizontal' ? styles.ruleBtnActive : ''}`} onClick={() => setRuleDir('horizontal')}>↔ Вдоль</button>
        <button className={`${styles.ruleBtn} ${ruleDir === 'vertical' ? styles.ruleBtnActive : ''}`} onClick={() => setRuleDir('vertical')}>↕ Поперёк</button>
        <button className={`${styles.ruleBtn} ${ruleDir === 'diagonal' ? styles.ruleBtnActive : ''}`} onClick={() => setRuleDir('diagonal')}>↘ Диагональ</button>

        {ruleDir !== 'off' && (
          <>
            <span className={styles.ruleSep} />
            <button className={styles.rulePlayBtn} onClick={() => setRulePlaying(!rulePlaying)}>
              {rulePlaying ? '⏸' : '▶'}
            </button>
            <button className={styles.ruleStepBtn} onClick={() => setRuleIdx(Math.max(0, ruleIdx - 1))}>◀</button>
            <button className={styles.ruleStepBtn} onClick={() => setRuleIdx(Math.min(rulePositions.length - 1, ruleIdx + 1))}>▶</button>
            <select className={styles.ruleSpeed} value={ruleSpeed} onChange={e => setRuleSpeed(Number(e.target.value))}>
              <option value={500}>Медленно</option>
              <option value={300}>Нормально</option>
              <option value={100}>Быстро</option>
            </select>
            <span className={styles.rulePosLabel}>{ruleIdx + 1}/{rulePositions.length}</span>
            <span className={`${styles.rulePassCount} ${failRock.length + failGap.length > 0 ? styles.ruleFailColor : styles.rulePassColor}`}>
              {failRock.length + failGap.length === 0 ? '✓ Нарушений нет' :
                `${failRock.length} качаний, ${failGap.length} зазоров >2мм`}
            </span>
          </>
        )}
      </div>

      <div className={styles.scrollContainer}>
        <div className={styles.heatmapContainer} style={{ width: gridW, height: gridH }}>
          {cells && Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const cell = cells[r][c];
              const isActive = editing?.row === r && editing?.col === c;
              const hasViolation = violationSet.has(`${r},${c}`);
              return (
                <div key={`cell-${r}-${c}`}
                  className={`${styles.cell} ${isActive ? styles.cellActive : ''} ${hasViolation ? styles.cellViolation : ''}`}
                  style={{
                    left: c * cellPx, top: r * cellPx, width: cellPx, height: cellPx,
                    background: getCellColor(cell, maxGrind, maxFill),
                  }}
                  onClick={(e) => handleCellClick(r, c, e)}
                  onMouseMove={(e) => setHoveredCell({ row: r, col: c, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredCell(null)}
                />
              );
            })
          )}

          {currentRule && (
            <svg className={styles.lineSvg} style={{ width: gridW, height: gridH }}>
              <line
                x1={currentRule.points[0].col * cellPx + cellPx / 2}
                y1={currentRule.points[0].row * cellPx + cellPx / 2}
                x2={currentRule.points[currentRule.points.length - 1].col * cellPx + cellPx / 2}
                y2={currentRule.points[currentRule.points.length - 1].row * cellPx + cellPx / 2}
                stroke={currentRule.passes ? '#28a745' : '#dc3545'}
                strokeWidth={5}
                strokeLinecap="round"
              />
              {currentRule.points.map((p, i) => {
                const isRock = currentRule.rockIndex === i;
                return (
                  <g key={i}>
                    <circle cx={p.col * cellPx + cellPx / 2} cy={p.row * cellPx + cellPx / 2}
                      r={isRock ? 10 : 7}
                      fill={isRock ? '#ff6600' : currentRule.passes ? '#28a745' : '#dc3545'}
                      stroke="#fff" strokeWidth={2} />
                    <text x={p.col * cellPx + cellPx / 2} y={p.row * cellPx + cellPx / 2 + 4}
                      textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="monospace">
                      {measurements[p.row][p.col].toFixed(1)}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {currentRule && (
        <div className={`${styles.ruleResult} ${currentRule.passes ? styles.ruleResultPass : styles.ruleResultFail}`}>
          <span className={styles.ruleResultIcon}>{currentRule.passes ? '✓' : '✕'}</span>
          Перепад: {currentRule.diff.toFixed(2)} мм
          <span className={styles.ruleResultDetail}>(min {currentRule.min.toFixed(1)} — max {currentRule.max.toFixed(1)})</span>
          {currentRule.rocks && (
            <span className={styles.ruleRockTag}>▶ Качается: узел [{currentRule.points[currentRule.rockIndex].row},{currentRule.points[currentRule.rockIndex].col}] = {currentRule.values[currentRule.rockIndex].toFixed(1)}мм выше соседей</span>
          )}
          {currentRule.gapFail && (
              <span className={styles.ruleGapTag}>▶ Зазор &gt; 2мм: превышение на {(currentRule.diff - 2).toFixed(2)}мм</span>
          )}
        </div>
      )}

      {(failRock.length > 0 || failGap.length > 0) && ruleDir !== 'off' && (
        <div className={styles.ruleFailList}>
          {failRock.length > 0 && (
            <div className={styles.ruleFailSection}>
              <span className={styles.ruleRockLabel}>Качается ({failRock.length}):</span>
              {failRock.map((p, i) => (
                <span key={i} className={styles.ruleFailTagRock} onClick={() => setRuleIdx(rulePositions.indexOf(p))}>
                  [{p.points[0].row},{p.points[0].col}] → [{p.points[p.points.length-1].row},{p.points[p.points.length-1].col}]
                </span>
              ))}
            </div>
          )}
          {failGap.length > 0 && (
            <div className={styles.ruleFailSection}>
              <span className={styles.ruleGapLabel}>Зазор &gt;2мм ({failGap.length}):</span>
              {failGap.map((p, i) => (
                <span key={i} className={styles.ruleFailTagGap} onClick={() => setRuleIdx(rulePositions.indexOf(p))}>
                  [{p.points[0].row},{p.points[0].col}] {p.diff.toFixed(1)}мм
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {hoveredCell && cells && (
        <div className={styles.tooltip} style={{ position: 'fixed', left: hoveredCell.x + 16, top: hoveredCell.y - 80, pointerEvents: 'none' }}>
          <div className={styles.tooltipTitle}>Клетка [{hoveredCell.row}, {hoveredCell.col}]</div>
          <div className={styles.tooltipGrid}>
            <span className={styles.tooltipCorner}>{measurements[hoveredCell.row]?.[hoveredCell.col]?.toFixed(1) ?? '—'}</span>
            <span className={styles.tooltipCorner}>{measurements[hoveredCell.row]?.[hoveredCell.col + 1]?.toFixed(1) ?? '—'}</span>
            <span className={styles.tooltipCorner}>{measurements[hoveredCell.row + 1]?.[hoveredCell.col]?.toFixed(1) ?? '—'}</span>
            <span className={styles.tooltipCorner}>{measurements[hoveredCell.row + 1]?.[hoveredCell.col + 1]?.toFixed(1) ?? '—'}</span>
          </div>
          <div className={styles.tooltipDeviation}>
            Отклонение: {cells[hoveredCell.row][hoveredCell.col].deviation > 0 ? '+' : ''}
            {cells[hoveredCell.row][hoveredCell.col].deviation.toFixed(2)} мм
          </div>
        </div>
      )}

      <div className={styles.hint}>Кликните на клетку чтобы ввести замер</div>
    </div>
  );
}
