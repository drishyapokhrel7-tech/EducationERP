import { createApiClient } from "@education-erp/api-client";
import { apiClient, setAccessToken } from "./apiClient";

/**
 * Exercises this app's own main-process module — apiClient.ts's shared
 * client — against the real dev API server, reproducing what ipc.ts's
 * `gateway:scan`/`gateway:bind` handlers do, without needing electron's
 * ipcMain/BrowserWindow (can't run outside a real Electron process).
 * Unlike cctv-client/exam-client's own integration specs, this one
 * needs no on-disk image fixture at all — a scanned code is just a
 * string, a genuine advantage of this medium over camera capture.
 *
 * Requires services/api running on DEVICE_GATEWAY_CLIENT_API_URL
 * (default http://localhost:4000). All data created here lives under
 * one freshly-registered disposable org, removed afterward via a
 * one-off cleanup script, not from inside this file — same convention
 * as cctv-client's own stationFlow.integration.spec.ts.
 */
describe("device-gateway-client main-process flow (integration)", () => {
  const baseUrl = process.env.DEVICE_GATEWAY_CLIENT_API_URL ?? "http://localhost:4000";
  // Fixture setup uses its own client/token — apiClient (the module
  // under test) owns exactly one access-token slot via setAccessToken,
  // matching the real app's single-session design, same reasoning as
  // exam-client/cctv-client's own integration specs.
  const adminClient = createApiClient({ baseUrl, getAccessToken: () => adminToken });
  let adminToken: string;

  const run = Date.now();
  const orgSlug = `device-gateway-it-${run}`;
  let deviceId: string;
  let studentCode: string;
  let studentId: string;

  beforeAll(async () => {
    const reg = await adminClient.registerOrganization({
      organizationName: "Device Gateway IT Org",
      slug: orgSlug,
      adminEmail: `admin-${run}@device-gateway-it.test`,
      adminFirstName: "Admin",
      adminLastName: "User",
      password: "correct-horse-battery-staple",
    });
    adminToken = reg.accessToken;

    // studentCode is server-generated, not client-suppliable (see
    // CreateStudentDto's own comment) — read it back from the
    // response, not passed in.
    const student = await adminClient.createStudent({
      firstName: "Gate",
      lastName: "Way",
      dateOfBirth: "2015-01-01",
      photoUrl: "https://example.com/photo.jpg",
    });
    studentId = student.id;
    studentCode = student.studentCode;

    const device = await adminClient.registerGatewayDevice({ name: `Device Gateway IT Station ${run}` , deviceType: "BARCODE_SCANNER" });
    deviceId = device.id;
  }, 30000);

  it("identifies a student by their literal code through the same apiClient path the real scan loop uses, and updates the device's health", async () => {
    setAccessToken(adminToken);

    const devicesBefore = await adminClient.listGatewayDevices();
    expect(devicesBefore.find((d) => d.id === deviceId)?.lastSeenAt).toBeNull();

    const result = await apiClient.scanGatewayDevice(deviceId, { rawCode: studentCode });
    expect(result.result).toBe("IDENTIFIED");
    expect(result.event.matchedStudentId).toBe(studentId);

    const events = await adminClient.listGatewayScanEvents();
    expect(events.find((e) => e.id === result.event.id)).toBeDefined();

    const devicesAfter = await adminClient.listGatewayDevices();
    expect(devicesAfter.find((d) => d.id === deviceId)?.lastSeenAt).not.toBeNull();

    setAccessToken(null);
  }, 30000);

  it("resolves an unrecognized code as NOT_FOUND, then IDENTIFIED once bound, through the same apiClient path the real bind flow uses", async () => {
    setAccessToken(adminToken);
    const rawUid = `IT-RFID-${run}`;

    const before = await apiClient.scanGatewayDevice(deviceId, { rawCode: rawUid });
    expect(before.result).toBe("NOT_FOUND");

    await apiClient.bindGatewayCard({ rawCode: rawUid, studentId });

    const after = await apiClient.scanGatewayDevice(deviceId, { rawCode: rawUid });
    expect(after.result).toBe("IDENTIFIED");
    expect(after.event.matchedStudentId).toBe(studentId);

    setAccessToken(null);
  }, 30000);
});
