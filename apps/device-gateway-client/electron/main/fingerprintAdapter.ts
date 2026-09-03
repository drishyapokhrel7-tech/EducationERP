// The one device type in this client's scope that genuinely can't be
// built and verified in this environment: real fingerprint scanners
// need a vendor SDK (DigitalPersona/SecuGen/ZKTeco and similar are
// overwhelmingly native, Windows-only) — no hardware, no SDK license,
// no matching OS target exists here. Unlike barcode/RFID/smart-card
// (which the overwhelming majority of commodity readers expose as a
// plain USB-HID keyboard-wedge device, needing zero vendor code — see
// the always-focused scan input on StationScreen) or printing (which
// Electron's own webContents.print() already covers vendor-agnostically),
// fingerprint hardware has no such common-denominator interface.
//
// This interface is the plan's own "must use adapters and must not
// hard-code a single vendor" requirement, honored architecturally: any
// future vendor SDK plugs in behind this one shape, and nothing calling
// it needs to change. NoopFingerprintAdapter is the only implementation
// today — it's not a broken promise, it's a stated, disclosed gap, the
// same class of thing cctv-client's own "webcam capture could not be
// verified in this environment" limitation already is.
export interface FingerprintAdapter {
  /** Resolves a captured template, or null if no scanner is available/attached. */
  capture(): Promise<{ templateData: string } | null>;
}

export class NoopFingerprintAdapter implements FingerprintAdapter {
  capture(): Promise<{ templateData: string } | null> {
    return Promise.resolve(null);
  }
}

export const fingerprintAdapter: FingerprintAdapter = new NoopFingerprintAdapter();
