import { MeasurementGrid, RoomDimensions, GridConfig } from '../types';

const STORAGE_KEY = 'laminat-app-data';

interface StoredData {
  dimensions: RoomDimensions;
  gridConfig: GridConfig;
  measurements: MeasurementGrid;
}

export function saveData(dimensions: RoomDimensions, gridConfig: GridConfig, measurements: MeasurementGrid): void {
  const data: StoredData = { dimensions, gridConfig, measurements };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadData(): StoredData | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredData;
  } catch {
    return null;
  }
}

export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY);
}
