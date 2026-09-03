import { useEffect, useState } from "react";
import type { SafeUser } from "@education-erp/api-client";
import { LoginScreen } from "./screens/LoginScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { StationScreen } from "./screens/StationScreen";

type Screen =
  | { name: "resuming" }
  | { name: "login" }
  | { name: "setup" }
  | { name: "station"; deviceId: string };

// Which device this physical station is configured for — non-sensitive
// UI preference, not a credential, so plain renderer localStorage is
// fine (unlike the refresh token, which only ever lives main-process-
// side, see electron/main/apiClient.ts). Same precedent as cctv-client's
// own cameraId key. One device per station this slice, matching
// cctv-client's own one-camera-per-station simplicity.
const DEVICE_ID_KEY = "device-gateway-client.deviceId";

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "resuming" });
  const [user, setUser] = useState<SafeUser | null>(null);

  useEffect(() => {
    window.deviceGatewayClient.tryResume().then((resumed) => {
      if (!resumed) {
        setScreen({ name: "login" });
        return;
      }
      const savedDeviceId = localStorage.getItem(DEVICE_ID_KEY);
      setScreen(savedDeviceId ? { name: "station", deviceId: savedDeviceId } : { name: "setup" });
    });
  }, []);

  async function handleLogout() {
    await window.deviceGatewayClient.logout();
    setUser(null);
    setScreen({ name: "login" });
  }

  switch (screen.name) {
    case "resuming":
      return (
        <div className="screen centered">
          <p>Resuming session…</p>
        </div>
      );
    case "login":
      return (
        <LoginScreen
          onLoggedIn={(loggedInUser) => {
            setUser(loggedInUser);
            const savedDeviceId = localStorage.getItem(DEVICE_ID_KEY);
            setScreen(savedDeviceId ? { name: "station", deviceId: savedDeviceId } : { name: "setup" });
          }}
        />
      );
    case "setup":
      return (
        <SetupScreen
          onConfigured={(deviceId) => {
            localStorage.setItem(DEVICE_ID_KEY, deviceId);
            setScreen({ name: "station", deviceId });
          }}
          onLogout={handleLogout}
        />
      );
    case "station":
      return (
        <StationScreen
          deviceId={screen.deviceId}
          user={user}
          onReconfigure={() => {
            localStorage.removeItem(DEVICE_ID_KEY);
            setScreen({ name: "setup" });
          }}
          onLogout={handleLogout}
        />
      );
  }
}
