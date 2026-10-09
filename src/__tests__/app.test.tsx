// @vitest-environment happy-dom
import { describe, expect, it, beforeAll } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import App from '../App';

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  }
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const flush = (ms: number) =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, ms));
  });

describe('Приложение', () => {
  it('рендерится без ошибок и показывает минимальный план', () => {
    const html = renderToString(createElement(App));
    expect(html).toContain('План второго этажа');
    expect(html).toContain('КОМНАТА НА ОГОРОД');
    expect(html).toContain('ЛИНЕЙНЫЙ МАСШТАБ');
  });

  it('монтируется и отображает план с размерами и планировочными обозначениями', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(App));
    });
    await flush(80);

    const text = container.textContent ?? '';
    expect(container.querySelector('svg[aria-label="План второго этажа"]')).not.toBeNull();
    expect(text).toContain('ЗАЛ');
    expect(text).toContain('КОМНАТА ВО ДВОР');

    const floorRects = container.querySelectorAll('g[class*="floorFill"] rect');
    const smallRight = Number(floorRects[1].getAttribute('x')) +
      Number(floorRects[1].getAttribute('width'));
    const yardRight = Number(floorRects[4].getAttribute('x')) +
      Number(floorRects[4].getAttribute('width'));
    expect(yardRight).toBeCloseTo(smallRight, 6);

    const heatmapButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Сетка и тепловая карта')
    );
    expect(heatmapButton).toBeDefined();
    await act(async () => heatmapButton?.click());

    const nodeTitles = Array.from(container.querySelectorAll('circle[class*="nodeMeasurement"] > title'));
    expect(nodeTitles.some(title => title.textContent === '1.1 · 10,5 см')).toBe(true);
    const centerMarkers = Array.from(container.querySelectorAll('circle[class*="centerMeasurement"]'));
    expect(centerMarkers.some(marker => marker.querySelector('title')?.textContent === '1.1ц · 11,4 см')).toBe(true);
    expect(centerMarkers.every(marker => !marker.parentElement?.querySelector('text'))).toBe(true);
    expect(container.querySelector('svg.drawing > title')).toBeNull();

    const hallFirstPoint = container.querySelector(
      'g[data-room="hall"][data-coordinate="1.1"] circle[class*="nodeMeasurement"]'
    );
    const yardFirstPoint = container.querySelector(
      'g[data-room="yard"][data-coordinate="1.1"] circle[class*="nodeMeasurement"]'
    );
    expect(Number(hallFirstPoint?.getAttribute('cx'))).toBeGreaterThan(
      Number(floorRects[3].getAttribute('x')) + Number(floorRects[3].getAttribute('width')) / 2
    );
    expect(Number(yardFirstPoint?.getAttribute('cx'))).toBeGreaterThan(
      Number(floorRects[4].getAttribute('x')) + Number(floorRects[4].getAttribute('width')) / 2
    );

    const levelingCanvas = container.querySelector('canvas[aria-label^="3D-модель пола"]');
    expect(levelingCanvas?.getAttribute('aria-label')).toContain('Целевой уровень');
    const walkButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Пройти по комнатам')
    );
    expect(walkButton).toBeDefined();
    await act(async () => walkButton?.click());
    expect(Array.from(container.querySelectorAll('button')).some(button =>
      button.textContent?.includes('Пауза прогулки')
    )).toBe(true);

    const thirdPattern = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Прямая · 1/3')
    );
    await act(async () => thirdPattern?.click());
    expect(thirdPattern?.getAttribute('aria-pressed')).toBe('true');

    const layoutCanvas = container.querySelector<HTMLCanvasElement>(
      'canvas[aria-label^="3D-раскладка ламината"]'
    );
    expect(layoutCanvas).not.toBeNull();
    expect(layoutCanvas?.getAttribute('aria-label')).toContain('этаж перевернут');
    const flipFloorButton = Array.from(layoutCanvas?.parentElement?.querySelectorAll('button') ?? []).find(button =>
      button.textContent?.includes('Вернуть вид по плану')
    );
    expect(flipFloorButton).toBeDefined();
    await act(async () => flipFloorButton?.click());
    expect(layoutCanvas?.getAttribute('aria-label')).toContain('вид по плану');

    const herringbone = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Ёлочка')
    );
    await act(async () => herringbone?.click());
    expect(herringbone?.getAttribute('aria-pressed')).toBe('true');
    expect(layoutCanvas?.getAttribute('aria-label')).toContain('herringbone');

    const underlayToggle = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]'
    );
    expect(underlayToggle).not.toBeNull();
    await act(async () => underlayToggle?.click());
    expect(underlayToggle?.checked).toBe(true);
    expect(layoutCanvas?.getAttribute('aria-label')).toContain('единое полотно');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  }, 20000);
});
