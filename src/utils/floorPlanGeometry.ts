import type { FloorModel } from './floorModel';

export interface PlanRect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export interface FloorPlanGeometry {
  rooms: Record<'garden' | 'small' | 'corridor' | 'hall' | 'yard' | 'arch', PlanRect>;
  stair: PlanRect;
  wc: PlanRect;
  corridorY: number;
  rearY: number;
  rearWindowY: number;
}

export function getFloorPlanGeometry(model: FloorModel): FloorPlanGeometry {
  const get = (id: string) => {
    const patch = model.patches.find(item => item.def.id === id)?.def;
    if (!patch) throw new Error(`Не найдены размеры помещения для плана: ${id}`);
    return patch;
  };
  const garden = get('garden');
  const small = get('small');
  const corridor = get('corridor');
  const hall = get('hall');
  const yard = get('yard');
  const arch = get('arch');
  const roomSplitX = 2.11;
  const corridorY = garden.widthM;
  const rearY = corridorY + corridor.widthM;
  const rearWindowY = rearY + hall.widthM;

  return {
    rooms: {
      garden: { x: roomSplitX - garden.lengthM, y: 0, width: garden.lengthM, depth: garden.widthM },
      small: { x: roomSplitX, y: 0, width: small.lengthM, depth: small.widthM },
      corridor: { x: 0, y: corridorY, width: corridor.lengthM, depth: corridor.widthM },
      hall: { x: roomSplitX - hall.lengthM, y: rearY, width: hall.lengthM, depth: hall.widthM },
      yard: {
        x: roomSplitX + small.lengthM - yard.widthM,
        y: rearWindowY - yard.lengthM,
        width: yard.widthM,
        depth: yard.lengthM,
      },
      arch: {
        x: roomSplitX - 1.56,
        y: rearY,
        width: arch.lengthM,
        depth: arch.widthM,
      },
    },
    stair: { x: -1.2, y: corridorY, width: 1.2, depth: corridor.widthM },
    wc: {
      x: corridor.lengthM,
      y: corridorY,
      width: roomSplitX + small.lengthM - corridor.lengthM,
      depth: rearY + hall.widthM - yard.lengthM - corridorY,
    },
    corridorY,
    rearY,
    rearWindowY,
  };
}
