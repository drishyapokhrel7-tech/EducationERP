"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";

// Leaflet's default marker icon paths don't resolve through Next.js's
// bundler out of the box — point them at the same CDN version leaflet
// itself ships, rather than wiring up asset imports for icons only.
const defaultIcon = L.icon({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

export function LiveTrackingMap({
  center,
  markers,
  routeLine,
  zoom = 13,
  heightClassName = "h-80",
}: {
  center: [number, number];
  markers: MapMarker[];
  routeLine?: [number, number][];
  zoom?: number;
  heightClassName?: string;
}) {
  return (
    <div className={`${heightClassName} w-full overflow-hidden rounded-md border`}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]}>
            <Popup>{m.label}</Popup>
          </Marker>
        ))}
        {routeLine && routeLine.length > 1 ? <Polyline positions={routeLine} /> : null}
      </MapContainer>
    </div>
  );
}
