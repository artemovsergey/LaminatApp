import { describe, expect, it } from 'vitest';
import { buildSurface, heightAt } from '../surface';
import { computeGrid, nodeGrid } from '../grid';
import { measurementsAtNodesOnly, measurementsFromHeights } from './helpers';

describe('Модель поверхности', () => {
  it('проходит через все замеренные точки', () => {
    const grid = computeGrid(5, 4, 50);
    const fn = (x: number, y: number) => -10 + 2 * x - 0.5 * y;
    const data = measurementsFromHeights(grid, fn);
    const field = buildSurface(data, grid);

    expect(field.measuredCount).toBe(grid.fineCountX * grid.fineCountY);

    for (let j = 0; j < grid.fineCountY; j += 3) {
      for (let i = 0; i < grid.fineCountX; i += 3) {
        const x = i * grid.stepX;
        const y = j * grid.stepY;
        expect(heightAt(field, x, y)).toBeCloseTo(fn(x, y), 3);
      }
    }
  });

  it('центры клеток интерполируются по узлам', () => {
    const grid = computeGrid(5, 4, 50);
    const fn = (x: number, y: number) => -10 + 4 * x - 3 * y;
    const data = measurementsAtNodesOnly(grid, fn);
    const field = buildSurface(data, grid);

    expect(field.measuredCount).toBe(grid.nodeCountX * grid.nodeCountY);

    // линейная функция интерполируется точно, включая незамеренные центры и середины рёбер
    for (let j = 0; j < grid.fineCountY; j++) {
      for (let i = 0; i < grid.fineCountX; i++) {
        const x = i * grid.stepX;
        const y = j * grid.stepY;
        expect(heightAt(field, x, y)).toBeCloseTo(fn(x, y), 1);
      }
    }
  });

  it('без замеров возвращает ровную поверхность', () => {
    const grid = computeGrid(3, 3, 50);
    const data = Array.from({ length: grid.fineCountY }, () =>
      Array.from({ length: grid.fineCountX }, () => null)
    );
    const field = buildSurface(data as (number | null)[][], grid);
    expect(field.measuredCount).toBe(0);
    expect(field.maxHeight).toBeCloseTo(0, 6);
    expect(field.minHeight).toBeCloseTo(0, 6);
  });

  it('сохраняет шаг 50 см и отдельный неполный крайний квадрат', () => {
    const grid = nodeGrid(1.2, 1);
    expect(grid.nodeCountX).toBe(4);
    expect(grid.fineCoordinatesX).toEqual([0, 0.25, 0.5, 0.75, 1, 1.1, 1.2]);
    expect(grid.fineCoordinatesY).toEqual([0, 0.25, 0.5, 0.75, 1]);

    const values = grid.fineCoordinatesY!.map(y =>
      grid.fineCoordinatesX!.map(x => -(2 * x + 3 * y))
    );
    const field = buildSurface(values, grid);
    expect(heightAt(field, 0.85, 0.75)).toBeCloseTo(2 * 0.85 + 3 * 0.75, 3);
    expect(heightAt(field, 1.2, 1)).toBeCloseTo(2 * 1.2 + 3, 3);
  });

  it('сохраняет уплотнённые ряды замеров в узком участке', () => {
    const grid = nodeGrid(1.35, 0.28, 50, 4, 3);
    expect(grid.fineCoordinatesY?.slice(0, 3)).toEqual([0, 0.07, 0.14]);
    expect(grid.fineCoordinatesY?.[3]).toBeCloseTo(0.21, 12);
    expect(grid.fineCoordinatesY?.[4]).toBeCloseTo(0.28, 12);
  });

  it('чем плотнее замеры, тем точнее поверхность', () => {
    const grid = computeGrid(5, 4, 50);
    const fn = (x: number, y: number) =>
      3 * Math.exp(-(((x - 2.5) ** 2 + (y - 2) ** 2) / (0.4 * 0.4)));

    const nodesOnly = buildSurface(measurementsAtNodesOnly(grid, fn), grid);
    const allPoints = buildSurface(measurementsFromHeights(grid, fn), grid);

    let errNodes = 0;
    let errAll = 0;
    let count = 0;
    for (let i = 0; i < 40; i++) {
      for (let j = 0; j < 30; j++) {
        const x = 0.3 + i * 0.11;
        const y = 0.4 + j * 0.11;
        const expected = fn(x, y);
        errNodes += Math.abs(heightAt(nodesOnly, x, y) - expected);
        errAll += Math.abs(heightAt(allPoints, x, y) - expected);
        count++;
      }
    }

    expect(errAll / count).toBeLessThan(errNodes / count);
    expect(errAll / count).toBeLessThan(0.05);
  });
});
