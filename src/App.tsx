import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RoomSetup } from './components/RoomSetup/RoomSetup';
import { FloorVisualization } from './components/FloorVisualization/FloorVisualization';
import { SummaryReport } from './components/SummaryReport/SummaryReport';
import { MeasurementGrid, GridConfig, AnalysisResult } from './types';
import { analyzeFloor } from './utils/analysis';
import { saveData, loadData, clearData } from './utils/storage';
import './App.css';

interface TestScenario {
  name: string;
  description: string;
  length: number;
  width: number;
  cellSize: number;
  data: MeasurementGrid;
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: '1. Реалистичный пол',
    description: 'Типичный пол с перепадами в разных участках',
    length: 5, width: 4, cellSize: 50,
    data: [
      [11.2, 11.0, 10.8, 10.5, 10.3, 10.4, 10.6, 10.9, 11.0, 11.1, 11.0],
      [11.3, 11.1, 10.7, 10.4, 10.2, 10.3, 10.5, 10.8, 11.1, 11.2, 11.1],
      [11.1, 11.2, 10.9, 10.6, 10.4, 10.5, 10.7, 11.0, 11.2, 11.0, 10.9],
      [11.0, 11.0, 11.0, 10.8, 10.9, 11.0, 10.8, 11.1, 11.3, 11.1, 11.0],
      [10.9, 11.1, 11.2, 11.1, 11.3, 11.2, 11.0, 11.2, 11.5, 11.3, 11.2],
      [11.0, 11.2, 11.3, 11.4, 11.5, 11.3, 11.1, 11.0, 11.2, 11.4, 11.3],
      [10.8, 11.0, 11.1, 11.2, 11.4, 11.2, 11.0, 10.9, 11.1, 11.2, 11.1],
      [10.9, 11.1, 11.0, 11.1, 11.3, 11.1, 11.0, 10.8, 11.0, 11.1, 11.0],
      [11.0, 11.0, 10.9, 11.0, 11.2, 11.0, 10.9, 10.9, 11.0, 11.0, 11.1],
    ],
  },
  {
    name: '2. Бугор + яма',
    description: 'Выпуклость слева, впадина справа',
    length: 5, width: 4, cellSize: 50,
    data: [
      [10.1, 10.0, 10.2, 10.5, 10.8, 11.0, 11.3, 11.5, 11.8, 12.0, 12.1],
      [10.0, 9.9, 10.1, 10.4, 10.7, 11.0, 11.4, 11.6, 11.9, 12.1, 12.2],
      [10.2, 10.1, 10.3, 10.6, 10.9, 11.1, 11.3, 11.5, 11.7, 11.9, 12.0],
      [10.5, 10.4, 10.6, 10.8, 11.0, 11.1, 11.2, 11.3, 11.5, 11.6, 11.7],
      [10.8, 10.7, 10.9, 11.0, 11.1, 11.1, 11.2, 11.3, 11.4, 11.5, 11.5],
      [11.0, 10.9, 11.0, 11.1, 11.1, 11.2, 11.2, 11.2, 11.3, 11.3, 11.3],
      [11.1, 11.0, 11.0, 11.1, 11.1, 11.1, 11.2, 11.2, 11.2, 11.2, 11.2],
      [11.0, 11.0, 11.0, 11.0, 11.1, 11.1, 11.1, 11.1, 11.2, 11.2, 11.2],
      [11.0, 11.0, 11.0, 11.0, 11.0, 11.1, 11.1, 11.1, 11.1, 11.1, 11.1],
    ],
  },
  {
    name: '3. Волна',
    description: 'Волнообразный перепад по всей комнате',
    length: 5, width: 4, cellSize: 50,
    data: [
      [10.0, 10.3, 10.8, 11.5, 12.0, 11.5, 10.8, 10.3, 10.0, 10.4, 10.9],
      [10.1, 10.4, 10.9, 11.4, 11.8, 11.4, 10.9, 10.4, 10.1, 10.5, 11.0],
      [10.4, 10.7, 11.1, 11.5, 11.7, 11.4, 11.0, 10.7, 10.4, 10.7, 11.1],
      [11.2, 11.3, 11.4, 11.3, 11.2, 11.2, 11.3, 11.3, 11.2, 11.1, 11.2],
      [11.8, 11.6, 11.3, 11.0, 10.8, 11.0, 11.3, 11.6, 11.8, 11.5, 11.3],
      [11.2, 11.0, 10.7, 10.4, 10.2, 10.4, 10.7, 11.0, 11.2, 11.0, 10.8],
      [10.4, 10.2, 10.0, 10.3, 10.7, 10.3, 10.0, 10.2, 10.5, 10.3, 10.1],
      [10.8, 10.5, 10.3, 10.5, 10.9, 10.5, 10.3, 10.5, 10.8, 10.6, 10.4],
      [11.1, 10.9, 10.6, 10.8, 11.0, 10.8, 10.6, 10.8, 11.0, 10.8, 10.7],
    ],
  },
  {
    name: '4. Правило 2м',
    description: 'Резкий перепад — нарушение правила 2м',
    length: 5, width: 4, cellSize: 50,
    data: [
      [11.0, 11.1, 11.0, 11.0, 11.1, 11.0, 11.0, 11.1, 11.0, 11.0, 11.1],
      [11.1, 11.0, 11.1, 11.0, 11.0, 11.1, 11.0, 11.0, 11.1, 11.0, 11.0],
      [11.0, 11.1, 11.0, 10.2, 13.8, 10.3, 11.0, 11.1, 11.0, 11.1, 11.0],
      [11.0, 11.0, 11.1, 11.0, 11.1, 11.0, 11.1, 11.0, 11.0, 11.0, 11.1],
      [11.1, 11.0, 11.0, 11.1, 11.0, 11.0, 11.0, 11.1, 11.0, 11.1, 11.0],
      [11.0, 11.1, 11.0, 11.0, 11.1, 11.0, 11.1, 11.0, 11.1, 11.0, 11.1],
      [11.1, 11.0, 11.1, 11.0, 11.0, 11.1, 11.0, 11.1, 11.0, 11.1, 11.0],
      [11.0, 11.1, 11.0, 11.1, 11.0, 11.0, 11.1, 11.0, 11.1, 11.0, 11.1],
      [11.1, 11.0, 11.1, 11.0, 11.1, 11.0, 11.0, 11.1, 11.0, 11.1, 11.0],
    ],
  },
  {
    name: '5. Неровный пол',
    description: 'Случайные перепады как при реальной заливке',
    length: 5, width: 4, cellSize: 50,
    data: [
      [11.4, 11.2, 10.8, 10.9, 11.3, 11.5, 11.1, 10.7, 11.0, 11.3, 11.2],
      [11.5, 11.0, 10.6, 11.1, 11.6, 11.2, 10.8, 10.5, 11.2, 11.6, 11.3],
      [11.1, 10.7, 10.4, 11.3, 11.8, 11.0, 10.6, 10.8, 11.5, 11.8, 11.4],
      [10.8, 10.5, 10.9, 11.5, 11.2, 10.7, 10.5, 11.2, 11.8, 11.4, 11.0],
      [11.0, 10.8, 11.4, 11.8, 11.0, 10.6, 10.9, 11.6, 12.0, 11.6, 11.2],
      [11.3, 11.1, 11.7, 11.5, 10.8, 10.5, 11.2, 11.9, 11.7, 11.3, 11.0],
      [11.0, 10.9, 11.3, 11.2, 10.7, 10.4, 11.0, 11.5, 11.4, 11.1, 10.9],
      [11.2, 11.0, 11.1, 11.0, 10.6, 10.5, 11.1, 11.7, 11.5, 11.2, 11.0],
      [11.1, 11.0, 11.0, 10.9, 10.8, 10.7, 11.0, 11.3, 11.2, 11.0, 10.9],
    ],
  },
];

