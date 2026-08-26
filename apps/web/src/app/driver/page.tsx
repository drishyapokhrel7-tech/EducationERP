"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { LogOut } from "lucide-react";
import { ApiError } from "@education-erp/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { fetchOsrmRoute, straightLineDistanceMeters, type OsrmRoute } from "@/lib/osrm";
import type { MapMarker } from "@/components/transport/live-tracking-map";

// react-leaflet touches `window` at import time — must never run during
// SSR, even inside a "use client" file (Next.js still renders those on
// the server for the initial HTML).
const LiveTrackingMap = dynamic(
  () => import("@/components/transport/live-tracking-map").then((m) => m.LiveTrackingMap),
  { ssr: false },
);

const TRACKING_INTERVAL_MS = 20_000;
const OSRM_REFRESH_MS = 15_000;

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? "under a minute" : `${minutes} min`;
}

export default function DriverPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !user) router.replace("/login");
  }, [mounted, user, router]);

  const me = useSWR("driver-portal-me", () => api.getDriverPortalMe(), { shouldRetryOnError: false });

  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [osrmRoute, setOsrmRoute] = useState<OsrmRoute | null>(null);
  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Live position — foreground-only, no background/service-worker
  // tracking (this is a plain web page, not a native app).
  useEffect(() => {
    if (!navigator.geolocation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGeoError("This browser doesn't support location tracking");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError("Location permission was denied — allow it in your browser to start tracking"),
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const route = me.data?.route ?? null;

  // Push the current position to the server every ~20s while this page
  // is open — reads from a ref so the interval always sends the latest
  // fix instead of the one captured when it was created.
  useEffect(() => {
    if (!route) return;
    const post = () => {
      const p = positionRef.current;
      if (!p) return;
      api.submitDriverTracking({ routeId: route.id, latitude: p.lat, longitude: p.lng }).catch(() => {});
    };
    post();
    const interval = setInterval(post, TRACKING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [route]);

  const stopsWithCoords = (route?.stops ?? []).filter(
    (s): s is typeof s & { latitude: string; longitude: string } => s.latitude != null && s.longitude != null,
  );

  const nextStop =
    position && stopsWithCoords.length > 0
      ? stopsWithCoords.reduce<{ stop: (typeof stopsWithCoords)[number]; distance: number } | null>((closest, s) => {
          const d = straightLineDistanceMeters(position, { lat: Number(s.latitude), lng: Number(s.longitude) });
          return !closest || d < closest.distance ? { stop: s, distance: d } : closest;
        }, null)
      : null;

  const lastOsrmFetchRef = useRef(0);
  useEffect(() => {
    if (!position || !nextStop) return;
    const now = Date.now();
    if (now - lastOsrmFetchRef.current < OSRM_REFRESH_MS) return;
    lastOsrmFetchRef.current = now;
    let cancelled = false;
    fetchOsrmRoute(position, { lat: Number(nextStop.stop.latitude), lng: Number(nextStop.stop.longitude) }).then(
      (r) => {
        if (!cancelled) setOsrmRoute(r);
      },
    );
    return () => {
      cancelled = true;
    };
    // Primitive deps only — position/nextStop are new objects every
    // render, comparing their derived coordinates instead keeps this
    // from re-firing on every unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, nextStop?.stop.id]);

  if (!mounted || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    );
  }

  const markers: MapMarker[] = [];
  if (position) markers.push({ id: "me", lat: position.lat, lng: position.lng, label: "You are here" });
  for (const s of stopsWithCoords) {
    markers.push({ id: s.id, lat: Number(s.latitude), lng: Number(s.longitude), label: s.name });
  }

  const center: [number, number] = position
    ? [position.lat, position.lng]
    : stopsWithCoords.length > 0
      ? [Number(stopsWithCoords[0].latitude), Number(stopsWithCoords[0].longitude)]
      : [27.7172, 85.324]; // Kathmandu — arbitrary fallback when nothing is known yet

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <span className="font-semibold">Driver</span>
        <Button variant="ghost" size="icon" onClick={() => logout().then(() => router.push("/login"))}>
          <LogOut className="size-4" />
        </Button>
      </header>
      <main className="flex-1 space-y-4 p-4">
        {me.error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm">
                {me.error instanceof ApiError && me.error.status === 404
                  ? "This account isn't linked to a driver profile. Ask an admin to set one up."
                  : "Couldn't load your driver profile — try reloading the page."}
              </p>
            </CardContent>
          </Card>
        ) : !me.data ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>
                  {me.data.driver.employee.firstName} {me.data.driver.employee.lastName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {route ? (
                  <>
                    <p>
                      Route <span className="font-medium">{route.name}</span> ({route.code})
                    </p>
                    <p className="text-muted-foreground">
                      {route.vehicle ? route.vehicle.registrationNumber : "No vehicle assigned"}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No route is assigned to you yet.</p>
                )}
                {geoError ? <p className="text-destructive">{geoError}</p> : null}
                {!geoError && !position ? (
                  <p className="text-muted-foreground">Waiting for your location…</p>
                ) : null}
              </CardContent>
            </Card>

            {route ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Live map</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <LiveTrackingMap
                    center={center}
                    markers={markers}
                    routeLine={osrmRoute?.coordinates}
                    heightClassName="h-96"
                  />
                  {nextStop ? (
                    <p className="text-sm">
                      Next stop <span className="font-medium">{nextStop.stop.name}</span> —{" "}
                      {osrmRoute
                        ? `${formatDistance(osrmRoute.distanceMeters)}, about ${formatDuration(osrmRoute.durationSeconds)} by road`
                        : `${formatDistance(nextStop.distance)} away (straight line)`}
                    </p>
                  ) : stopsWithCoords.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      This route&apos;s stops don&apos;t have coordinates set yet.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
