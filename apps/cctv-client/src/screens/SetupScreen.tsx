import { useEffect, useState, type FormEvent } from "react";
import type { CameraRecord } from "@education-erp/api-client";

export function SetupScreen({
  onConfigured,
  onLogout,
}: {
  onConfigured: (cameraId: string) => void;
  onLogout: () => void;
}) {
  const [cameras, setCameras] = useState<CameraRecord[] | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    window.cctvClient.listCameras().then(setCameras);
  }, []);

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const camera = await window.cctvClient.registerCamera({
        name,
        location: location || undefined,
      });
      onConfigured(camera.id);
    } catch {
      setError("Could not register this camera. Check the name and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen centered">
      <div className="card">
        <h1>Set up this station</h1>
        <p className="muted">Pick the camera this physical station represents, or register a new one.</p>

        {cameras === null ? (
          <p>Loading cameras…</p>
        ) : cameras.length === 0 ? (
          <p className="muted">No cameras registered for this organization yet.</p>
        ) : (
          <ul className="camera-list">
            {cameras.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onConfigured(c.id)}>
                  {c.name}
                  {c.location ? ` — ${c.location}` : ""}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={onRegister}>
          <label>
            New camera name
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Location (optional)
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={submitting || !name}>
            {submitting ? "Registering…" : "Register and use this camera"}
          </button>
        </form>

        <button type="button" className="link-button" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
