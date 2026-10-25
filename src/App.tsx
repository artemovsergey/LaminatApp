import { useMemo, useState } from 'react';
import { FloorLeveling } from './components/FloorLeveling/FloorLeveling';
import { FloorPlan2D } from './components/FloorPlan2D/FloorPlan2D';
import { RoomReport } from './components/RoomReport/RoomReport';
import { DEFAULT_RULE_OPTIONS } from './utils/rule';
import { buildApartmentModel, buildFloorModel } from './utils/floorModel';
import {
  LevelRoomInput,
  RoomLevelStats,
  computeFloorLevel,
  computeFloorReference,
} from './utils/floorTarget';
import './App.css';

const fmt = (value: number, digits = 1): string => value.toFixed(digits).replace('.', ',');

const ROOM_ORDER = ['hall', 'garden', 'small', 'yard', 'corridor', 'arch'];

export default function App() {
  const model = useMemo(() => buildFloorModel(), []);
  const apartmentModel = useMemo(() => buildApartmentModel(), []);

  const rooms = useMemo<LevelRoomInput[]>(
    () =>
      model.patches
        .filter(patch => patch.def.kind !== 'sill')
        .map(({ def, field }) => ({
          id: def.id,
          name: def.name,
          areaM2: def.actualAreaM2,
          field,
        })),
    [model]
  );

  const apartmentRooms = useMemo<LevelRoomInput[]>(
    () =>
      apartmentModel.patches.map(({ def, field }) => ({
        id: def.id,
        name: def.name,
        areaM2: def.actualAreaM2,
        field,
      })),
    [apartmentModel]
  );

  const reference = useMemo(() => computeFloorReference(rooms), [rooms]);
  const apartmentReference = useMemo(
    () => computeFloorReference(apartmentRooms),
    [apartmentRooms]
  );

  const [targetZ, setTargetZ] = useState(() => Math.round(reference.medianZ));
  const [apartmentTargetZ] = useState(() => Math.round(apartmentReference.medianZ));
  const [activeRoomId, setActiveRoomId] = useState('corridor');

  const toleranceMm = DEFAULT_RULE_OPTIONS.toleranceMm;
  const level = useMemo(
    () => computeFloorLevel(rooms, targetZ, toleranceMm),
    [rooms, targetZ, toleranceMm]
  );
  const apartmentLevel = useMemo(
    () => computeFloorLevel(apartmentRooms, apartmentTargetZ, toleranceMm),
    [apartmentRooms, apartmentTargetZ, toleranceMm]
  );

  const statsById = useMemo(
    () => new Map<string, RoomLevelStats>(level.rooms.map(room => [room.id, room])),
    [level]
  );

  const orderedRooms = useMemo(
    () =>
      ROOM_ORDER.flatMap(id => {
        const patch = model.patches.find(item => item.def.id === id);
        return patch ? [patch] : [];
      }),
    [model]
  );

  const apartmentPatch = apartmentModel.patches[0];
  const apartmentStats = apartmentLevel.rooms[0];

  const onSelectZone = (zoneId: string) => {
    setActiveRoomId(zoneId === 'corridor-hall' ? 'corridor' : zoneId);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-row">
          <div>
            <p className="app-kicker">Обмеры после шлифовки · 7 помещений · 103,16 м²</p>
            <h1>Пол второго этажа и квартиры</h1>
            <p className="subtitle">
              Карта перепадов, локальные бугры и ямы, оптимальная плоскость выравнивания.
              Все отметки — расстояние от лазерной линии до поверхности пола.
            </p>
          </div>
          <div className="app-stamp" aria-label="Методика">
            <span>Сетка</span>
            <strong>50 см</strong>
            <span>Допуск</span>
            <strong>±2 мм</strong>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="level-sheet" aria-label="Оптимальный уровень пола">
          <div className="level-sheet-head">
            <h2>Оптимальный уровень</h2>
            <p>
              Целевая плоскость выбрана по медиане замеров: при ней суммарный объём
              шлифовки и подмазки минимален. Допуск ровности — ±2 мм.
            </p>
          </div>

          <div className="level-grid">
            <article className="level-block">
              <div className="level-block-top">
                <span>Второй этаж</span>
                <span>6 помещений · {fmt(reference.areaM2, 2)} м²</span>
              </div>
              <div className="level-target">
                <strong>{fmt(targetZ / 10, 1)}</strong>
                <span>см</span>
              </div>
              <p className="level-caption">от лазерной линии до пола</p>
              <dl className="level-facts">
                <div>
                  <dt>минимум</dt>
                  <dd>{fmt(reference.minZ / 10, 1)} см</dd>
                </div>
                <div>
                  <dt>медиана</dt>
                  <dd>{fmt(reference.medianZ / 10, 1)} см</dd>
                </div>
                <div>
                  <dt>максимум</dt>
                  <dd>{fmt(reference.maxZ / 10, 1)} см</dd>
                </div>
              </dl>
              <div className="level-work">
                <span>
                  Снять <strong>{Math.round(level.totals.grindLiters)}</strong> л
                </span>
                <span>
                  Подмазать <strong>{Math.round(level.totals.fillLiters)}</strong> л
                </span>
                <span>
                  Смесь <strong>{fmt(level.totals.fillMassKg, 0)}</strong> кг ·{' '}
                  {fmt(level.totals.fillBags, 1)} меш.
                </span>
              </div>
            </article>

            <article className="level-block level-block-apartment">
              <div className="level-block-top">
                <span>Квартира</span>
                <span>1 комната · {fmt(apartmentReference.areaM2, 2)} м²</span>
              </div>
              <div className="level-target">
                <strong>{fmt(apartmentTargetZ / 10, 1)}</strong>
                <span>см</span>
              </div>
              <p className="level-caption">отдельная плоскость · бетонная стяжка</p>
              <dl className="level-facts">
                <div>
                  <dt>минимум</dt>
                  <dd>{fmt(apartmentReference.minZ / 10, 1)} см</dd>
                </div>
                <div>
                  <dt>медиана</dt>
                  <dd>{fmt(apartmentReference.medianZ / 10, 1)} см</dd>
                </div>
                <div>
                  <dt>максимум</dt>
                  <dd>{fmt(apartmentReference.maxZ / 10, 1)} см</dd>
                </div>
              </dl>
              <div className="level-work">
                <span>
                  Снять <strong>{Math.round(apartmentLevel.totals.grindLiters)}</strong> л
                </span>
                <span>
                  Подмазать <strong>{Math.round(apartmentLevel.totals.fillLiters)}</strong> л
                </span>
                <span>
                  Смесь <strong>{fmt(apartmentLevel.totals.fillMassKg, 0)}</strong> кг ·{' '}
                  {fmt(apartmentLevel.totals.fillBags, 1)} меш.
                </span>
              </div>
            </article>
          </div>

          <p className="level-footnote">
            Второй этаж и квартиру нельзя приводить к одной плоскости: это разные основания
            и разные отметки лазера. Для квартиры ниже приведён отдельный расчёт.
          </p>
        </section>

        <div className="content">
          <section className="panel plan-only-panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">План второго этажа</h2>
                <p className="section-intro">
                  Архитектурная геометрия и фактическая поверхность после шлифовки.
                </p>
              </div>
              <span className="panel-tag">2D · вид сверху</span>
            </div>
            <FloorPlan2D
              model={model}
              targetZ={targetZ}
              toleranceMm={toleranceMm}
              selectedRoomId={activeRoomId}
            />
          </section>

          <FloorLeveling
            rooms={rooms}
            toleranceMm={toleranceMm}
            activeZoneId={activeRoomId}
            onSelectZone={onSelectZone}
            targetZ={targetZ}
            onTargetChange={setTargetZ}
          />

          <section className="rooms-section" aria-labelledby="rooms-title">
            <div className="section-head">
              <div>
                <h2 id="rooms-title">Комнаты второго этажа</h2>
                <p>
                  Для каждой комнаты — 2D-карта отклонений и адреса локальных бугров и ям.
                  Цель для всех помещений этажа одна: {fmt(targetZ / 10, 1)} см.
                </p>
              </div>
              <nav className="room-nav" aria-label="Перейти к комнате">
                {orderedRooms.map(patch => (
                  <a key={patch.def.id} href={`#room-${patch.def.id}`}>
                    {patch.def.name}
                  </a>
                ))}
              </nav>
            </div>

            {orderedRooms.map((patch, index) => {
              const stats = statsById.get(patch.def.id);
              if (!stats) return null;
              return (
                <RoomReport
                  key={patch.def.id}
                  index={index + 1}
                  patch={patch.def}
                  field={patch.field}
                  stats={stats}
                  targetZ={targetZ}
                  toleranceMm={toleranceMm}
                />
              );
            })}
          </section>

          <section className="apartment-section" id="apartment" aria-labelledby="apartment-title">
            <div className="section-head section-head-apartment">
              <div>
                <h2 id="apartment-title">Квартира — отдельно</h2>
                <p>
                  Комната {fmt(apartmentPatch.def.actualAreaM2, 2)} м² на бетонной стяжке.
                  Здесь другой размах: {fmt(apartmentStats.spread / 10, 1)} см против
                  0,2–1,1 см на втором этаже.
                </p>
              </div>
              <span className="apartment-tag">не входит во второй этаж</span>
            </div>

            <div className="apartment-alert">
              <strong>Стяжка, перепад {fmt(apartmentStats.spread / 10, 1)} см.</strong>{' '}
              Сплошное выравнивание не нужно: снимите локальные бугры в углах и подмажьте
              центральные ямы. Целевая отметка для квартиры — {fmt(apartmentTargetZ / 10, 1)} см.
            </div>

            <RoomReport
              index={7}
              patch={apartmentPatch.def}
              field={apartmentPatch.field}
              stats={apartmentStats}
              targetZ={apartmentTargetZ}
              toleranceMm={toleranceMm}
            />
          </section>
        </div>
      </main>

      <footer className="app-footer">
        <p>
          Расчёт по фактическим замерам после шлифовки. Поверхность восстановлена по сетке
          50 см и центрам ячеек; объёмы посчитаны по плотной сетке 5 см. Плотность смеси —
          1,6 кг/л, мешок 25 кг.
        </p>
      </footer>
    </div>
  );
}
