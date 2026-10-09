import { useMemo, useState } from 'react';
import { Floor3D, LayoutPattern } from '../Floor3D/Floor3D';
import { FloorModel } from '../../utils/floorModel';
import styles from './FlooringLayout.module.css';

type Pattern = LayoutPattern;

interface Props {
  model: FloorModel;
  targetZ: number;
}

const PLANK_LENGTH_M = 1.2;
const PLANK_WIDTH_M = 0.127;
const PLANK_AREA_M2 = PLANK_LENGTH_M * PLANK_WIDTH_M;
const LAMINATE_PACK_M2 = 1.829;
const UNDERLAY_PACK_M2 = 7.5;
const WASTE_FACTOR = 1.1;

const formatNumber = (value: number, digits = 1) =>
  value.toFixed(digits).replace('.', ',');

export function FlooringLayout({ model, targetZ }: Props) {
  const [pattern, setPattern] = useState<Pattern>('half');
  const [continuous, setContinuous] = useState(false);
  const [protectVisibleLanes, setProtectVisibleLanes] = useState(true);
  const [showUnderlay, setShowUnderlay] = useState(false);
  const floorArea = useMemo(
    () => model.patches
      .filter(({ def }) => def.kind !== 'sill')
      .reduce((sum, { def }) => sum + def.actualAreaM2, 0),
    [model]
  );
  const patternWaste = pattern === 'diagonal' ? 1.15 : pattern === 'herringbone' ? 1.2 : WASTE_FACTOR;
  const laminatePacks = Math.ceil((floorArea * patternWaste) / LAMINATE_PACK_M2);
  const underlayPacks = Math.ceil(floorArea / UNDERLAY_PACK_M2);
  const boardCount = Math.ceil((floorArea * patternWaste) / PLANK_AREA_M2);

  const choices: { id: Pattern; label: string; detail: string }[] = [
    { id: 'half', label: 'Прямая · 1/2', detail: 'стыки смещены на половину доски' },
    { id: 'third', label: 'Прямая · 1/3', detail: 'стыки смещены на треть доски' },
    { id: 'diagonal', label: 'Диагональ · 45°', detail: 'доски уложены под углом' },
    { id: 'herringbone', label: 'Ёлочка', detail: 'переплетение ламелей под 90°' },
  ];

  return (
    <section className={`panel plan-only-panel ${styles.panel}`}>
      <h2 className="panel-title">Раскладка ламината</h2>
      <p className={styles.intro}>
        Floorway HT-980 «American Walnut», доска 1200 × 127 × 12,3 мм. Геометрия помещений
        общая с архитектурным планом. Главная зона (зал, арка и коридор) показана единым покрытием.
      </p>
      <div className={styles.choices} role="group" aria-label="Способ укладки ламината">
        {choices.map(choice => (
          <button
            type="button"
            key={choice.id}
            aria-pressed={pattern === choice.id}
            className={`${styles.choice} ${pattern === choice.id ? styles.choiceActive : ''}`}
            onClick={() => setPattern(choice.id)}
          >
            <b>{choice.label}</b>
            <span>{choice.detail}</span>
          </button>
        ))}
      </div>
      <div className={styles.layoutOptions}>
        <label className={styles.underlayToggle}>
          <input
            type="checkbox"
            checked={continuous}
            onChange={event => setContinuous(event.target.checked)}
          />
          Рассматривать весь этаж как единое полотно
        </label>
        <label className={styles.underlayToggle}>
          <input
            type="checkbox"
            checked={protectVisibleLanes}
            onChange={event => setProtectVisibleLanes(event.target.checked)}
          />
          Сместить торцевые стыки от центра взгляда из окна
        </label>
      </div>
      <label className={styles.underlayToggle}>
        <input
          type="checkbox"
          checked={showUnderlay}
          onChange={event => setShowUnderlay(event.target.checked)}
        />
        Показать раскладку подложки Royce PolyBlock 750 × 500 мм
      </label>
      <div className={styles.drawingWrap}>
        <Floor3D
          model={model}
          rules={{}}
          analyses={{}}
          layer="deviation"
          activeZoneId="all"
          currentPlacement={null}
          mode="layout"
          targetZ={targetZ}
          layoutPattern={pattern}
          continuousLayout={continuous}
          protectVisibleLanes={protectVisibleLanes}
          showUnderlay={showUnderlay}
        />
      </div>
      <div className={styles.materials}>
        <article className={styles.materialCard}>
          <h3>Ламинат Floorway HT-980</h3>
          <p>Португалия · 33 / AC5 · фаска с 4 сторон · StepUp</p>
          <p>1200 × 127 × 12,3 мм · 12 досок · 1,829 м² / упаковка · 20 кг</p>
          <b>{formatNumber(floorArea, 2)} м² пола · {boardCount} досок и {laminatePacks} упаковок с запасом {Math.round((patternWaste - 1) * 100)}%</b>
        </article>
        <article className={styles.materialCard}>
          <h3>Подложка Royce PolyBlock</h3>
          <p>Вспененный полипропилен · толщина 3 мм · лист 750 × 500 мм</p>
          <p>7,5 м² / упаковка · номинальное звукопоглощение 18 дБ</p>
          <b>{underlayPacks} упаковок по расчёту площади без запаса</b>
        </article>
      </div>
      <p className={styles.note}>
        Визуализация раскладки ориентировочная. Зазор 10 мм, влажность стяжки, допуск основания
        ≤2 мм на 2 м, акклиматизацию ≥48 часов и разделение помещений в дверных проёмах нужно
        проверить на объекте. Указанный запас материала — расчётные 10%, а не гарантия расхода.
      </p>
    </section>
  );
}
