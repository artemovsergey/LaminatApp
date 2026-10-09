import React from 'react';
import styles from './RuleSimulation.module.css';
import { RulePlacement, RuleSimulationResult } from '../../types';

interface Props {
  rule: RuleSimulationResult;
  zoneName: string;
  angleDeg: number;
  onAngleChange: (angle: number) => void;
  placements: RulePlacement[];
  index: number;
  onIndexChange: (index: number) => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
}

const ANGLE_PRESETS = [0, 30, 45, 60, 90, 120, 135, 150];

export function RuleSimulation({
  rule,
  zoneName,
  angleDeg,
  onAngleChange,
  placements,
  index,
  onIndexChange,
  playing,
  onPlayingChange,
}: Props) {
  const current = placements[index] ?? null;
  const failAngles = rule.angles.filter(a => a.fails > 0).length;

  return (
    <div className={styles.container}>
      <div className={styles.head}>
        <h2 className={styles.title}>Симуляция правила 2 м</h2>
        <span className={styles.mode}>{zoneName} · допуск 2 мм</span>
      </div>

      <div className={styles.controls}>
        <button className={styles.playBtn} onClick={() => onPlayingChange(!playing)}>
          {playing ? '⏸ Пауза' : '▶ Пуск'}
        </button>
        <button className={styles.stepBtn} onClick={() => onIndexChange(Math.max(0, index - 1))}>
          ◀
        </button>
        <button
          className={styles.stepBtn}
          onClick={() => onIndexChange(Math.min(placements.length - 1, index + 1))}
        >
          ▶
        </button>
        <label className={styles.angleLabel}>
          Угол <b>{angleDeg}°</b>
          <input
            className={styles.range}
            type="range"
            min={0}
            max={179}
            step={1}
            value={angleDeg}
            onChange={e => onAngleChange(Number(e.target.value))}
          />
        </label>
        <div className={styles.presets}>
          {ANGLE_PRESETS.map(a => (
            <button
              key={a}
              className={`${styles.presetBtn} ${a === angleDeg ? styles.presetActive : ''}`}
              onClick={() => onAngleChange(a)}
            >
              {a}°
            </button>
          ))}
        </div>
        <span className={styles.posLabel}>
          {placements.length > 0 ? `${index + 1} / ${placements.length}` : '—'}
        </span>
        {current && (
          <span
            className={`${styles.verdict} ${
              current.verdict === 'pass'
                ? styles.verdictPass
                : current.verdict === 'rock'
                  ? styles.verdictRock
                  : styles.verdictGap
            }`}
          >
            {current.verdict === 'pass'
              ? `✓ зазор ${current.maxGap.toFixed(1)} мм`
              : current.verdict === 'rock'
                ? `✕ качание ${current.maxGap.toFixed(1)} мм — шлифовать`
                : `✕ зазор ${current.maxGap.toFixed(1)} мм — подмазать`}
          </span>
        )}
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryValue}>{rule.totalPlacements}</span>
          <span className={styles.summaryLabel}>положений</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={`${styles.summaryValue} ${rule.totalFails > 0 ? styles.bad : styles.good}`}>
            {rule.totalFails}
          </span>
          <span className={styles.summaryLabel}>
            нарушений ({rule.rockFails} качаний, {rule.gapFails} зазоров)
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={`${styles.summaryValue} ${failAngles > 0 ? styles.bad : styles.good}`}>
            {failAngles}/{rule.angles.length}
          </span>
          <span className={styles.summaryLabel}>направлений проблемные</span>
        </div>
      </div>

      <div className={styles.angleList}>
        {rule.angles.map(a => (
          <button
            key={a.angleDeg}
            className={`${styles.angleChip} ${a.fails > 0 ? styles.angleChipFail : styles.angleChipPass} ${
              a.angleDeg === angleDeg ? styles.angleChipActive : ''
            }`}
            onClick={() => onAngleChange(a.angleDeg)}
            title={`Положений: ${a.placements}, нарушений: ${a.fails}${
              a.maxGap > 0 ? `, макс. зазор ${a.maxGap.toFixed(1)} мм` : ''
            }`}
          >
            {a.angleDeg}°
            <span className={styles.angleChipFails}>{a.fails > 0 ? `✕${a.fails}` : '✓'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
