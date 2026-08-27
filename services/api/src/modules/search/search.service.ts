import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const RESULT_LIMIT = 8;
const MIN_QUERY_LENGTH = 2;

export interface StudentSearchResult {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
}

export interface EmployeeSearchResult {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  photoUrl: string | null;
}

export interface GuardianSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface VehicleSearchResult {
  id: string;
  registrationNumber: string;
  type: string;
}

export interface InventoryItemSearchResult {
  id: string;
  name: string;
  sku: string;
}

export interface ExamSearchResult {
  id: string;
  name: string;
}

export interface SearchResult {
  students: StudentSearchResult[];
  employees: EmployeeSearchResult[];
  guardians: GuardianSearchResult[];
  vehicles: VehicleSearchResult[];
  inventoryItems: InventoryItemSearchResult[];
  exams: ExamSearchResult[];
}

/**
 * Phase 8 "global search" bullet. Part 1 covered people (students,
 * staff, guardians); part 2 adds the next tier of "look this up by
 * name/code" targets that each have a clear identifying field and no
 * existing fast cross-page lookup of their own: Vehicle
 * (registrationNumber), InventoryItem (name/sku), Exam (name).
 * Deliberately not gated by @RequirePermissions at the route level
 * (see SearchController) — this service itself decides, per category,
 * whether the caller's own granted permissions (already on the JWT,
 * no extra query) include that category's `view` action, and simply
 * omits categories they lack rather than 403ing the whole request.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(organizationId: string, permissions: string[], q: string): Promise<SearchResult> {
    const granted = new Set(permissions);
    const term = q.trim();
    if (term.length < MIN_QUERY_LENGTH) {
      return { students: [], employees: [], guardians: [], vehicles: [], inventoryItems: [], exams: [] };
    }

    return this.prisma.withTenant(organizationId, async (tx) => {
      const [students, employees, guardians, vehicles, inventoryItems, exams] = await Promise.all([
        granted.has("student:view")
          ? tx.student.findMany({
              where: {
                organizationId,
                deletedAt: null,
                OR: [
                  { firstName: { contains: term, mode: "insensitive" } },
                  { lastName: { contains: term, mode: "insensitive" } },
                  { studentCode: { contains: term, mode: "insensitive" } },
                ],
              },
              select: { id: true, studentCode: true, firstName: true, lastName: true, photoUrl: true },
              take: RESULT_LIMIT,
            })
          : [],
        granted.has("employee:view")
          ? tx.employee.findMany({
              where: {
                organizationId,
                deletedAt: null,
                OR: [
                  { firstName: { contains: term, mode: "insensitive" } },
                  { lastName: { contains: term, mode: "insensitive" } },
                  { employeeCode: { contains: term, mode: "insensitive" } },
                  { email: { contains: term, mode: "insensitive" } },
                ],
              },
              select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, photoUrl: true },
              take: RESULT_LIMIT,
            })
          : [],
        granted.has("guardian:view")
          ? tx.guardian.findMany({
              where: {
                organizationId,
                OR: [
                  { firstName: { contains: term, mode: "insensitive" } },
                  { lastName: { contains: term, mode: "insensitive" } },
                  { phone: { contains: term, mode: "insensitive" } },
                ],
              },
              select: { id: true, firstName: true, lastName: true, phone: true },
              take: RESULT_LIMIT,
            })
          : [],
        granted.has("vehicle:view")
          ? tx.vehicle.findMany({
              where: {
                organizationId,
                OR: [
                  { registrationNumber: { contains: term, mode: "insensitive" } },
                  { type: { contains: term, mode: "insensitive" } },
                ],
              },
              select: { id: true, registrationNumber: true, type: true },
              take: RESULT_LIMIT,
            })
          : [],
        granted.has("inventory:view")
          ? tx.inventoryItem.findMany({
              where: {
                organizationId,
                OR: [
                  { name: { contains: term, mode: "insensitive" } },
                  { sku: { contains: term, mode: "insensitive" } },
                  { barcode: { contains: term, mode: "insensitive" } },
                ],
              },
              select: { id: true, name: true, sku: true },
              take: RESULT_LIMIT,
            })
          : [],
        granted.has("exam:view")
          ? tx.exam.findMany({
              where: { organizationId, name: { contains: term, mode: "insensitive" } },
              select: { id: true, name: true },
              take: RESULT_LIMIT,
            })
          : [],
      ]);

      return { students, employees, guardians, vehicles, inventoryItems, exams };
    });
  }
}
