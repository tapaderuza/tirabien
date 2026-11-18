import type { StreamId } from './types';

/** [latitude, longitude] in WGS84 degrees. */
export type LatLon = [number, number];

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

/** Shape of public/data/containers.json, produced by scripts/fetch-containers.mjs. */
export interface ContainerData {
  generated: string;
  source: string;
  license: string;
  bbox: [number, number, number, number];
  streams: Partial<Record<StreamId, LatLon[]>>;
  /** Named places (recycling centres) that deserve a label on the map. */
  places: Partial<Record<StreamId, Place[]>>;
}

/** Plaza de la Constitución, used when the user does not share a location. */
export const MALAGA_CENTRE: LatLon = [36.72106, -4.42163];

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Nearest {
  point: LatLon;
  index: number;
  meters: number;
}

/**
 * Uniform grid over lat/lon for k-nearest queries. Rings of cells are
 * searched outward until no unvisited cell can hold anything closer.
 */
export class GridIndex {
  private readonly cells = new Map<string, number[]>();
  private readonly minCellMeters: number;
  private minX = Infinity;
  private maxX = -Infinity;
  private minY = Infinity;
  private maxY = -Infinity;

  constructor(
    readonly points: LatLon[],
    private readonly cellDeg = 0.005,
  ) {
    let latSum = 0;
    points.forEach((p, i) => {
      const x = Math.floor(p[1] / cellDeg);
      const y = Math.floor(p[0] / cellDeg);
      this.minX = Math.min(this.minX, x);
      this.maxX = Math.max(this.maxX, x);
      this.minY = Math.min(this.minY, y);
      this.maxY = Math.max(this.maxY, y);
      const key = `${x}:${y}`;
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(i);
      else this.cells.set(key, [i]);
      latSum += p[0];
    });
    const lat = points.length ? latSum / points.length : 0;
    // A cell is narrower east–west than north–south away from the equator.
    const latMeters = (cellDeg * Math.PI * R) / 180;
    this.minCellMeters = Math.min(latMeters, latMeters * Math.cos(rad(Math.min(85, Math.abs(lat) + 1))));
  }

  get size(): number {
    return this.points.length;
  }

  nearest(p: LatLon, k = 3): Nearest[] {
    if (this.points.length === 0 || k <= 0) return [];
    const cx = Math.floor(p[1] / this.cellDeg);
    const cy = Math.floor(p[0] / this.cellDeg);
    const maxRing = Math.max(
      Math.abs(cx - this.minX),
      Math.abs(cx - this.maxX),
      Math.abs(cy - this.minY),
      Math.abs(cy - this.maxY),
    );
    const found: Nearest[] = [];
    for (let r = 0; r <= maxRing; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const bucket = this.cells.get(`${cx + dx}:${cy + dy}`);
          if (!bucket) continue;
          for (const i of bucket) {
            const point = this.points[i]!;
            found.push({ point, index: i, meters: haversineMeters(p, point) });
          }
        }
      }
      if (found.length >= k) {
        found.sort((a, b) => a.meters - b.meters);
        // Anything in ring r+1 or beyond is at least r cells away.
        if (found[k - 1]!.meters <= r * this.minCellMeters) return found.slice(0, k);
      }
    }
    found.sort((a, b) => a.meters - b.meters);
    return found.slice(0, k);
  }
}

/** Walking time at about 4.8 km/h, never less than one minute. */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 80));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

/** True when the point lies inside the data's bounding box [south, west, north, east]. */
export function insideBbox(p: LatLon, bbox: [number, number, number, number]): boolean {
  return p[0] >= bbox[0] && p[0] <= bbox[2] && p[1] >= bbox[1] && p[1] <= bbox[3];
}
