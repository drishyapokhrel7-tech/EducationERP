import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Exercises the exact cross-tenant scenarios plan §4/§7 call out: reads,
 * writes, direct-ID access, and RLS as a backstop independent of the
 * service-layer WHERE clause. Runs against the real dev database (no
 * separate test DB was provisioned in Phase 1) — every row it creates is
 * deleted in afterAll.
 */
describe("Tenant isolation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const run = Date.now();
  const orgAEmail = `admin-a-${run}@rls-e2e.test`;
  const orgBEmail = `admin-b-${run}@rls-e2e.test`;
  const orgASlug = `rls-e2e-a-${run}`;
  const orgBSlug = `rls-e2e-b-${run}`;

  let orgAId: string;
  let orgBId: string;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const regA = await request(app.getHttpServer()).post("/auth/register-organization").send({
      organizationName: "RLS E2E Org A",
      slug: orgASlug,
      adminEmail: orgAEmail,
      adminFirstName: "Ada",
      adminLastName: "Admin",
      password: "correct-horse-battery-staple",
    });
    orgAId = regA.body.organization.id;
    tokenA = regA.body.accessToken;

    const regB = await request(app.getHttpServer()).post("/auth/register-organization").send({
      organizationName: "RLS E2E Org B",
      slug: orgBSlug,
      adminEmail: orgBEmail,
      adminFirstName: "Bea",
      adminLastName: "Admin",
      password: "correct-horse-battery-staple",
    });
    orgBId = regB.body.organization.id;
    tokenB = regB.body.accessToken;
  });

  afterAll(async () => {
    if (prisma) {
      // campuses and audit_logs are RLS-protected (FORCE ROW LEVEL
      // SECURITY) — deleting them without setting the tenant GUC first
      // deletes zero rows (not an error), which then breaks the
      // organizations delete below on the audit_logs FK. withTenant is
      // mandatory here, not just for app code.
      for (const orgId of [orgAId, orgBId]) {
        await prisma.withTenant(orgId, (tx) =>
          tx.campus.deleteMany({ where: { organizationId: orgId } }),
        );
        await prisma.withTenant(orgId, (tx) =>
          tx.auditLog.deleteMany({ where: { organizationId: orgId } }),
        );
      }
      await prisma.userRole.deleteMany({ where: { user: { organizationId: { in: [orgAId, orgBId] } } } });
      await prisma.session.deleteMany({ where: { user: { organizationId: { in: [orgAId, orgBId] } } } });
      await prisma.loginEvent.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    }
    await app.close();
  });

  it("rejects requests with no token", async () => {
    await request(app.getHttpServer()).get("/organizations/me").expect(401);
  });

  it("rejects requests with a garbage token", async () => {
    await request(app.getHttpServer())
      .get("/organizations/me")
      .set("Authorization", "Bearer not-a-real-token")
      .expect(401);
  });

  it("lets each org only see its own organization record", async () => {
    const asA = await request(app.getHttpServer())
      .get("/organizations/me")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(asA.body.id).toBe(orgAId);

    const asB = await request(app.getHttpServer())
      .get("/organizations/me")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(asB.body.id).toBe(orgBId);
  });

  it("does not leak campuses across tenants via the API (app-level scoping)", async () => {
    const created = await request(app.getHttpServer())
      .post("/organizations/me/campuses")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Org A Main Campus", code: "A1" })
      .expect(201);
    expect(created.body.organizationId).toBe(orgAId);

    const bCampuses = await request(app.getHttpServer())
      .get("/organizations/me/campuses")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(bCampuses.body).toEqual([]);

    const aCampuses = await request(app.getHttpServer())
      .get("/organizations/me/campuses")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(aCampuses.body).toHaveLength(1);
    expect(aCampuses.body[0].code).toBe("A1");
  });

  it("blocks cross-tenant reads and writes at the database layer even without an app-level WHERE clause (RLS)", async () => {
    // A second, unfiltered query scoped only by the RLS session GUC —
    // proves the database itself enforces isolation, independent of
    // OrganizationsService's WHERE organizationId = ... clause.
    const rowsVisibleToA = await prisma.withTenant(orgAId, (tx) => tx.campus.findMany());
    expect(rowsVisibleToA.every((c) => c.organizationId === orgAId)).toBe(true);
    expect(rowsVisibleToA.some((c) => c.organizationId === orgBId)).toBe(false);

    const orgACampus = rowsVisibleToA[0];
    expect(orgACampus).toBeDefined();

    const directIdReadFromB = await prisma.withTenant(orgBId, (tx) =>
      tx.campus.findUnique({ where: { id: orgACampus.id } }),
    );
    expect(directIdReadFromB).toBeNull();

    await expect(
      prisma.withTenant(orgBId, (tx) =>
        tx.campus.create({
          data: { organizationId: orgAId, name: "Sneaky cross-tenant write", code: "X1" },
        }),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});
