import type { EntityId } from '@kinetic/protocol';

export interface SpatialIndexDiagnostics {
  occupiedCells: number;
  maxBucketSize: number;
  cellCount: number;
}

export interface SpatialIndex {
  rebuild(ids: readonly EntityId[], xOf: (id: EntityId) => number, yOf: (id: EntityId) => number): void;
  forEachCandidatePair(callback: (a: EntityId, b: EntityId) => void): void;
  forEachInAabb(minX: number, minY: number, maxX: number, maxY: number, callback: (id: EntityId) => void): void;
  getDiagnostics(): SpatialIndexDiagnostics;
}

/**
 * Deterministic broad phase for circle bodies and projectile queries.
 *
 * Buckets are allocated once and reused every tick. Only buckets that were
 * occupied in the previous rebuild are cleared, avoiding Map and array churn
 * during large battles.
 */
export class SpatialHashGrid implements SpatialIndex {
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: EntityId[][];
  private readonly occupiedKeys: number[] = [];
  private occupiedCellCount = 0;
  private maxBucketSize = 0;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly cellSize: number
  ) {
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    this.cells = Array.from({ length: this.cols * this.rows }, () => [] as EntityId[]);
  }

  rebuild(ids: readonly EntityId[], xOf: (id: EntityId) => number, yOf: (id: EntityId) => number): void {
    for (const key of this.occupiedKeys) this.cells[key]?.splice(0);
    this.occupiedKeys.splice(0);
    this.occupiedCellCount = 0;
    this.maxBucketSize = 0;

    for (const id of ids) {
      const key = this.keyFor(xOf(id), yOf(id));
      const bucket = this.cells[key];
      if (!bucket) continue;
      if (bucket.length === 0) {
        this.occupiedKeys.push(key);
        this.occupiedCellCount += 1;
      }
      bucket.push(id);
      if (bucket.length > this.maxBucketSize) this.maxBucketSize = bucket.length;
    }
  }

  forEachCandidatePair(callback: (a: EntityId, b: EntityId) => void): void {
    const neighborOffsets: readonly [number, number][] = [
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1]
    ];

    // Row-major traversal and ascending insertion order keep pair ordering
    // deterministic across browsers and machines.
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const key = row * this.cols + col;
        const bucket = this.cells[key];
        if (!bucket || bucket.length === 0) continue;

        for (let i = 0; i < bucket.length; i += 1) {
          const a = bucket[i];
          if (a === undefined) continue;
          for (let j = i + 1; j < bucket.length; j += 1) {
            const b = bucket[j];
            if (b !== undefined) callback(a, b);
          }
        }

        for (const [dx, dy] of neighborOffsets) {
          const nc = col + dx;
          const nr = row + dy;
          if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) continue;
          const neighbor = this.cells[nr * this.cols + nc];
          if (!neighbor || neighbor.length === 0) continue;
          for (const a of bucket) {
            for (const b of neighbor) callback(a, b);
          }
        }
      }
    }
  }

  forEachInAabb(minX: number, minY: number, maxX: number, maxY: number, callback: (id: EntityId) => void): void {
    const minCol = this.clampCol(Math.floor(Math.min(minX, maxX) / this.cellSize));
    const maxCol = this.clampCol(Math.floor(Math.max(minX, maxX) / this.cellSize));
    const minRow = this.clampRow(Math.floor(Math.min(minY, maxY) / this.cellSize));
    const maxRow = this.clampRow(Math.floor(Math.max(minY, maxY) / this.cellSize));

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const bucket = this.cells[row * this.cols + col];
        if (!bucket || bucket.length === 0) continue;
        for (const id of bucket) callback(id);
      }
    }
  }

  getDiagnostics(): SpatialIndexDiagnostics {
    return {
      occupiedCells: this.occupiedCellCount,
      maxBucketSize: this.maxBucketSize,
      cellCount: this.cells.length
    };
  }

  private keyFor(x: number, y: number): number {
    return this.clampRow(Math.floor(y / this.cellSize)) * this.cols + this.clampCol(Math.floor(x / this.cellSize));
  }

  private clampCol(value: number): number {
    return Math.max(0, Math.min(this.cols - 1, value));
  }

  private clampRow(value: number): number {
    return Math.max(0, Math.min(this.rows - 1, value));
  }
}
