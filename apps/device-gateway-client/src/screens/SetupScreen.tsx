import { useEffect, useState, type FormEvent } from "react";
import type { GatewayDeviceRecord, GatewayDeviceType } from "@education-erp/api-client";

const DEVICE_TYPES: GatewayDeviceType[] = [
  "BARCODE_SCANNER",
  "RFID_READER",
  "SMART_CARD_READER",
  "FINGERPRINT_SCANNER",
  "PRINTER",
];

export function SetupScreen({
  onConfigured,
  onLogout,
}: {
  onConfigured: (deviceId: string) => void;
  onLogout: () => void;
}) {
  const [devices, setDevices] = useState<GatewayDeviceRecord[] | null>(null);
  const [name, setName] = useState("");
  const [deviceType, setDeviceType] = useState<GatewayDeviceType>("BARCODE_SCANNER");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    window.deviceGatewayClient.listDevices().then(setDevices);
  }, []);

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const device = await window.deviceGatewayClient.registerDevice({
        name,
        deviceType,
        location: location || undefined,
      });
      onConfigured(device.id);
    } catch {
      setError("Could not register this device. Check the name and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen centered">
      <div className="card">
        <h1>Set up this station</h1>
        <p className="muted">Pick the device this physical station represents, or register a new one.</p>

        {devices === null ? (
          <p>Loading devices…</p>
        ) : devices.length === 0 ? (
          <p className="muted">No devices registered for this organization yet.</p>
        ) : (
          <ul className="device-list">
            {devices.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => onConfigured(d.id)}>
                  {d.name} <span className="device-type">{d.deviceType.replace(/_/g, " ")}</span>
                  {d.location ? ` — ${d.location}` : ""}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={onRegister}>
          <label>
            New device name
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Device type
            <select value={deviceType} onChange={(e) => setDeviceType(e.target.value as GatewayDeviceType)}>
              {DEVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Location (optional)
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={submitting || !name}>
            {submitting ? "Registering…" : "Register and use this device"}
          </button>
        </form>

        <button type="button" className="link-button" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
