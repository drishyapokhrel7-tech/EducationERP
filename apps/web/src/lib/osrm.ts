// OSRM's public demo server (router.project-osrm.org) — free, no API
// key, CORS-enabled for direct browser calls. Its own usage policy is
// light-use-only; fine for one school's small fleet, not something to
// scale to many institutions without a self-hosted instance.
export interface OsrmRoute {
  coordinates: [number, number][]; // [lat, lng]
  distanceMeters: number;
  durationSeconds: number;
}

export async function fetchOsrmRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<OsrmRoute | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng],
    );
    return { coordinates, distanceMeters: route.distance, durationSeconds: route.duration };
  } catch {
    return null;
  }
}

export function straightLineDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
