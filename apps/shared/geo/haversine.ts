/**
 * Haversine distance calculation — drop-in replacement for PostGIS ST_Distance.
 * All functions use WGS-84 coordinates (latitude/longitude in degrees).
 */

const EARTH_RADIUS_KM = 6_371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Returns distance in **kilometers** between two WGS-84 points. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Returns distance in **meters**. */
export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

/** Check if a point is within `radiusM` meters of a center point. */
export function isWithinRadius(
  pointLat: number,
  pointLng: number,
  centerLat: number,
  centerLng: number,
  radiusM: number,
): boolean {
  return haversineM(pointLat, pointLng, centerLat, centerLng) <= radiusM;
}

/** NxN distance matrix in km (for VRP / routing). */
export function haversineMatrix(
  points: Array<{ lat: number; lng: number }>,
): number[][] {
  const n = points.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversineKm(points[i].lat, points[i].lng, points[j].lat, points[j].lng);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }
  return matrix;
}

/**
 * Simple grid-based spatial clustering (replaces PostGIS ST_ClusterDBSCAN).
 * Groups points that are within `radiusM` of each other using a union-find approach.
 * Returns cluster IDs (-1 = noise, i.e. cluster size < minPoints).
 */
export function clusterPoints<T extends { lat: number; lng: number }>(
  points: T[],
  radiusM: number,
  minPoints: number,
): Array<{ point: T; clusterId: number }> {
  const n = points.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  // Merge points within radius
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (haversineM(points[i].lat, points[i].lng, points[j].lat, points[j].lng) <= radiusM) {
        union(i, j);
      }
    }
  }

  // Count cluster sizes
  const clusterSizes = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    clusterSizes.set(root, (clusterSizes.get(root) ?? 0) + 1);
  }

  // Assign sequential IDs, mark small clusters as noise (-1)
  const rootToId = new Map<number, number>();
  let nextId = 0;
  for (const [root, size] of clusterSizes) {
    rootToId.set(root, size >= minPoints ? nextId++ : -1);
  }

  return points.map((point, i) => ({
    point,
    clusterId: rootToId.get(find(i)) ?? -1,
  }));
}
