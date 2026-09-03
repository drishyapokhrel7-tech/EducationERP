import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  // A single-face crop of InsightFace's own bundled demo/test image
  // (services/ai/tests/conftest.py's sample_image_bytes fixture reads
  // the same source image, package-relative — not a photo added to
  // this repo for its own sake, and not a named real individual;
  // standard practice for exercising a CV pipeline without sourcing
  // test imagery of our own). Cropped to exactly one face (the source
  // is a 6-person group photo) so `toHaveLength(1)` below holds.
  // Committed as a real repo fixture, __dirname-relative, rather than
  // a session-scratchpad path — the previous version of this file
  // pointed at an ephemeral tool-session directory that doesn't
  // survive across sessions, which is what broke it.
  const enrollmentFace = join(__dirname, "__fixtures__", "enrollment-face.jpg");

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

    // studentCode is server-generated, not client-suppliable
    // (CreateStudentDto's own comment) — never passed in. photoUrl is
    // mandatory at the API layer (also CreateStudentDto) — a plain
    // placeholder is fine here, nothing in this test reads it back.
    const student = await adminClient.createStudent({
      firstName: "Test",
      lastName: "Student",
      dateOfBirth: "2015-01-01",
      photoUrl: "https://example.com/photo.jpg",
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
