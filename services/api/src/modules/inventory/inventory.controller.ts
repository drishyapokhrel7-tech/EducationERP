import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
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
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post("inventory-categories")
  @RequirePermissions("inventory:create")
  createCategory(@CurrentUser() user: JwtPayload, @Body() dto: CreateCategoryDto) {
    return this.inventory.createCategory(user.organizationId, dto);
  }

  @Get("inventory-categories")
  @RequirePermissions("inventory:view")
  listCategories(@CurrentUser() user: JwtPayload) {
    return this.inventory.listCategories(user.organizationId);
  }

  // inventory:manage for both, matching the coarse permission this
  // file already uses for every other mutating route beyond plain
  // create/view (see updateAsset below).
  @Patch("inventory-categories/:id")
  @RequirePermissions("inventory:manage")
  updateCategory(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.inventory.updateCategory(user.organizationId, id, dto);
  }

  @Delete("inventory-categories/:id")
  @RequirePermissions("inventory:manage")
  deleteCategory(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.inventory.deleteCategory(user.organizationId, id);
  }

  @Post("suppliers")
  @RequirePermissions("inventory:create")
  createSupplier(@CurrentUser() user: JwtPayload, @Body() dto: CreateSupplierDto) {
    return this.inventory.createSupplier(user.organizationId, dto);
  }

  @Get("suppliers")
  @RequirePermissions("inventory:view")
  listSuppliers(@CurrentUser() user: JwtPayload) {
    return this.inventory.listSuppliers(user.organizationId);
  }

  @Patch("suppliers/:id")
  @RequirePermissions("inventory:manage")
  updateSupplier(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateSupplierDto) {
    return this.inventory.updateSupplier(user.organizationId, id, dto);
  }

  @Delete("suppliers/:id")
  @RequirePermissions("inventory:manage")
  deleteSupplier(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.inventory.deleteSupplier(user.organizationId, id);
  }

  @Post("inventory-items")
  @RequirePermissions("inventory:create")
  createItem(@CurrentUser() user: JwtPayload, @Body() dto: CreateItemDto) {
    return this.inventory.createItem(user.organizationId, dto);
  }

  @Get("inventory-items")
  @RequirePermissions("inventory:view")
  listItems(@CurrentUser() user: JwtPayload) {
    return this.inventory.listItems(user.organizationId);
  }

  @Post("purchase-orders")
  @RequirePermissions("inventory:create")
  createPurchaseOrder(@CurrentUser() user: JwtPayload, @Body() dto: CreatePurchaseOrderDto) {
    return this.inventory.createPurchaseOrder(user.organizationId, dto);
  }

  @Get("purchase-orders")
  @RequirePermissions("inventory:view")
  listPurchaseOrders(@CurrentUser() user: JwtPayload) {
    return this.inventory.listPurchaseOrders(user.organizationId);
  }

  @Post("purchase-orders/:id/items")
  @RequirePermissions("inventory:manage")
  addPurchaseOrderItem(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: AddPurchaseOrderItemDto) {
    return this.inventory.addPurchaseOrderItem(user.organizationId, id, dto);
  }

  @Post("purchase-orders/:id/place")
  @RequirePermissions("inventory:manage")
  placeOrder(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.inventory.placeOrder(user.organizationId, id);
  }

  @Post("purchase-orders/:id/receive")
  @RequirePermissions("inventory:manage")
  receivePurchaseOrder(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: ReceivePurchaseOrderDto) {
    return this.inventory.receivePurchaseOrder(user.organizationId, id, dto);
  }

  @Post("purchase-orders/:id/cancel")
  @RequirePermissions("inventory:manage")
  cancelPurchaseOrder(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.inventory.cancelPurchaseOrder(user.organizationId, id);
  }

  @Post("stock-movements")
  @RequirePermissions("inventory:manage")
  createStockAdjustment(@CurrentUser() user: JwtPayload, @Body() dto: CreateStockAdjustmentDto) {
    return this.inventory.createStockAdjustment(user.organizationId, dto);
  }

  @Get("stock-movements")
  @RequirePermissions("inventory:view")
  listStockMovements(@CurrentUser() user: JwtPayload, @Query("itemId") itemId?: string) {
    return this.inventory.listStockMovements(user.organizationId, itemId);
  }

  @Post("assets")
  @RequirePermissions("inventory:create")
  createAsset(@CurrentUser() user: JwtPayload, @Body() dto: CreateAssetDto) {
    return this.inventory.createAsset(user.organizationId, dto);
  }

  @Get("assets")
  @RequirePermissions("inventory:view")
  listAssets(@CurrentUser() user: JwtPayload) {
    return this.inventory.listAssets(user.organizationId);
  }

  @Patch("assets/:id")
  @RequirePermissions("inventory:manage")
  updateAsset(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateAssetDto) {
    return this.inventory.updateAsset(user.organizationId, id, dto);
  }

  @Post("asset-assignments")
  @RequirePermissions("inventory:manage")
  assignAsset(@CurrentUser() user: JwtPayload, @Body() dto: AssignAssetDto) {
    return this.inventory.assignAsset(user.organizationId, dto);
  }

  @Post("asset-assignments/:id/return")
  @RequirePermissions("inventory:manage")
  returnAsset(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.inventory.returnAsset(user.organizationId, id);
  }

  @Get("asset-assignments")
  @RequirePermissions("inventory:view")
  listAssetAssignments(@CurrentUser() user: JwtPayload, @Query("assetId") assetId?: string) {
    return this.inventory.listAssetAssignments(user.organizationId, assetId);
  }
}
