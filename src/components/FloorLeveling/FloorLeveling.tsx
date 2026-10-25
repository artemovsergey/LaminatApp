import React, { useMemo } from 'react';
import styles from './FloorLeveling.module.css';
import {
  BAG_KG,
  buildHeightHistogram,
  computeFloorLevel,
  computeFloorReference,
  LevelRoomInput,
} from '../../utils/floorTarget';

export interface FloorLevelingProps {
  rooms: LevelRoomInput[];
  toleranceMm: number;
  activeZoneId: string;
  onSelectZone: (id: string) => void;
  targetZ: number;
  onTargetChange: (targetZ: number) => void;
}

const fmt = (mm: number, digits = 1) => (mm / 10).toFixed(digits).replace('.', ',');

export function FloorLeveling({
  rooms,
  toleranceMm,
  activeZoneId,
  onSelectZone,
  targetZ,
  onTargetChange,
}: FloorLevelingProps) {
  const reference = useMemo(() => computeFloorReference(rooms), [rooms]);
  const histogram = useMemo(() => buildHeightHistogram(rooms), [rooms]);

  const result = useMemo(
    () => computeFloorLevel(rooms, targetZ, toleranceMm),
    [rooms, targetZ, toleranceMm]
  );
  const strategies = useMemo(
    () => [
      {
        id: 'fill',
        title: 'Только подмазка',
        target: Math.round(reference.minZ),
        result: computeFloorLevel(rooms, Math.round(reference.minZ), toleranceMm),
      },
      {
        id: 'balanced',
        title: 'Смешанный способ',
        target: Math.round(reference.medianZ),
        result: computeFloorLevel(rooms, Math.round(reference.medianZ), toleranceMm),
      },
      {
        id: 'grind',
        title: 'Только шлифовка',
        target: Math.round(reference.maxZ),
        result: computeFloorLevel(rooms, Math.round(reference.maxZ), toleranceMm),
      },
    ],
    [rooms, reference.minZ, reference.medianZ, reference.maxZ, toleranceMm]
  );
  const { totals } = result;

  const span = Math.max(1, reference.maxZ - reference.minZ);
  const rangeMin = reference.minZ - span * 0.02;
  const rangeMax = reference.maxZ + span * 0.02;

  const histMaxArea = Math.max(...histogram.map(b => b.areaM2), 0.01);
  const W = 320;
  const H = 200;
  const padL = 38;
  const padR = 8;
  const padT = 8;
  const padB = 18;
  const yOf = (z: number) => padT + ((z - rangeMin) / (rangeMax - rangeMin)) * (H - padT - padB);
  const xOf = (a: number) => padL + (a / histMaxArea) * (W - padL - padR);
  const binHeight = histogram.length > 0 ? (H - padT - padB) / histogram.length : 1;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Целевой уровень этажа</h2>
      <div className={styles.target}>
        Приводим весь этаж к <b>{Math.round(targetZ)} мм от лазера</b> ({fmt(targetZ)} см) · допуск ±
        {toleranceMm} мм
      </div>

      <div className={styles.targetPanel}>
        <div className={styles.targetLeft}>
          <input
            className={styles.range}
            type="range"
            min={Math.round(rangeMin)}
            max={Math.round(rangeMax)}
            step={1}
            value={Math.round(targetZ)}
            onChange={e => onTargetChange(Number(e.target.value))}
          />
          <div className={styles.presets}>
            <button
              className={`${styles.presetBtn} ${Math.abs(targetZ - reference.minZ) < 0.5 ? styles.presetActive : ''}`}
              onClick={() => onTargetChange(Math.round(reference.minZ))}
              title="Целевая плоскость по самой высокой точке — только подмазка"
            >
              Только подмазка
            </button>
            <button
              className={`${styles.presetBtn} ${Math.abs(targetZ - reference.medianZ) < 0.5 ? styles.presetActive : ''}`}
              onClick={() => onTargetChange(Math.round(reference.medianZ))}
              title="Минимальный суммарный объём работ"
            >
              Минимум работы (медиана)
            </button>
            <button
              className={`${styles.presetBtn} ${Math.abs(targetZ - reference.maxZ) < 0.5 ? styles.presetActive : ''}`}
              onClick={() => onTargetChange(Math.round(reference.maxZ))}
              title="Целевая плоскость по самой низкой точке — только шлифовка"
            >
              Только шлифовка
            </button>
          </div>

          <div className={styles.strategyComparison}>
            <div className={styles.strategyHeading}>Сравнение вариантов по расчётной карте</div>
            <div className={styles.strategyCards}>
              {strategies.map(strategy => (
                <button
                  type="button"
                  key={strategy.id}
                  className={`${styles.strategyCard} ${
                    Math.abs(targetZ - strategy.target) < 0.5 ? styles.strategySelected : ''
                  }`}
                  onClick={() => onTargetChange(strategy.target)}
                >
                  <b>{strategy.title}</b>
                  <span>уровень {fmt(strategy.target)} см от лазера</span>
                  <span>подмазка: {strategy.result.totals.fillLiters.toFixed(0)} л · до {strategy.result.totals.maxFill.toFixed(1)} мм</span>
                  <span>шлифовка: {strategy.result.totals.grindLiters.toFixed(0)} л экв. · до {strategy.result.totals.maxGrind.toFixed(1)} мм</span>
                  <span>сумма коррекции: {(strategy.result.totals.fillLiters + strategy.result.totals.grindLiters).toFixed(0)} л экв.</span>
                </button>
              ))}
            </div>
            <p className={styles.strategyNote}>
              Медиана минимизирует суммарный расчётный объём снятого и добавленного материала. Только подмазка
              исключает шлифовку, но может потребовать больше смеси и поднять весь уровень; только шлифовка
              исключает смесь, но требует снять высокие участки. Выбор зависит от основания и допустимой высоты
              пола; расчёт не учитывает минимальную толщину слоя и ограничения покрытия.
            </p>
          </div>

          <div className={styles.totals}>
            <div className={`${styles.totalBlock} ${styles.grindBlock}`}>
              <div className={styles.totalTitle}>Сошлифовать</div>
              <div className={styles.totalValue}>{totals.grindAreaM2.toFixed(2)} м²</div>
              <div className={styles.totalDetail}>максимум {totals.maxGrind.toFixed(1)} мм</div>
            </div>
            <div className={`${styles.totalBlock} ${styles.fillBlock}`}>
              <div className={styles.totalTitle}>Подмазать</div>
              <div className={styles.totalValue}>{totals.fillAreaM2.toFixed(2)} м²</div>
              <div className={styles.totalDetail}>максимум {totals.maxFill.toFixed(1)} мм</div>
            </div>
            <div className={`${styles.totalBlock} ${styles.massBlock}`}>
              <div className={styles.totalTitle}>Смесь</div>
              <div className={styles.totalValue}>{totals.fillMassKg.toFixed(0)} кг</div>
              <div className={styles.totalDetail}>
                {totals.fillLiters.toFixed(0)} л · {Math.ceil(totals.fillBags)} мешк. по {BAG_KG} кг
              </div>
            </div>
            <div className={`${styles.totalBlock} ${styles.okBlock}`}>
              <div className={styles.totalTitle}>В допуске</div>
              <div className={styles.totalValue}>{totals.okPercent.toFixed(0)}%</div>
              <div className={styles.totalDetail}>{totals.okAreaM2.toFixed(1)} из {totals.areaM2.toFixed(1)} м²</div>
            </div>
          </div>
        </div>

        <div className={styles.histBox}>
          <svg className={styles.hist} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Распределение отметок пола">
            <line x1={padL} y1={padT} x2={padL} y2={H - padB} className={styles.axis} />
            <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} className={styles.axis} />
            {histogram.map((bin, i) => {
              const zTop = bin.z - span / (2 * histogram.length);
              const y = yOf(zTop);
              const w = xOf(bin.areaM2) - padL;
              return (
                <rect
                  key={i}
                  x={padL}
                  y={y}
                  width={Math.max(0, w)}
                  height={Math.max(1, binHeight - 1)}
                  className={styles.bar}
                />
              );
            })}
            <line x1={padL} y1={yOf(targetZ)} x2={W - padR} y2={yOf(targetZ)} className={styles.targetLine} />
            <text x={W - padR} y={yOf(targetZ) - 4} textAnchor="end" className={styles.targetText}>
              цель {fmt(targetZ)} см
            </text>
            <text x={padL - 4} y={padT + 8} textAnchor="end" className={styles.tickText}>
              {fmt(reference.minZ)}
            </text>
            <text x={padL - 4} y={H - padB} textAnchor="end" className={styles.tickText}>
              {fmt(reference.maxZ)}
            </text>
            <text x={W - padR} y={H - 4} textAnchor="end" className={styles.tickText}>
              площадь, м² →
            </text>
          </svg>
        </div>
      </div>

      <div className={styles.rooms}>
        {result.rooms.map(room => (
          <button
            key={room.id}
            className={`${styles.roomChip} ${activeZoneId === room.id ? styles.roomChipActive : ''}`}
            onClick={() => onSelectZone(room.id)}
            title="Выделить помещение на плане и показать его расчёт"
          >
            <div className={styles.roomName}>{room.name}</div>
            <div className={styles.roomArea}>{room.areaM2.toFixed(2)} м² · перепад {room.spread.toFixed(1)} мм</div>
            <div className={styles.roomMetrics}>
              <span className={styles.metricGrind}>{room.maxGrind > 0 ? `шлиф. ${room.maxGrind.toFixed(1)}` : '—'}</span>
              <span className={styles.metricFill}>{room.maxFill > 0 ? `подмаз. ${room.maxFill.toFixed(1)}` : '—'}</span>
              <span>{room.fillMassKg > 1 ? `${room.fillMassKg.toFixed(0)} кг` : '—'}</span>
            </div>
          </button>
        ))}
      </div>

      <div className={styles.recommend}>
        {totals.maxGrind < 0.05 && totals.maxFill < 0.05 ? (
          <>Этаж уже в плоскости — выравнивание не требуется.</>
        ) : (
          <>
            {totals.maxGrind > 0.05 && (
              <>
                Сошлифовать бугры до {totals.maxGrind.toFixed(1)} мм на {totals.grindAreaM2.toFixed(2)} м².{' '}
              </>
            )}
            {totals.maxFill > 0.05 && (
              <>
                Подмазать впадины до {totals.maxFill.toFixed(1)} мм на {totals.fillAreaM2.toFixed(2)} м² — около{' '}
                {Math.ceil(totals.fillBags)} мешков смеси.{' '}
              </>
            )}
            В допуске уже {totals.okPercent.toFixed(0)}% площади.
          </>
        )}
      </div>
    </div>
  );
}
