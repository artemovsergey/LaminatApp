import { useMemo, useState } from 'react';
import { FloorLeveling } from './components/FloorLeveling/FloorLeveling';
import { FloorPlan2D } from './components/FloorPlan2D/FloorPlan2D';
import { Floor3D } from './components/Floor3D/Floor3D';
import { FlooringLayout } from './components/FlooringLayout/FlooringLayout';
import { DEFAULT_RULE_OPTIONS } from './utils/rule';
import { buildFloorModel } from './utils/floorModel';
import { LevelRoomInput, computeFloorReference } from './utils/floorTarget';
import './App.css';

export default function App() {
  const model = useMemo(() => buildFloorModel(), []);
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
  const reference = useMemo(() => computeFloorReference(rooms), [rooms]);
  const [targetZ, setTargetZ] = useState(reference.medianZ);
  const [activeRoomId, setActiveRoomId] = useState('corridor');

  return (
    <div className="app app-compact">
      <header className="app-header">
        <h1>План и выравнивание пола — второй этаж</h1>
        <p className="subtitle">
          Обмерные размеры · сетка 50 см · тепловая карта и объём коррекции
        </p>
      </header>
      <main className="app-main app-main-compact">
        <section className="panel plan-only-panel">
          <h2 className="panel-title">Архитектурный план и карта поверхности</h2>
          <FloorPlan2D
            model={model}
            targetZ={targetZ}
            toleranceMm={DEFAULT_RULE_OPTIONS.toleranceMm}
            selectedRoomId={activeRoomId}
          />
        </section>
        <FloorLeveling
          rooms={rooms}
          toleranceMm={DEFAULT_RULE_OPTIONS.toleranceMm}
          activeZoneId={activeRoomId}
          onSelectZone={setActiveRoomId}
          targetZ={targetZ}
          onTargetChange={setTargetZ}
        />
        <section className="panel plan-only-panel">
          <h2 className="panel-title">3D-поверхность и выравнивание</h2>
          <p className="section-intro">
            Красный — снять высокий участок, синий — заполнить низкий. Голубая сетка показывает
            целевую плоскость пола.
          </p>
          <Floor3D
            model={model}
            rules={{}}
            analyses={{}}
            layer="deviation"
            activeZoneId="all"
            currentPlacement={null}
            mode="leveling"
            targetZ={targetZ}
            toleranceMm={DEFAULT_RULE_OPTIONS.toleranceMm}
          />
        </section>
        <FlooringLayout model={model} targetZ={targetZ} />
      </main>
    </div>
  );
}
