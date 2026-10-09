import { useState } from 'react';
import { FloorModel, PatchModel } from '../../utils/floorModel';
import { getFloorPlanGeometry } from '../../utils/floorPlanGeometry';
import { sampleMap } from '../../utils/surface';
import styles from './FloorPlan2D.module.css';

interface Props {
  model: FloorModel;
  targetZ: number;
  toleranceMm: number;
  selectedRoomId: string;
}

const roomInfo = (model: FloorModel, id: string) => {
  const patch = model.patches.find(item => item.def.id === id);
  if (!patch) throw new Error(`Не найдены размеры помещения: ${id}`);
  return `${patch.def.lengthM.toFixed(2).replace('.', ',')} × ${patch.def.widthM
    .toFixed(2)
    .replace('.', ',')} м`;
};

function roomGrid(
  patch: PatchModel,
  room: { x: number; y: number; width: number; depth: number },
  origin: 'west' | 'east' | 'south' | 'south-right' | 'south-depth' | 'wc-door',
  targetZ: number,
  toleranceMm: number,
  heatmap: boolean
) {
  const cellSize = 0.5;
  const cells: JSX.Element[] = [];
  const alongNodes = Array.from(
    { length: patch.def.grid.nodeCountX },
    (_, index) => patch.def.grid.fineCoordinatesX?.[index * 2] ?? Math.min(index * cellSize, patch.def.lengthM)
  );
  const depthNodes = Array.from(
    { length: patch.def.grid.nodeCountY },
    (_, index) => patch.def.grid.fineCoordinatesY?.[index * 2] ?? Math.min(index * cellSize, patch.def.widthM)
  );
  const point = (along: number, depth: number) => ({
    x: origin === 'south-depth'
      ? room.x + room.width - depth
      : origin === 'east' || origin === 'wc-door'
        ? room.x + room.width - along
        : origin === 'south-right'
          ? room.x + room.width - along
        : room.x + along,
    y: origin === 'south' || origin === 'south-right' || origin === 'south-depth'
      ? room.y + room.depth - (origin === 'south-depth' ? along : depth)
      : origin === 'west'
        ? room.y + room.depth - depth
        : room.y + depth,
  });

  for (let alongIndex = 0; alongIndex < alongNodes.length - 1; alongIndex++) {
    const along = alongNodes[alongIndex];
    const alongSize = alongNodes[alongIndex + 1] - along;
    for (let depthIndex = 0; depthIndex < depthNodes.length - 1; depthIndex++) {
      const depth = depthNodes[depthIndex];
      const depthSize = depthNodes[depthIndex + 1] - depth;
      const x = origin === 'south-depth'
        ? room.x + room.width - depth - depthSize
        : origin === 'east' || origin === 'wc-door' || origin === 'south-right'
          ? room.x + room.width - along - alongSize
          : room.x + along;
      const y = origin === 'south-depth'
        ? room.y + room.depth - along - alongSize
        : origin === 'south' || origin === 'south-right'
          ? room.y + room.depth - depth - depthSize
          : origin === 'west'
            ? room.y + room.depth - depth - depthSize
            : room.y + depth;
      const cellWidth = origin === 'south-depth' ? depthSize : alongSize;
      const cellHeight = origin === 'south-depth' ? alongSize : depthSize;
      const localAlong = Math.min(along + alongSize / 2, patch.field.lengthM);
      const localDepth = Math.min(depth + depthSize / 2, patch.field.widthM);
      const z = -sampleMap(patch.field, localAlong, localDepth);
      const delta = z - targetZ;
      const fill =
        !heatmap ? 'transparent' :
          delta > toleranceMm ? '#83c6ed' :
          delta < -toleranceMm ? '#f29a8e' :
          '#dce8d3';
      cells.push(
        <rect
          key={`${patch.def.id}-${alongIndex}-${depthIndex}`}
          x={x}
          y={y}
          width={cellWidth}
          height={cellHeight}
          fill={fill}
          className={styles.gridCell}
          aria-label={`${patch.def.name}: ${z.toFixed(1)} мм`}
        />
      );
    }
  }

  if (heatmap) {
    for (let row = 0; row < depthNodes.length; row++) {
      for (let col = 0; col < alongNodes.length; col++) {
        const nodeValue = patch.def.measurements[row * 2]?.[col * 2];
        if (nodeValue !== null && nodeValue !== undefined) {
          const position = point(alongNodes[col], depthNodes[row]);
          const sourceRow = patch.def.transposeMeasurements ? col : row;
          const sourcePoint = patch.def.transposeMeasurements ? row : col;
          cells.push(
            <g key={`${patch.def.id}-node-${row}-${col}`}>
              <g data-room={patch.def.id} data-coordinate={`${sourceRow + 1}.${sourcePoint + 1}`}>
                    <circle
                cx={position.x}
                cy={position.y}
                r="0.045"
                className={styles.nodeMeasurement}
              >
                <title>{`${sourceRow + 1}.${sourcePoint + 1} · ${(nodeValue / 10).toFixed(1).replace('.', ',')} см`}</title>
              </circle>
              <text
                x={position.x + 0.055}
                y={position.y - 0.045}
                className={styles.measurementLabel}
              >
                {sourceRow + 1}.{sourcePoint + 1}
              </text>
        </g>
            </g>
          );
        }
      }
    }

    if (patch.def.centerPlacement === 'middle-row') {
      const centerDepth = (depthNodes[0] + depthNodes[1]) / 2;
      for (let col = 0; col < alongNodes.length; col++) {
        const centerValue = patch.def.measurements[1]?.[col * 2];
        if (centerValue === null || centerValue === undefined) continue;
        const position = point(alongNodes[col], centerDepth);
        const sourceRow = patch.def.transposeMeasurements ? col : 0;
        const sourcePoint = patch.def.transposeMeasurements ? 0 : col;
        cells.push(
          <g key={`${patch.def.id}-center-row-${col}`}>
            <g data-room={patch.def.id} data-coordinate={`${sourceRow + 1}.${sourcePoint + 1}ц`}>
            <circle
              cx={position.x}
              cy={position.y}
              r="0.035"
              className={styles.centerMeasurement}
            >
              <title>{`${sourceRow + 1}.${sourcePoint + 1}ц · ${(centerValue / 10).toFixed(1).replace('.', ',')} см`}</title>
            </circle>
            </g>
          </g>
        );
      }
    } else {
      for (let row = 0; row < depthNodes.length - 1; row++) {
        for (let col = 0; col < alongNodes.length - 1; col++) {
          const centerValue = patch.def.measurements[row * 2 + 1]?.[col * 2 + 1];
          if (centerValue === null || centerValue === undefined) continue;
          const position = point(
            (alongNodes[col] + alongNodes[col + 1]) / 2,
            (depthNodes[row] + depthNodes[row + 1]) / 2
          );
          const sourceRow = patch.def.transposeMeasurements ? col : row;
          const sourcePoint = patch.def.transposeMeasurements ? row : col;
          cells.push(
            <g key={`${patch.def.id}-center-${row}-${col}`}>
              <g data-room={patch.def.id} data-coordinate={`${sourceRow + 1}.${sourcePoint + 1}ц`}>
              <circle
                cx={position.x}
                cy={position.y}
                r="0.035"
                className={styles.centerMeasurement}
              >
                <title>{`${sourceRow + 1}.${sourcePoint + 1}ц · ${(centerValue / 10).toFixed(1).replace('.', ',')} см`}</title>
              </circle>
              </g>
            </g>
          );
        }
      }
    }
  }
  return cells;
}

