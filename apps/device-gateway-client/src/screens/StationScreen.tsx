import { useCallback, useEffect, useRef, useState } from "react";
import type {
  EmployeePicker,
  GatewayScanEvent,
  GatewayScanResult,
  SafeUser,
  StudentPicker,
} from "@education-erp/api-client";

export function StationScreen({
  deviceId,
  user,
  onReconfigure,
  onLogout,
}: {
  deviceId: string;
  user: SafeUser | null;
  onReconfigure: () => void;
  onLogout: () => void;
}) {
  // The scan input mechanism: an always-focused, plain <input> that
  // submits on Enter. This is the standard, well-established way a
  // USB-HID-keyboard-wedge device (the overwhelming majority of
  // commodity barcode scanners and institutional RFID/smart-card
  // readers) is consumed by kiosk software — the device's whole
  // mechanism *is* emulating keystrokes into whatever has focus, so no
  // vendor driver/SDK is needed. No interkeystroke-timing heuristic to
  // disambiguate a scan from human typing (a deliberate, disclosed
  // scope line, not an oversight) — this station's input is only ever
  // supposed to receive scanner input.
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawCode, setRawCode] = useState("");
  const [lastScan, setLastScan] = useState<GatewayScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [events, setEvents] = useState<GatewayScanEvent[] | null>(null);

  // The "who does this belong to?" bind flow, entered only after an
  // unrecognized scan.
  const [binding, setBinding] = useState(false);
  const [students, setStudents] = useState<StudentPicker[] | null>(null);
  const [employees, setEmployees] = useState<EmployeePicker[] | null>(null);
  const [bindTarget, setBindTarget] = useState("");
  const [bindError, setBindError] = useState<string | null>(null);

  const refocus = useCallback(() => inputRef.current?.focus(), []);

  useEffect(() => {
    refocus();
  }, [refocus]);

  const refreshEvents = useCallback(() => {
    window.deviceGatewayClient.listRecentEvents().then(setEvents);
  }, []);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  async function onSubmitScan(e: React.FormEvent) {
    e.preventDefault();
    const code = rawCode.trim();
    setRawCode("");
    if (!code) return;
    setScanError(null);
    setBinding(false);
    try {
      const result = await window.deviceGatewayClient.scan(deviceId, { rawCode: code });
      setLastScan(result);
      refreshEvents();
    } catch {
      setScanError("Scan failed to reach the server — try again.");
    } finally {
      refocus();
    }
  }

  async function startBinding() {
    setBinding(true);
    setBindError(null);
    setBindTarget("");
    if (students === null) window.deviceGatewayClient.listStudentsPicker().then(setStudents);
    if (employees === null) window.deviceGatewayClient.listEmployeesPicker().then(setEmployees);
  }

  async function onBind() {
    if (!lastScan || !bindTarget) return;
    const [kind, id] = bindTarget.split(":");
    setBindError(null);
    try {
      await window.deviceGatewayClient.bindCard({
        rawCode: lastScan.event.rawCode,
        studentId: kind === "student" ? id : undefined,
        staffId: kind === "employee" ? id : undefined,
      });
      // Re-scan the same code so the UI reflects the now-successful
      // identification, rather than just trusting the bind response.
      const result = await window.deviceGatewayClient.scan(deviceId, { rawCode: lastScan.event.rawCode });
      setLastScan(result);
      setBinding(false);
      refreshEvents();
    } catch {
      setBindError("Could not bind this code — try again.");
    } finally {
      refocus();
    }
  }

  async function onPrint() {
    if (!lastScan) return;
    const name = lastScan.matchedName ?? "Unrecognized";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Scan badge</title>
      <style>body{font-family:system-ui,sans-serif;padding:2rem;text-align:center}
      h1{font-size:1.5rem;margin-bottom:0.25rem}p{color:#555}</style></head>
      <body><h1>${escapeHtml(name)}</h1>
      <p>${escapeHtml(lastScan.event.rawCode)}</p>
      <p>${escapeHtml(new Date(lastScan.event.createdAt).toLocaleString())}</p>
      <p>${lastScan.result}${lastScan.reconciled ? " — attendance marked" : ""}</p></body></html>`;
    await window.deviceGatewayClient.print(html).catch(() => undefined);
    refocus();
  }

  return (
    <div className="screen station">
      <header>
        <h1>Station active</h1>
        {user ? (
          <span className="muted">
            Signed in as {user.firstName} {user.lastName}
          </span>
        ) : null}
        <div className="header-actions">
          <button type="button" className="link-button" onClick={onReconfigure}>
            Change device
          </button>
          <button type="button" className="link-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="station-grid">
        <section className="card">
          <h2>Scan</h2>
          <form onSubmit={onSubmitScan}>
            <input
              ref={inputRef}
              type="text"
              value={rawCode}
              onChange={(e) => setRawCode(e.target.value)}
              onBlur={refocus}
              autoFocus
              placeholder="Waiting for scan…"
              className="scan-input"
            />
          </form>
          {scanError ? <p className="error">{scanError}</p> : null}

          {lastScan ? (
            <div className={`last-scan ${lastScan.result === "IDENTIFIED" ? "ok" : "warn"}`}>
              <p className="last-scan-name">{lastScan.matchedName ?? "Not recognized"}</p>
              <p className="muted">
                {lastScan.result}
                {lastScan.reconciled ? " — attendance marked" : ""}
              </p>
              <div className="last-scan-actions">
                {lastScan.result === "IDENTIFIED" ? (
                  <button type="button" onClick={onPrint}>
                    Print badge
                  </button>
                ) : (
                  <button type="button" onClick={startBinding}>
                    Who is this?
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {binding && lastScan ? (
            <div className="bind-form">
              <label>
                Assign this code to
                <select value={bindTarget} onChange={(e) => setBindTarget(e.target.value)}>
                  <option value="">Select a person…</option>
                  {(students ?? []).map((s) => (
                    <option key={s.id} value={`student:${s.id}`}>
                      {s.firstName} {s.lastName} ({s.studentCode})
                    </option>
                  ))}
                  {(employees ?? []).map((emp) => (
                    <option key={emp.id} value={`employee:${emp.id}`}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </label>
              {bindError ? <p className="error">{bindError}</p> : null}
              <div className="last-scan-actions">
                <button type="button" onClick={onBind} disabled={!bindTarget}>
                  Bind and re-scan
                </button>
                <button type="button" className="link-button" onClick={() => setBinding(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="card">
          <h2>Recent scans</h2>
          {!events || events.length === 0 ? (
            <p className="muted">No scans yet.</p>
          ) : (
            <ul className="event-list">
              {events.slice(0, 20).map((e) => (
                <li key={e.id}>
                  {e.result} — {describeScan(e)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function describeScan(event: GatewayScanEvent): string {
  if (event.matchedStudent) return `${event.matchedStudent.firstName} ${event.matchedStudent.lastName}`;
  if (event.matchedEmployee) return `${event.matchedEmployee.firstName} ${event.matchedEmployee.lastName}`;
  return event.rawCode;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
