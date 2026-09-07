import React from 'react';
import styles from './SummaryReport.module.css';
import { AnalysisResult, CellAction, GridConfig } from '../../types';
import { findZones } from '../../utils/analysis';

interface Props {
  result: AnalysisResult;
  grid: GridConfig;
}

export function SummaryReport({ result, grid }: Props) {
  const { stats, cells } = result;
  const cellArea = (grid.cellSize * grid.cellSize);

  const grindZones = findZones(cells, 'grind');
  const fillZones = findZones(cells, 'fill');

  return (
    <div className={styles.container}>
      <h2>Итоги</h2>

      <div className={styles.stats}>
        <div className={`${styles.statBlock} ${styles.grindBlock}`}>
          <div className={styles.statIcon}>▲</div>
          <div className={styles.statValue}>{stats.grindCount}</div>
          <div className={styles.statLabel}>Шлифовать</div>
          <div className={styles.statArea}>{stats.grindArea.toFixed(2)} м²</div>
          {stats.maxGrind > 0 && <div className={styles.statMax}>до {stats.maxGrind.toFixed(1)} мм</div>}
        </div>
        <div className={`${styles.statBlock} ${styles.fillBlock}`}>
          <div className={styles.statIcon}>▼</div>
          <div className={styles.statValue}>{stats.fillCount}</div>
          <div className={styles.statLabel}>Подмазать</div>
          <div className={styles.statArea}>{stats.fillArea.toFixed(2)} м²</div>
          {stats.maxFill > 0 && <div className={styles.statMax}>до {stats.maxFill.toFixed(1)} мм</div>}
        </div>
        <div className={`${styles.statBlock} ${styles.okBlock}`}>
          <div className={styles.statIcon}>✓</div>
          <div className={styles.statValue}>{stats.okCount}</div>
          <div className={styles.statLabel}>Норма</div>
          <div className={styles.statArea}>{(stats.okCount * cellArea).toFixed(2)} м²</div>
        </div>
      </div>

      {result.ruleViolations.length > 0 ? (
        <div className={styles.warning}>
          Правило 2м нарушено в {result.ruleViolations.length} участках
        </div>
      ) : (stats.grindCount + stats.fillCount > 0) ? (
        <div className={styles.success}>
          Правило 2м выполняется
        </div>
      ) : null}

      {grindZones.length > 0 && (
        <div className={styles.zoneSummary}>
          Зон шлифовки: {grindZones.length}
          {grindZones.map((z, i) => {
            const max = Math.max(...z.map(c => cells[c.row][c.col].value));
            return <span key={i} className={styles.zoneTag}>#{i + 1}: {z.length} клет., {max.toFixed(1)}мм</span>;
          })}
        </div>
      )}

      {fillZones.length > 0 && (
        <div className={styles.zoneSummary}>
          Зон подмазки: {fillZones.length}
          {fillZones.map((z, i) => {
            const max = Math.max(...z.map(c => cells[c.row][c.col].value));
            return <span key={i} className={styles.zoneTag}>#{i + 1}: {z.length} клет., {max.toFixed(1)}мм</span>;
          })}
        </div>
      )}
    </div>
  );
}
