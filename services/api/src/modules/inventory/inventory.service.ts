import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { CreateItemDto } from "./dto/create-item.dto";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { AddPurchaseOrderItemDto } from "./dto/add-purchase-order-item.dto";
import { ReceivePurchaseOrderDto } from "./dto/receive-purchase-order.dto";
import { CreateStockAdjustmentDto } from "./dto/create-stock-adjustment.dto";
import { CreateAssetDto } from "./dto/create-asset.dto";
import { UpdateAssetDto } from "./dto/update-asset.dto";
import { AssignAssetDto } from "./dto/assign-asset.dto";
import { assertNoDependents } from "../../common/assert-no-dependents";

/**
 * InventoryItem.currentStock is never a stored column — it's the
 * signed sum of that item's StockMovement rows, computed here via a
 * groupBy and merged onto the item list. See the schema.prisma
 * comment on the Inventory section for why (same "computed, not
 * stored" precedent as HostelBed occupancy / syllabus_progress).
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Categories ────────────────────────────────────────────────────

  createCategory(organizationId: string, dto: CreateCategoryDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.inventoryCategory.create({ data: { organizationId, name: dto.name, code: dto.code } }),
    );
  }

  listCategories(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.inventoryCategory.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    );
  }

  async updateCategory(organizationId: string, id: string, dto: UpdateCategoryDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadCategory(tx, organizationId, id);
      return tx.inventoryCategory.update({ where: { id }, data: dto });
    });
  }

  async deleteCategory(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadCategory(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.inventoryItem.count({ where: { categoryId: id } }),
          tx.asset.count({ where: { categoryId: id } }),
        ],
        "inventory category",
      );
      await tx.inventoryCategory.delete({ where: { id } });
      return { deleted: true };
    });
  }

  // ── Suppliers ─────────────────────────────────────────────────────

  createSupplier(organizationId: string, dto: CreateSupplierDto) {
    return this.prisma.withTenant(organizationId, (tx) => tx.supplier.create({ data: { organizationId, ...dto } }));
  }

  listSuppliers(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.supplier.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    );
  }

  async updateSupplier(organizationId: string, id: string, dto: UpdateSupplierDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadSupplier(tx, organizationId, id);
      return tx.supplier.update({ where: { id }, data: dto });
    });
  }

  async deleteSupplier(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadSupplier(tx, organizationId, id);
      await assertNoDependents([tx.purchaseOrder.count({ where: { supplierId: id } })], "supplier");
      await tx.supplier.delete({ where: { id } });
      return { deleted: true };
    });
  }

  // ── Items ─────────────────────────────────────────────────────────

  async createItem(organizationId: string, dto: CreateItemDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadCategory(tx, organizationId, dto.categoryId);
      return tx.inventoryItem.create({
        data: {
          organizationId,
          categoryId: dto.categoryId,
          name: dto.name,
          sku: dto.sku,
          unit: dto.unit,
          barcode: dto.barcode,
          reorderLevel: dto.reorderLevel,
        },
      });
    });
  }

  async listItems(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [items, stockByItem] = await Promise.all([
        tx.inventoryItem.findMany({ where: { organizationId }, include: { category: true }, orderBy: { name: "asc" } }),
        tx.stockMovement.groupBy({ by: ["itemId"], where: { organizationId }, _sum: { quantity: true } }),
      ]);
      const stockMap = new Map(stockByItem.map((s) => [s.itemId, s._sum.quantity ?? 0]));
      return items.map((item) => ({ ...item, currentStock: stockMap.get(item.id) ?? 0 }));
    });
  }

  // ── Purchase orders ───────────────────────────────────────────────

  async createPurchaseOrder(organizationId: string, dto: CreatePurchaseOrderDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadSupplier(tx, organizationId, dto.supplierId);
      return tx.purchaseOrder.create({
        data: { organizationId, supplierId: dto.supplierId, notes: dto.notes },
      });
    });
  }

  listPurchaseOrders(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.purchaseOrder.findMany({
        where: { organizationId },
        include: { supplier: true, items: { include: { item: true } } },
        orderBy: { orderDate: "desc" },
      }),
    );
  }

  async addPurchaseOrderItem(organizationId: string, purchaseOrderId: string, dto: AddPurchaseOrderItemDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const po = await this.loadPurchaseOrder(tx, organizationId, purchaseOrderId);
      if (po.status !== "DRAFT") throw new ConflictException("Items can only be added while the order is still DRAFT");
      await this.loadItem(tx, organizationId, dto.itemId);
      return tx.purchaseOrderItem.create({
        data: {
          organizationId,
          purchaseOrderId,
          itemId: dto.itemId,
          quantityOrdered: dto.quantityOrdered,
          unitPrice: dto.unitPrice,
        },
      });
    });
  }

  // DRAFT → ORDERED — a deliberate, explicit transition, same
  // "generate then finalize" precedent as Payroll.
  async placeOrder(organizationId: string, purchaseOrderId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const po = await this.loadPurchaseOrder(tx, organizationId, purchaseOrderId);
      if (po.status !== "DRAFT") throw new ConflictException("Only a DRAFT order can be placed");
      return tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: "ORDERED" } });
    });
  }

  // Receiving is its own step, separate from ordering — stock only
  // actually moves once goods are confirmed received. Supports
  // partial receipt: each line adds to that item's
  // quantityReceived and writes one StockMovement(IN). The order
  // itself flips to RECEIVED only once every line is fully received.
  async receivePurchaseOrder(organizationId: string, purchaseOrderId: string, dto: ReceivePurchaseOrderDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const po = await this.loadPurchaseOrder(tx, organizationId, purchaseOrderId);
      if (po.status !== "ORDERED") throw new ConflictException("Only an ORDERED order can receive stock");

      for (const line of dto.lines) {
        const poItem = await tx.purchaseOrderItem.findUnique({ where: { id: line.purchaseOrderItemId } });
        if (!poItem || poItem.organizationId !== organizationId || poItem.purchaseOrderId !== purchaseOrderId) {
          throw new NotFoundException("Purchase order item not found on this order");
        }
        const newReceived = poItem.quantityReceived + line.quantity;
        if (newReceived > poItem.quantityOrdered) {
          throw new ConflictException(`Cannot receive more than ordered for item ${poItem.itemId}`);
        }
        await tx.purchaseOrderItem.update({ where: { id: poItem.id }, data: { quantityReceived: newReceived } });
        await tx.stockMovement.create({
          data: {
            organizationId,
            itemId: poItem.itemId,
            type: "IN",
            quantity: line.quantity,
            purchaseOrderId,
            reason: "Purchase order receipt",
          },
        });
      }

      const allItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } });
      const fullyReceived = allItems.every((i) => i.quantityReceived >= i.quantityOrdered);
      return tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: fullyReceived ? { status: "RECEIVED" } : {},
        include: { supplier: true, items: { include: { item: true } } },
      });
    });
  }

  async cancelPurchaseOrder(organizationId: string, purchaseOrderId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const po = await this.loadPurchaseOrder(tx, organizationId, purchaseOrderId);
      if (po.status === "RECEIVED") throw new ConflictException("A fully received order cannot be cancelled");
      return tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: "CANCELLED" } });
    });
  }

  // ── Stock movements ───────────────────────────────────────────────

  async createStockAdjustment(organizationId: string, dto: CreateStockAdjustmentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadItem(tx, organizationId, dto.itemId);
      return tx.stockMovement.create({
        data: { organizationId, itemId: dto.itemId, type: "ADJUSTMENT", quantity: dto.quantity, reason: dto.reason },
      });
    });
  }

  listStockMovements(organizationId: string, itemId?: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.stockMovement.findMany({
        where: { organizationId, itemId },
        include: { item: true },
        orderBy: { movementDate: "desc" },
      }),
    );
  }

  // ── Assets ────────────────────────────────────────────────────────

  async createAsset(organizationId: string, dto: CreateAssetDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      if (dto.categoryId) await this.loadCategory(tx, organizationId, dto.categoryId);
      return tx.asset.create({
        data: {
          organizationId,
          categoryId: dto.categoryId,
          assetTag: dto.assetTag,
          name: dto.name,
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
          purchaseCost: dto.purchaseCost,
        },
      });
    });
  }

  listAssets(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.asset.findMany({
        where: { organizationId },
        include: { category: true, assignments: { where: { returnedAt: null }, include: { assignedToEmployee: true } } },
        orderBy: { name: "asc" },
      }),
    );
  }

  async updateAsset(organizationId: string, assetId: string, dto: UpdateAssetDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadAsset(tx, organizationId, assetId);
      return tx.asset.update({ where: { id: assetId }, data: { status: dto.status } });
    });
  }

  // ── Asset assignments ─────────────────────────────────────────────

  async assignAsset(organizationId: string, dto: AssignAssetDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const asset = await this.loadAsset(tx, organizationId, dto.assetId);
      if (asset.status !== "AVAILABLE") throw new ConflictException("This asset is not available for assignment");

      const openAssignment = await tx.assetAssignment.findFirst({ where: { assetId: dto.assetId, returnedAt: null } });
      if (openAssignment) throw new ConflictException("This asset is already assigned — return it first");

      const employee = await tx.employee.findUnique({ where: { id: dto.employeeId } });
      if (!employee || employee.organizationId !== organizationId) throw new NotFoundException("Employee not found");

      return tx.assetAssignment.create({
        data: { organizationId, assetId: dto.assetId, assignedToEmployeeId: dto.employeeId, notes: dto.notes },
        include: { asset: true, assignedToEmployee: true },
      });
    });
  }

  async returnAsset(organizationId: string, assignmentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const assignment = await tx.assetAssignment.findUnique({ where: { id: assignmentId } });
      if (!assignment || assignment.organizationId !== organizationId) throw new NotFoundException("Assignment not found");
      if (assignment.returnedAt) throw new ConflictException("This assignment was already returned");
      return tx.assetAssignment.update({ where: { id: assignmentId }, data: { returnedAt: new Date() } });
    });
  }

  listAssetAssignments(organizationId: string, assetId?: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.assetAssignment.findMany({
        where: { organizationId, assetId },
        include: { asset: true, assignedToEmployee: true },
        orderBy: { assignedAt: "desc" },
      }),
    );
  }

  // ── FK-vs-RLS parent guards ──────────────────────────────────────

  private async loadCategory(tx: PrismaClient, organizationId: string, id: string) {
    const category = await tx.inventoryCategory.findUnique({ where: { id } });
    if (!category || category.organizationId !== organizationId) throw new NotFoundException("Inventory category not found");
    return category;
  }

  private async loadSupplier(tx: PrismaClient, organizationId: string, id: string) {
    const supplier = await tx.supplier.findUnique({ where: { id } });
    if (!supplier || supplier.organizationId !== organizationId) throw new NotFoundException("Supplier not found");
    return supplier;
  }

  private async loadItem(tx: PrismaClient, organizationId: string, id: string) {
    const item = await tx.inventoryItem.findUnique({ where: { id } });
    if (!item || item.organizationId !== organizationId) throw new NotFoundException("Inventory item not found");
    return item;
  }

  private async loadPurchaseOrder(tx: PrismaClient, organizationId: string, id: string) {
    const po = await tx.purchaseOrder.findUnique({ where: { id } });
    if (!po || po.organizationId !== organizationId) throw new NotFoundException("Purchase order not found");
    return po;
  }

  private async loadAsset(tx: PrismaClient, organizationId: string, id: string) {
    const asset = await tx.asset.findUnique({ where: { id } });
    if (!asset || asset.organizationId !== organizationId) throw new NotFoundException("Asset not found");
    return asset;
  }
}
