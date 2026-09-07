export interface Plane {
  a: number;
  b: number;
  c: number;
}

export function computePlane(measurements: number[][], cols: number, rows: number): Plane {
  const n = (cols + 1) * (rows + 1);
  let sumX = 0, sumY = 0, sumZ = 0;
  let sumXX = 0, sumYY = 0, sumXY = 0, sumXZ = 0, sumYZ = 0;

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = c;
      const y = r;
      const z = measurements[r][c];
      sumX += x;
      sumY += y;
      sumZ += z;
      sumXX += x * x;
      sumYY += y * y;
      sumXY += x * y;
      sumXZ += x * z;
      sumYZ += y * z;
    }
  }

  const denom = n * sumXX * sumYY + 2 * sumX * sumY * sumXY
    - sumXX * sumY * sumY - sumYY * sumX * sumX - n * sumXY * sumXY;

  if (Math.abs(denom) < 1e-10) {
    return { a: 0, b: 0, c: sumZ / n };
  }

  const a = (n * sumXZ * sumYY + sumY * sumXY * sumYZ + sumX * sumY * sumYZ
    - n * sumXY * sumYZ - sumX * sumXZ * sumYY - sumY * sumYZ * sumXX) / denom;

  const b = (n * sumXX * sumYZ + sumX * sumXY * sumXZ + sumX * sumY * sumXZ
    - n * sumXY * sumXZ - sumY * sumXX * sumYZ - sumX * sumXZ * sumYY) / denom;

  const c = (sumZ - a * sumX - b * sumY) / n;

  return { a, b, c };
}

export function planeValue(plane: Plane, x: number, y: number): number {
  return plane.a * x + plane.b * y + plane.c;
}
