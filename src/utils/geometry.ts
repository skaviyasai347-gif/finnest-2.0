// ==============================================================================
// FINNEST - Cadastral Geometry Utilities
// Spherical Geodesic Area Calculation, Centroid, and GeoJSON Validation
// ==============================================================================

export interface AreaCalculation {
  sqMeters: number;
  sqFeet: number;
  acres: number;
  hectares: number;
  formattedM2: string;
  formattedSqFt: string;
  formattedAcres: string;
}

const WGS84_RADIUS = 6378137.0; // Earth mean radius in meters

/**
 * Converts degrees to radians
 */
function toRadians(deg: number): number {
  return (deg * Math.PI) / 180.0;
}

/**
 * Calculates geodesic spherical area of a polygon from [longitude, latitude] coordinates.
 * Implements the spherical excess / surveyor formula on WGS84 sphere.
 * Accurate for parcels from small plots to large rural estates.
 */
export function calculatePolygonArea(coords: [number, number][] | number[][]): AreaCalculation {
  if (!coords || coords.length < 3) {
    return {
      sqMeters: 0,
      sqFeet: 0,
      acres: 0,
      hectares: 0,
      formattedM2: '0 m²',
      formattedSqFt: '0 sq.ft',
      formattedAcres: '0 acres',
    };
  }

  // Remove duplicate closing point if present
  let ring: [number, number][] = coords as [number, number][];
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1] && coords.length > 3) {
    ring = coords.slice(0, -1) as [number, number][];
  }

  const n = ring.length;
  if (n < 3) {
    return {
      sqMeters: 0,
      sqFeet: 0,
      acres: 0,
      hectares: 0,
      formattedM2: '0 m²',
      formattedSqFt: '0 sq.ft',
      formattedAcres: '0 acres',
    };
  }

  let totalExcess = 0;
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n];
    const next = ring[(i + 1) % n];

    const latRad = toRadians(ring[i][1]);
    const prevLngRad = toRadians(prev[0]);
    const nextLngRad = toRadians(next[0]);

    totalExcess += (nextLngRad - prevLngRad) * Math.sin(latRad);
  }

  const sqMeters = Math.abs((totalExcess * WGS84_RADIUS * WGS84_RADIUS) / 2.0);
  const sqFeet = sqMeters * 10.7639104;
  const acres = sqMeters / 4046.8564224;
  const hectares = sqMeters / 10000.0;

  return {
    sqMeters: Math.round(sqMeters * 100) / 100,
    sqFeet: Math.round(sqFeet * 100) / 100,
    acres: Math.round(acres * 1000) / 1000,
    hectares: Math.round(hectares * 1000) / 1000,
    formattedM2: `${sqMeters.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`,
    formattedSqFt: `${sqFeet.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} sq.ft`,
    formattedAcres: `${acres.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} acres`,
  };
}

/**
 * Calculates geographic centroid [longitude, latitude] of a polygon
 */
export function calculateCentroid(coords: [number, number][] | number[][]): [number, number] {
  if (!coords || coords.length === 0) return [80.235, 12.98];

  let ring = coords;
  if (coords.length > 1 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1]) {
    ring = coords.slice(0, -1);
  }

  if (ring.length === 0) return [80.235, 12.98];

  let sumLng = 0;
  let sumLat = 0;
  for (const pt of ring) {
    sumLng += pt[0];
    sumLat += pt[1];
  }

  return [
    Math.round((sumLng / ring.length) * 1000000) / 1000000,
    Math.round((sumLat / ring.length) * 1000000) / 1000000,
  ];
}

/**
 * Ensures a ring of [longitude, latitude] coordinates is closed by repeating the first vertex
 */
export function closePolygonRing(coords: [number, number][]): [number, number][] {
  if (!coords || coords.length === 0) return [];
  const ring = [...coords];
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

/**
 * Converts Leaflet [latitude, longitude] pairs to GeoJSON [longitude, latitude] pairs
 */
export function leafletToGeoJSON(latlngs: { lat: number; lng: number }[] | [number, number][]): [number, number][] {
  const result: [number, number][] = latlngs.map(pt => {
    if (Array.isArray(pt)) {
      return [pt[1], pt[0]]; // [lat, lng] -> [lng, lat]
    }
    return [pt.lng, pt.lat];
  });
  return closePolygonRing(result);
}

/**
 * Converts GeoJSON [longitude, latitude] pairs to Leaflet [latitude, longitude] pairs
 */
export function geoJSONToLeaflet(coords: [number, number][] | number[][]): [number, number][] {
  if (!coords) return [];
  return coords.map(pt => [pt[1], pt[0]]);
}

/**
 * Validates GeoJSON Polygon structure
 */
export function validateGeoJSONPolygon(geojson: any): { valid: boolean; error?: string } {
  if (!geojson) {
    return { valid: false, error: 'Geometry is empty or undefined.' };
  }

  if (geojson.type !== 'Polygon') {
    return { valid: false, error: `Geometry type must be 'Polygon', received '${geojson.type}'.` };
  }

  if (!Array.isArray(geojson.coordinates) || geojson.coordinates.length === 0) {
    return { valid: false, error: 'Polygon coordinates must be a non-empty array of linear rings.' };
  }

  const ring = geojson.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    return { valid: false, error: 'A cadastral polygon ring must have at least 4 positions (minimum 3 unique vertices plus closing point).' };
  }

  for (let i = 0; i < ring.length; i++) {
    const pt = ring[i];
    if (!Array.isArray(pt) || pt.length < 2 || isNaN(pt[0]) || isNaN(pt[1])) {
      return { valid: false, error: `Vertex at index ${i} has invalid coordinates.` };
    }
    const [lng, lat] = pt;
    if (lng < -180 || lng > 180) {
      return { valid: false, error: `Longitude ${lng} is outside valid range [-180, 180].` };
    }
    if (lat < -90 || lat > 90) {
      return { valid: false, error: `Latitude ${lat} is outside valid range [-90, 90].` };
    }
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(first[0] - last[0]) > 1e-7 || Math.abs(first[1] - last[1]) > 1e-7) {
    return { valid: false, error: 'Polygon ring must be closed (first and final coordinates must be identical).' };
  }

  return { valid: true };
}