function createEmptyGrid(cols: number, rows: number): MeasurementGrid {
  return Array.from({ length: rows + 1 }, () =>
    Array.from({ length: cols + 1 }, () => 0)
  );
}

function computeGrid(length: number, width: number, cellSize: number): GridConfig {
  const cols = Math.round((length * 100) / cellSize);
  const rows = Math.round((width * 100) / cellSize);
  return { cellSize, cols, rows, nodeCountX: cols + 1, nodeCountY: rows + 1 };
}

export default function App() {
  const stored = loadData();

  const [length, setLength] = useState(stored?.dimensions.length ?? 5);
  const [width, setWidth] = useState(stored?.dimensions.width ?? 4);
  const [cellSize, setCellSize] = useState(stored?.gridConfig.cellSize ?? 50);
  const [measurements, setMeasurements] = useState<MeasurementGrid>(() => {
    if (stored?.measurements && stored.measurements.length === 9 && stored.measurements[0].length === 11) {
      return stored.measurements;
    }
    clearData();
    return TEST_SCENARIOS[0].data;
  });

  const grid = useMemo(() => computeGrid(length, width, cellSize), [length, width, cellSize]);

  useEffect(() => {
    saveData({ length, width }, grid, measurements);
  }, [length, width, grid, measurements]);

  const handleDimensionChange = (l: number, w: number, cs: number) => {
    const newGrid = computeGrid(l, w, cs);
    const newMeasurements = createEmptyGrid(newGrid.cols, newGrid.rows);

    if (cs === cellSize) {
      const oldGrid = grid;
      for (let r = 0; r <= oldGrid.rows && r <= newGrid.rows; r++) {
        for (let c = 0; c <= oldGrid.cols && c <= newGrid.cols; c++) {
          if (r < measurements.length && c < measurements[0].length) {
            newMeasurements[r][c] = measurements[r][c];
          }
        }
      }
    }

    setLength(l);
    setWidth(w);
    setCellSize(cs);
    setMeasurements(newMeasurements);
  };

  const handleMeasurementChange = (row: number, col: number, value: number) => {
    setMeasurements(prev => {
      const next = prev.map(r => [...r]);
      next[row][col] = value;
      return next;
    });
  };

  const result = analyzeFloor(measurements, grid);

  const handleClear = () => {
    if (confirm('Очистить все замеры?')) {
      clearData();
      setMeasurements(createEmptyGrid(grid.cols, grid.rows));
    }
  };

  const loadScenario = (scenario: TestScenario) => {
    clearData();
    setLength(scenario.length);
    setWidth(scenario.width);
    setCellSize(scenario.cellSize);
    setMeasurements(scenario.data);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Анализ ровности пола</h1>
        <p className="subtitle">Подготовка основания под ламинат</p>
      </header>

      <main className="app-main">
        <RoomSetup
          length={length}
          width={width}
          cellSize={cellSize}
          onChange={handleDimensionChange}
        />

        <FloorVisualization
          measurements={measurements}
          cells={result.cells}
          grid={grid}
          ruleViolations={result.ruleViolations}
          onMeasurementChange={handleMeasurementChange}
        />

        <SummaryReport result={result} grid={grid} />

        <div className="actions">
          <button className="btn btn-secondary" onClick={handleClear}>
            Очистить замеры
          </button>
        </div>

        <div className="test-scenarios">
          <h3>Тестовые сценарии</h3>
          <div className="scenario-buttons">
            {TEST_SCENARIOS.map((s, i) => (
              <button
                key={i}
                className="btn btn-scenario"
                onClick={() => loadScenario(s)}
                title={s.description}
              >
                {s.name}
              </button>
            ))}
          </div>
          <p className="scenario-hint">Нажмите, чтобы загрузить тестовые замеры. Данные сохраняются в браузере.</p>
        </div>
      </main>
    </div>
  );
}
