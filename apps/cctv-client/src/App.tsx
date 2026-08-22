import { useEffect, useState } from "react";
import type { SafeUser } from "@education-erp/api-client";
import { LoginScreen } from "./screens/LoginScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { StationScreen } from "./screens/StationScreen";

type Screen =
  | { name: "resuming" }
  | { name: "login" }
  | { name: "setup" }
  | { name: "station"; cameraId: string };

// Which camera this physical station is configured for, and how often
// it captures — non-sensitive UI preference, not a credential, so
// plain renderer localStorage is fine (unlike the refresh token, which
// only ever lives main-process-side, see electron/main/apiClient.ts).
const CAMERA_ID_KEY = "cctv-client.cameraId";

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "resuming" });
  const [user, setUser] = useState<SafeUser | null>(null);

  useEffect(() => {
    window.cctvClient.tryResume().then((resumed) => {
      if (!resumed) {
        setScreen({ name: "login" });
        return;
      }
      const savedCameraId = localStorage.getItem(CAMERA_ID_KEY);
      setScreen(savedCameraId ? { name: "station", cameraId: savedCameraId } : { name: "setup" });
    });
  }, []);

  async function handleLogout() {
    await window.cctvClient.logout();
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
            const savedCameraId = localStorage.getItem(CAMERA_ID_KEY);
            setScreen(savedCameraId ? { name: "station", cameraId: savedCameraId } : { name: "setup" });
          }}
        />
      );
    case "setup":
      return (
        <SetupScreen
          onConfigured={(cameraId) => {
            localStorage.setItem(CAMERA_ID_KEY, cameraId);
            setScreen({ name: "station", cameraId });
          }}
          onLogout={handleLogout}
        />
      );
    case "station":
      return (
        <StationScreen
          cameraId={screen.cameraId}
          user={user}
          onReconfigure={() => {
            localStorage.removeItem(CAMERA_ID_KEY);
            setScreen({ name: "setup" });
          }}
          onLogout={handleLogout}
        />
      );
  }
}