export function FloorPlan2D({ model, targetZ, toleranceMm, selectedRoomId }: Props) {
  const [heatmap, setHeatmap] = useState(false);
  const patch = (id: string) => {
    const item = model.patches.find(value => value.def.id === id);
    if (!item) throw new Error(`Не найден участок плана: ${id}`);
    return item;
  };
  const garden = patch('garden');
  const small = patch('small');
  const corridor = patch('corridor');
  const hall = patch('hall');
  const yard = patch('yard');
  const arch = patch('arch');
  const geometry = getFloorPlanGeometry(model);
  const plan = { ...geometry.rooms, ...geometry };
  const roomSplitX = 2.11;
  const yardDoorX = roomSplitX + 0.5;
  const archX = plan.arch.x;
  const archGridRoom = plan.arch;
  const hallEntryX = archX + 0.45;
  const viewBox = {
    x: plan.hall.x - 1.2,
    y: -1.15,
    width: plan.yard.x + plan.yard.width - plan.hall.x + 2.0,
    height: plan.rearWindowY + 3.7,
  };

  const wall = (d: string, outer = false) => (
    <path
      key={d}
      d={d}
      className={outer ? styles.outerWall : styles.partition}
    />
  );

  const roomLabel = (
    x: number,
    y: number,
    title: string,
    dimensions: string,
    compact = false
  ) => (
    <g className={styles.roomLabel} key={title}>
      <text x={x} y={y} className={styles.roomName}>
        {title}
      </text>
      {!compact && (
        <text x={x} y={y + 0.3} className={styles.roomDimensions}>
          {dimensions}
        </text>
      )}
    </g>
  );

  const dimension = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    label: string,
    textX: number,
    textY: number,
    rotate = 0
  ) => (
    <g className={styles.dimension} key={`${label}-${x1}-${y1}`}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        markerStart="url(#dimensionArrow)"
        markerEnd="url(#dimensionArrow)"
      />
      <text
        x={textX}
        y={textY}
        transform={rotate ? `rotate(${rotate} ${textX} ${textY})` : undefined}
      >
        {label}
      </text>
    </g>
  );

  const horizontalWindow = (x1: number, x2: number, y: number) => (
    <g className={styles.window} key={`window-${x1}-${y}`}>
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 0.09} x2={x2} y2={y - 0.09} />
      <line x1={x1} y1={y + 0.09} x2={x2} y2={y + 0.09} />
      <line x1={x1} y1={y - 0.14} x2={x1} y2={y + 0.14} />
      <line x1={x2} y1={y - 0.14} x2={x2} y2={y + 0.14} />
    </g>
  );

  const verticalWindow = (x: number, y1: number, y2: number) => (
    <g className={styles.window} key={`window-${x}-${y1}`}>
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 0.09} y1={y1} x2={x - 0.09} y2={y2} />
      <line x1={x + 0.09} y1={y1} x2={x + 0.09} y2={y2} />
      <line x1={x - 0.14} y1={y1} x2={x + 0.14} y2={y1} />
      <line x1={x - 0.14} y1={y2} x2={x + 0.14} y2={y2} />
    </g>
  );

  const horizontalDoor = (hingeX: number, wallY: number, opensUp: boolean) => {
    const direction = opensUp ? -1 : 1;
    const leafY = wallY + direction * 0.8;
    const endX = hingeX + 0.8;
    return (
      <g className={styles.door} key={`door-${hingeX}-${wallY}`}>
        <line x1={hingeX} y1={wallY} x2={hingeX} y2={leafY} />
        <path
          d={`M ${hingeX} ${leafY} Q ${endX} ${leafY} ${endX} ${wallY}`}
        />
      </g>
    );
  };

  const verticalDoor = (wallX: number, hingeY: number, opensRight: boolean) => {
    const direction = opensRight ? 1 : -1;
    const leafX = wallX + direction * 0.8;
    const endY = hingeY + 0.8;
    return (
      <g className={styles.door} key={`door-${wallX}-${hingeY}`}>
        <line x1={wallX} y1={hingeY} x2={leafX} y2={hingeY} />
        <path
          d={`M ${leafX} ${hingeY} Q ${leafX} ${endY} ${wallX} ${endY}`}
        />
      </g>
    );
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.planToolbar}>
        <button
          type="button"
          className={heatmap ? styles.modeButton : `${styles.modeButton} ${styles.modeButtonActive}`}
          onClick={() => setHeatmap(false)}
        >
          Архитектурный план
        </button>
        <button
          type="button"
          className={heatmap ? `${styles.modeButton} ${styles.modeButtonActive}` : styles.modeButton}
          onClick={() => setHeatmap(true)}
        >
          Сетка и тепловая карта
        </button>
        {heatmap && (
          <span className={styles.heatLegend}>
            <i className={styles.grindSwatch} /> шлифовка
            <i className={styles.fillSwatch} /> подмазка
            <i className={styles.levelSwatch} /> допуск ±{toleranceMm} мм
            <i className={styles.nodeSwatch} /> узел
            <i className={styles.centerSwatch} /> центр квадрата
            <span>подпись — номер исходного замера: ряд.точка</span>
          </span>
        )}
      </div>
      <div className={styles.sheet}>
        <svg
          className={styles.drawing}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          role="img"
          aria-label="План второго этажа"
          aria-describedby="floor-plan-description"
        >
          <desc id="floor-plan-description">
            Масштабная схема комнат с дверями, окнами и размерными линиями.
            Размеры санузла и лестницы показаны условно.
          </desc>
          <defs>
            <marker
              id="dimensionArrow"
              markerWidth="0.12"
              markerHeight="0.12"
              refX="0.06"
              refY="0.06"
              orient="auto-start-reverse"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 0.12 0.01 L 0.01 0.06 L 0.12 0.11" />
            </marker>
            <pattern
              id="stairTreads"
              width="0.18"
              height="0.18"
              patternUnits="userSpaceOnUse"
            >
              <path d="M 0 0.18 H 0.18" />
            </pattern>
            <pattern
              id="wcHatch"
              width="0.14"
              height="0.14"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <path d="M 0 0 V 0.14" />
            </pattern>
            <pattern
              id="doorwayProjection"
              width="0.18"
              height="0.18"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <path d="M 0 0 V 0.18" />
            </pattern>
          </defs>

          <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} className={styles.paper} />
          <rect x={viewBox.x + 0.2} y={viewBox.y + 0.2} width={viewBox.width - 0.4} height={viewBox.height - 0.4} className={styles.border} />

          <g className={styles.floorFill}>
            <rect x={plan.garden.x} y={plan.garden.y} width={plan.garden.width} height={plan.garden.depth} />
            <rect x={plan.small.x} y={plan.small.y} width={plan.small.width} height={plan.small.depth} />
            <rect x={plan.corridor.x} y={plan.corridor.y} width={plan.corridor.width} height={plan.corridor.depth} />
            <rect x={plan.hall.x} y={plan.hall.y} width={plan.hall.width} height={plan.hall.depth} />
            <rect x={plan.yard.x} y={plan.yard.y} width={plan.yard.width} height={plan.yard.depth} />
            <rect x={plan.wc.x} y={plan.wc.y} width={plan.wc.width} height={plan.wc.depth} />
            <rect x={plan.stair.x} y={plan.stair.y} width={plan.stair.width} height={plan.stair.depth} />
          </g>

          <g className={styles.doorwayProjection}>
            <rect x={yardDoorX} y={plan.rearY} width="0.8" height={plan.yard.y - plan.rearY} />
            <text x={yardDoorX + 0.4} y={(plan.rearY + plan.yard.y) / 2}>
              ВЫСТУП {(plan.yard.y - plan.rearY).toFixed(2).replace('.', ',')} м*
            </text>
          </g>

          <g className={`${styles.measurementGrid} ${heatmap ? styles.measurementHeatmap : ''}`}>
            {roomGrid(garden, plan.garden, 'west', targetZ, toleranceMm, heatmap)}
            {roomGrid(small, plan.small, 'east', targetZ, toleranceMm, heatmap)}
            {roomGrid(corridor, plan.corridor, 'wc-door', targetZ, toleranceMm, heatmap)}
            {roomGrid(hall, plan.hall, 'south-right', targetZ, toleranceMm, heatmap)}
            {roomGrid(yard, plan.yard, 'south-depth', targetZ, toleranceMm, heatmap)}
            {roomGrid(arch, archGridRoom, 'west', targetZ, toleranceMm, heatmap)}
          </g>

          <g className={styles.stairs}>
            <rect
              x={plan.stair.x + 0.08}
              y={plan.stair.y + 0.12}
              width={plan.stair.width - 0.16}
              height={plan.stair.depth - 0.24}
              fill="url(#stairTreads)"
            />
            <text x={plan.stair.x + plan.stair.width / 2} y={4.58}>
              ЛЕСТНИЦА
            </text>
          </g>

          <g className={styles.wc}>
            <rect x={plan.wc.x + 0.12} y={plan.wc.y + 0.12} width={plan.wc.width - 0.24} height={plan.wc.depth - 0.24} fill="url(#wcHatch)" />
            <text x={4.7} y={4.32}>С/У</text>
            <text x={4.7} y={4.55} className={styles.unknownSize}>габарит условный</text>
          </g>

          <g className={styles.walls}>
            {wall(`M ${plan.garden.x} 0 H ${plan.small.x + plan.small.width}`, true)}
            {wall(`M ${plan.garden.x} 0 V 1.02 M ${plan.garden.x} 2.42 V ${plan.garden.depth}`, true)}
            {wall(`M ${plan.small.x + plan.small.width} 0 V 1.035 M ${plan.small.x + plan.small.width} 2.435 V ${plan.small.depth}`, true)}
            {wall(`M ${plan.garden.x} ${plan.garden.depth} H 0.6 M 1.4 ${plan.garden.depth} H 2.6 M 3.4 ${plan.garden.depth} H ${plan.small.x + plan.small.width}`, true)}
            {wall(`M ${plan.small.x} 0 V ${plan.garden.depth}`)}

            {wall(`M ${plan.hall.x} ${plan.hall.y} V ${plan.rearWindowY}`, true)}
            {wall(`M ${plan.hall.x} ${plan.rearWindowY} H ${hallEntryX - 0.4} M ${hallEntryX + 0.4} ${plan.rearWindowY} H ${plan.hall.x + plan.hall.width}`, true)}
            {wall(`M ${plan.hall.x + plan.hall.width} ${plan.hall.y} V ${plan.rearWindowY}`)}
            {wall(`M ${plan.yard.x} ${plan.yard.y} V ${plan.yard.y + plan.yard.depth}`)}
            {wall(`M ${plan.yard.x + plan.yard.width} ${plan.yard.y} V ${plan.yard.y + plan.yard.depth}`, true)}
            {wall(`M ${plan.yard.x} ${plan.rearWindowY} H ${plan.yard.x + 1.1} M ${plan.yard.x + 2.6} ${plan.rearWindowY} H ${plan.yard.x + plan.yard.width}`, true)}
            {wall(`M ${plan.yard.x} ${plan.yard.y} V ${plan.rearY} M ${plan.yard.x} ${plan.rearY + 1.47} V ${plan.yard.y}`)}
            {wall(`M ${plan.yard.x} ${plan.yard.y} H ${plan.yard.x + 0.6} M ${plan.yard.x + 1.4} ${plan.yard.y} H ${plan.yard.x + plan.yard.width}`)}

            {wall(`M 0 ${plan.corridorY} V ${plan.corridorY + 0.63} M 0 ${plan.corridorY + 1.43} V ${plan.rearY}`)}
            {wall(`M ${plan.corridor.width} ${plan.corridorY} V ${plan.corridorY + 0.63} M ${plan.corridor.width} ${plan.corridorY + 1.43} V ${plan.rearY}`)}
            {wall(`M ${plan.wc.x} ${plan.wc.y} H ${plan.wc.x + plan.wc.width}`)}
            {wall(`M ${plan.wc.x} ${plan.wc.y} V ${plan.wc.y + plan.wc.depth} H ${plan.wc.x + plan.wc.width}`)}
            {wall(`M ${plan.wc.x + plan.wc.width} ${plan.wc.y} V ${plan.wc.y + plan.wc.depth}`, true)}
            {wall(`M 0 ${plan.corridorY} H 0.6 M 1.4 ${plan.corridorY} H 2.6 M 3.4 ${plan.corridorY} H ${plan.corridor.width}`)}
            {wall(`M 0 ${plan.rearY} H ${archX} M ${archX + 0.9} ${plan.rearY} H ${yardDoorX} M ${yardDoorX + 0.8} ${plan.rearY} H ${plan.corridor.width}`)}
            {wall(`M ${yardDoorX} ${plan.rearY} V ${plan.yard.y}`)}
            {wall(`M ${yardDoorX + 0.8} ${plan.rearY} V ${plan.yard.y}`)}
          </g>

          {[
            ['garden', plan.garden],
            ['small', plan.small],
            ['corridor', plan.corridor],
            ['hall', plan.hall],
            ['yard', plan.yard],
          ].map(([id, room]) => {
            const roomId = id as string;
            const rect = room as { x: number; y: number; width: number; depth: number };
            return selectedRoomId === roomId ? (
              <rect
                key={`selected-${roomId}`}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.depth}
                className={styles.selectedRoom}
              />
            ) : null;
          })}

          <g className={styles.windowFrames}>
            {verticalWindow(plan.garden.x, 1.02, 2.42)}
            {verticalWindow(plan.small.x + plan.small.width, 1.035, 2.435)}
            {horizontalWindow(plan.hall.x + plan.hall.width / 2 - 0.7, plan.hall.x + plan.hall.width / 2 + 0.7, plan.rearWindowY)}
            {horizontalWindow(plan.yard.x + plan.yard.width / 2 - 0.75, plan.yard.x + plan.yard.width / 2 + 0.75, plan.rearWindowY)}
          </g>

          <g className={styles.doors}>
            {horizontalDoor(0.6, plan.garden.depth, true)}
            {horizontalDoor(2.6, plan.garden.depth, true)}
            {horizontalDoor(yardDoorX, plan.rearY, false)}
            {verticalDoor(0, plan.corridorY + 0.63, true)}
            {verticalDoor(plan.corridor.width, plan.corridorY + 0.63, true)}
          </g>

          <g className={styles.arch}>
            <path
              fill="none"
              d={`M ${archX} ${plan.rearY} Q ${hallEntryX} ${plan.rearY + 0.38} ${archX + 0.9} ${plan.rearY}`}
            />
            <text x={hallEntryX} y={plan.rearY + 0.3}>АРКА</text>
          </g>

          <g className={styles.roomLabels}>
            {roomLabel(-0.595, 1.55, 'КОМНАТА НА ОГОРОД', roomInfo(model, 'garden'))}
            {roomLabel(3.86, 1.55, 'МАЛАЯ КОМНАТА', roomInfo(model, 'small'))}
            {roomLabel(2.15, plan.corridorY + plan.corridor.depth / 2, 'КОРИДОР', roomInfo(model, 'corridor'))}
            {roomLabel(plan.hall.x + plan.hall.width / 2, plan.hall.y + plan.hall.depth / 2, 'ЗАЛ', roomInfo(model, 'hall'))}
            {roomLabel(plan.yard.x + plan.yard.width / 2, plan.yard.y + plan.yard.depth / 2, 'КОМНАТА ВО ДВОР', roomInfo(model, 'yard'))}
          </g>

          <g className={styles.dimensions}>
            <line x1={plan.garden.x} y1="-0.34" x2={plan.garden.x} y2="-0.08" />
            <line x1={plan.garden.x + plan.garden.width} y1="-0.34" x2={plan.garden.x + plan.garden.width} y2="-0.08" />
            {dimension(plan.garden.x, -0.28, plan.garden.x + plan.garden.width, -0.28, roomInfo(model, 'garden').split(' × ')[0], -0.595, -0.18)}
            <line x1={plan.small.x} y1="-0.72" x2={plan.small.x} y2="-0.08" />
            <line x1={plan.small.x + plan.small.width} y1="-0.72" x2={plan.small.x + plan.small.width} y2="-0.08" />
            {dimension(plan.small.x, -0.66, plan.small.x + plan.small.width, -0.66, roomInfo(model, 'small').split(' × ')[0], 3.86, -0.56)}

            <line x1={plan.hall.x} y1="10.68" x2={plan.hall.x} y2="10.45" />
            <line x1={plan.hall.x + plan.hall.width} y1="10.68" x2={plan.hall.x + plan.hall.width} y2="10.45" />
            {dimension(plan.hall.x, 10.62, plan.hall.x + plan.hall.width, 10.62, roomInfo(model, 'hall').split(' × ')[0], -0.575, 10.52)}
            <line x1={plan.yard.x} y1="10.98" x2={plan.yard.x} y2="9.1" />
            <line x1={plan.yard.x + plan.yard.width} y1="10.98" x2={plan.yard.x + plan.yard.width} y2="9.1" />
            {dimension(plan.yard.x, 10.92, plan.yard.x + plan.yard.width, 10.92, roomInfo(model, 'yard').split(' × ')[1], plan.yard.x + plan.yard.width / 2, 10.82)}

            <line x1="-3.85" y1="0" x2="-3.38" y2="0" />
            <line x1="-3.85" y1={plan.garden.depth} x2="-3.38" y2={plan.garden.depth} />
            {dimension(-3.78, 0, -3.78, plan.garden.depth, roomInfo(model, 'garden').split(' × ')[1], -3.9, 1.735, -90)}
            <line x1="-4.18" y1={plan.hall.y} x2="-3.34" y2={plan.hall.y} />
            <line x1="-4.18" y1={plan.hall.y + plan.hall.depth} x2="-3.34" y2={plan.hall.y + plan.hall.depth} />
            {dimension(-4.1, plan.hall.y, -4.1, plan.hall.y + plan.hall.depth, roomInfo(model, 'hall').split(' × ')[1], -4.22, 7.96, -90)}

            <line x1="7.22" y1="0" x2="5.68" y2="0" />
            <line x1="7.22" y1={plan.small.depth} x2="5.68" y2={plan.small.depth} />
            {dimension(7.12, 0, 7.12, plan.small.depth, roomInfo(model, 'small').split(' × ')[1], 7.25, 1.735, -90)}
            <line x1={plan.yard.x + plan.yard.width + 1.0} y1={plan.yard.y} x2={plan.yard.x + plan.yard.width + 0.3} y2={plan.yard.y} />
            <line x1={plan.yard.x + plan.yard.width + 1.0} y1={plan.yard.y + plan.yard.depth} x2={plan.yard.x + plan.yard.width + 0.3} y2={plan.yard.y + plan.yard.depth} />
            {dimension(plan.yard.x + plan.yard.width + 0.5, plan.yard.y, plan.yard.x + plan.yard.width + 0.5, plan.yard.y + plan.yard.depth, roomInfo(model, 'yard').split(' × ')[0], plan.yard.x + plan.yard.width + 0.63, plan.yard.y + plan.yard.depth / 2, -90)}
          </g>

          <g className={styles.corridorDimensions}>
            <rect x="1.46" y="3.72" width="1.38" height="0.38" rx="0.04" />
            <text x="2.15" y="3.98">{roomInfo(model, 'corridor')}</text>
          </g>

          <g className={styles.scaleBar}>
            <text x="5.48" y="11.35">ЛИНЕЙНЫЙ МАСШТАБ, м</text>
            <line x1="5.5" y1="11.68" x2="7.5" y2="11.68" />
            <line x1="5.5" y1="11.56" x2="5.5" y2="11.8" />
            <line x1="6.5" y1="11.56" x2="6.5" y2="11.8" />
            <line x1="7.5" y1="11.56" x2="7.5" y2="11.8" />
            <text x="5.5" y="12.02">0</text>
            <text x="6.5" y="12.02">1</text>
            <text x="7.5" y="12.02">2</text>
          </g>

          <g className={styles.note}>
            <text x={viewBox.x + 0.35} y="12.03">Сетка 0,5 м от стороны окна; крайние клетки укорочены по обмеру.</text>
            <text x={viewBox.x + 0.35} y="12.28">*Окна зала и комнаты во двор совмещены; габариты С/У и лестницы условные.</text>
          </g>
        </svg>
      </div>
    </div>
  );
}
