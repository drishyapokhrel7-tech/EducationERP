import { readFileSync } from "node:fs";
import { createApiClient } from "@education-erp/api-client";
import { apiClient, setAccessToken } from "./apiClient";

/**
 * Exercises this app's own main-process modules — apiClient.ts's
 * shared client — against the real dev API server, reproducing what
 * ipc.ts's `capture:submitFrame` handler does, without needing
 * electron's ipcMain/BrowserWindow (can't run outside a real Electron
 * process) or a real getUserMedia webcam (not available headless
 * here either). A real on-disk test image stands in for what the
 * renderer's canvas capture would produce — same bytes, same File
 * construction, same apiClient.ingestCameraEvent call the real
 * capture loop makes.
 *
 * Requires services/api running on CCTV_CLIENT_API_URL (default
 * http://localhost:4000) and services/ai running on AI_SERVICE_URL
 * for real face embedding. All data created here is removed
 * afterward via a one-off cleanup script, not from inside this file.
 */
describe("cctv-client main-process flow (integration)", () => {
  const baseUrl = process.env.CCTV_CLIENT_API_URL ?? "http://localhost:4000";
  // Fixture setup (org, policy, enrollment, camera registration) uses
  // its own client/token — apiClient (the module under test) owns
  // exactly one access-token slot via setAccessToken, matching the
  // real app's single-session design, same reasoning as
  // exam-client's examFlow.integration.spec.ts.
  const adminClient = createApiClient({ baseUrl, getAccessToken: () => adminToken });
  let adminToken: string;

  const run = Date.now();
  const orgSlug = `cctv-client-it-${run}`;
  let cameraId: string;
  const enrollmentFace =
    "/private/tmp/claude-501/-Users-nepalpolicemac5-website/87a26d71-4b2c-4aaf-b1d1-16be580a0359/scratchpad/enrollment-face.jpg";

  beforeAll(async () => {
    const reg = await adminClient.registerOrganization({
      organizationName: "CCTV Client IT Org",
      slug: orgSlug,
      adminEmail: `admin-${run}@cctv-client-it.test`,
      adminFirstName: "Admin",
      adminLastName: "User",
      password: "correct-horse-battery-staple",
    });
    adminToken = reg.accessToken;

    await adminClient.updateBiometricPolicy({ enabled: true });

    const student = await adminClient.createStudent({
      studentCode: `IT-STU-${run}`,
      firstName: "Test",
      lastName: "Student",
      dateOfBirth: "2015-01-01",
    });
    const enrollment = await adminClient.createFaceEnrollment({ studentId: student.id, consentGivenBy: "self" });
    const photoBuffer = readFileSync(enrollmentFace);
    const photoFile = new File([new Uint8Array(photoBuffer)], "enrollment-face.jpg", { type: "image/jpeg" });
    await adminClient.addEnrollmentPhoto(enrollment.id, photoFile);

    const camera = await adminClient.createCamera({ name: `CCTV IT Station ${run}` });
    cameraId = camera.id;
  }, 30000);

  it("submits a captured frame through the same apiClient path the real capture loop uses, identifying the enrolled student and updating the camera's health", async () => {
    setAccessToken(adminToken);

    const camerasBefore = await adminClient.listCameras();
    expect(camerasBefore.find((c) => c.id === cameraId)?.lastSeenAt).toBeNull();

    const buffer = readFileSync(enrollmentFace);
    const file = new File([new Uint8Array(buffer)], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
    const result = await apiClient.ingestCameraEvent(cameraId, file);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].result).toBe("IDENTIFIED");

    const events = await adminClient.listFaceMatchEvents();
    expect(events.find((e) => e.id === result.matches[0].id)).toBeDefined();

    const camerasAfter = await adminClient.listCameras();
    const updated = camerasAfter.find((c) => c.id === cameraId);
    expect(updated?.lastSeenAt).not.toBeNull();

    setAccessToken(null);
  }, 30000);
});
