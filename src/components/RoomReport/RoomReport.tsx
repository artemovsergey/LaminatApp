import React, { useMemo } from 'react';
import styles from './RoomReport.module.css';
import { FloorPatch } from '../../data/floorProject';
import { SurfaceField } from '../../types';
import { RoomLevelStats } from '../../utils/floorTarget';
import { roomInsights } from '../../utils/roomInsights';
import { Room2D } from './Room2D';
import { Room3D } from './Room3D';

interface Props {
  index: number;
  patch: FloorPatch;
  field: SurfaceField;
  stats: RoomLevelStats;
  targetZ: number;
  toleranceMm: number;
}

const fmt = (value: number, digits = 1): string =>
  value.toFixed(digits).replace('.', ',');

const baseLabel = (base: FloorPatch['base']): string =>
  base === 'screed' ? 'бетонная стяжка' : 'наливной пол';

const windowLabel = (side: FloorPatch['windowSide']): string | null => {
  if (side === 'x0') return 'окно слева по схеме';
  if (side === 'x1') return 'окно справа по схеме';
  if (side === 'y0') return 'окно вверху по схеме';
  if (side === 'y1') return 'окно внизу по схеме';
  return null;
};

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}): React.JSX.Element {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>
        {value}
        {sub ? <small> · {sub}</small> : null}
      </span>
    </div>
  );
}

export function RoomReport({
  index,
  patch,
  field,
  stats,
  targetZ,
  toleranceMm,
}: Props): React.JSX.Element {
  const insights = useMemo(() => roomInsights(patch, targetZ, 3), [patch, targetZ]);

  const spreadCm = stats.spread / 10;
  const okPercent = stats.areaM2 > 0 ? (stats.okAreaM2 / stats.areaM2) * 100 : 0;
  const grindPoints = insights.grind.filter(point => point.delta < -toleranceMm);
  const fillPoints = insights.fill.filter(point => point.delta > toleranceMm);

  const verdict = (() => {
    if (stats.spread <= toleranceMm * 2) {
      return 'Перепад укладывается в допуск: выравнивание не требуется.';
    }

    if (patch.base === 'screed') {
      return 'Бетонная стяжка: сплошной слой здесь не нужен. Снимите локальные бугры в углах и подмажьте центральные ямы, ориентируясь на общий уровень квартиры.';
    }

    if (stats.fillLiters > stats.grindLiters * 1.6) {
      return 'Пол в основном ниже целевой плоскости: работа — подмазка. Снимать нужно только отдельные высокие пятна.';
    }

    if (stats.grindLiters > stats.fillLiters * 1.6) {
      return 'Пол в основном выше целевой плоскости: работа — шлифовка. Подмазывать почти нечего.';
    }

    return 'Смешанный рельеф: сначала снимите бугры, затем подмажьте локальные ямы до целевой плоскости.';
  })();

  return (
    <article className={styles.roomReport} id={`room-${patch.id}`}>
      <header className={styles.reportHeader}>
        <div className={styles.roomState}>
          <span className={styles.roomIndex}>Помещение {String(index).padStart(2, '0')}</span>
          <h3 className={styles.roomTitle}>{patch.name}</h3>
          <p className={styles.roomMeta}>
            <span>{fmt(patch.actualAreaM2, 2)} м²</span>
            <span>{baseLabel(patch.base)}</span>
            {windowLabel(patch.windowSide) ? <span>{windowLabel(patch.windowSide)}</span> : null}
            <span>
              {patch.lengthM.toFixed(2).replace('.', ',')} × {patch.widthM.toFixed(2).replace('.', ',')} м
            </span>
          </p>
        </div>
        <div className={styles.spread}>
          <span className={styles.spreadLabel}>Перепад</span>
          <span className={styles.spreadValue}>
            {fmt(spreadCm, 1)}
            <small>см</small>
          </span>
        </div>
      </header>

      <div className={styles.verdict}>
        <div>
          <span className={styles.verdictLabel}>Что делать</span>
          <p className={styles.verdictText}>{verdict}</p>
        </div>
        <div className={styles.statRow}>
          <Stat
            label="Снять"
            value={`до ${fmt(stats.maxGrind / 10, 1)} см`}
            sub={`${fmt(stats.grindAreaM2, 2)} м²`}
          />
          <Stat
            label="Подмазать"
            value={`до ${fmt(stats.maxFill / 10, 1)} см`}
            sub={`${fmt(stats.fillAreaM2, 2)} м²`}
          />
          <Stat
            label="Смесь"
            value={`${fmt(stats.fillMassKg, 1)} кг`}
            sub={`${fmt(stats.fillMassKg / 25, 1)} меш.`}
          />
          <Stat label="В допуске" value={`${fmt(okPercent, 0)} %`} />
        </div>
      </div>

      <div className={styles.panels}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h4 className={styles.panelTitle}>2D — карта отклонений</h4>
            <span className={styles.panelHint}>сетка 50 см · точки замеров</span>
          </div>
          <Room2D
            patch={patch}
            field={field}
            targetZ={targetZ}
            toleranceMm={toleranceMm}
            insights={insights}
          />
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h4 className={styles.panelTitle}>3D — рельеф пола</h4>
            <span className={styles.panelHint}>потяните, чтобы вращать</span>
          </div>
          <Room3D
            patch={patch}
            field={field}
            targetZ={targetZ}
            toleranceMm={toleranceMm}
            insights={insights}
          />
        </section>
      </div>

      <div className={styles.hotspots}>
        <div className={styles.hotspotGroup}>
          <h4>
            <span className={`${styles.groupDot} ${styles.groupDotGrind}`} />
            Подшлифовать · бугры
          </h4>
          {grindPoints.length === 0 ? (
            <p className={styles.empty}>Заметных бугров нет.</p>
          ) : (
            <ul className={styles.hotspotList}>
              {grindPoints.map(point => (
                <li className={styles.hotspotItem} key={`g-${point.row}-${point.point}-${point.kind}`}>
                  <span className={`${styles.badge} ${styles.badgeGrind}`}>
                    −{Math.abs(Math.round(point.delta))} мм
                  </span>
                  <span className={styles.hotspotText}>
                    {point.place} <em>· снять до цели</em>
                    <span className={styles.hotspotRef}>{point.gridRef} · {point.kind}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.hotspotGroup}>
          <h4>
            <span className={`${styles.groupDot} ${styles.groupDotFill}`} />
            Подмазать · ямы
          </h4>
          {fillPoints.length === 0 ? (
            <p className={styles.empty}>Заметных ям нет.</p>
          ) : (
            <ul className={styles.hotspotList}>
              {fillPoints.map(point => (
                <li className={styles.hotspotItem} key={`f-${point.row}-${point.point}-${point.kind}`}>
                  <span className={`${styles.badge} ${styles.badgeFill}`}>
                    +{Math.round(point.delta)} мм
                  </span>
                  <span className={styles.hotspotText}>
                    {point.place} <em>· залить до цели</em>
                    <span className={styles.hotspotRef}>{point.gridRef} · {point.kind}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className={styles.note}>
        Отсчёт от целевой плоскости {fmt(targetZ / 10, 1)} см; допуск ±{fmt(toleranceMm / 10, 1)} см.
        Красное — бугор, синее — яма. 3D-рельеф усилен по высоте, чтобы перепад был читаемым.
      </p>
    </article>
  );
}
