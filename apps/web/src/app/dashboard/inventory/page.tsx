"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSubNav } from "@/components/dashboard/page-subnav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { FeatureLock } from "@/components/feature-lock";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import { useHighlightFromSearch } from "@/lib/use-highlight-from-search";
import { submitAction, submitDelete } from "@/lib/submit-action";

export default function InventoryPage() {
  const categories = useSWR("inventory-categories", () => api.listInventoryCategories());
  const suppliers = useSWR("suppliers", () => api.listSuppliers());
  const items = useSWR("inventory-items", () => api.listInventoryItems());
  useHighlightFromSearch(Boolean(items.data));
  const purchaseOrders = useSWR("purchase-orders", () => api.listPurchaseOrders());
  const stockMovements = useSWR("stock-movements", () => api.listStockMovements());
  const assets = useSWR("assets", () => api.listAssets());
  // Deliberately the unbounded, narrow picker — this is a "pick a
  // staff member" dropdown, not the paginated admin list view (Phase 8
  // performance-optimization slice).
  const employees = useSWR("employees-picker", () => api.listEmployeesPicker());

  // ── Categories ────────────────────────────────────────────────────
  const [categoryForm, setCategoryForm] = useState({ name: "", code: "" });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryForm, setEditCategoryForm] = useState({ name: "", code: "" });

  // ── Suppliers ─────────────────────────────────────────────────────
  const [supplierForm, setSupplierForm] = useState({ name: "", contactName: "", phone: "", email: "", address: "" });
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editSupplierForm, setEditSupplierForm] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
  });

  // ── Items ─────────────────────────────────────────────────────────
  const [itemForm, setItemForm] = useState({ categoryId: "", name: "", sku: "", unit: "", barcode: "", reorderLevel: "" });

  // ── Purchase orders ───────────────────────────────────────────────
  const [poForm, setPoForm] = useState({ supplierId: "", notes: "" });
  const [selectedPoId, setSelectedPoId] = useState("");
  const [poItemForm, setPoItemForm] = useState({ itemId: "", quantityOrdered: "", unitPrice: "" });
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  // ── Stock adjustments ─────────────────────────────────────────────
  const [adjustmentForm, setAdjustmentForm] = useState({ itemId: "", quantity: "", reason: "" });

  // ── Assets ────────────────────────────────────────────────────────
  const [assetForm, setAssetForm] = useState({ categoryId: "", assetTag: "", name: "" });
  const [assignForm, setAssignForm] = useState({ assetId: "", employeeId: "" });

  const selectedPo = purchaseOrders.data?.find((po) => po.id === selectedPoId);

  return (
    <FeatureLock feature="inventory">
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-muted-foreground text-sm">
          Categories, suppliers, items with computed current stock, purchase orders (order → receive → stock movements),
          manual stock adjustments, and asset tracking with assignment history.
        </p>
      </div>

      <PageSubNav
        sections={[
          { id: "categories", label: "Categories" },
          { id: "suppliers", label: "Suppliers" },
          { id: "items", label: "Items" },
          { id: "purchase-orders", label: "Purchase orders" },
          { id: "stock-movements", label: "Stock movements" },
          { id: "assets", label: "Assets" },
        ]}
      />

      <Card id="categories" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!categories.data || categories.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No categories yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {categories.data.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{c.name}</span> <span className="text-muted-foreground">({c.code})</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingCategoryId(c.id);
                        setEditCategoryForm({ name: c.name, code: c.code });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => submitDelete(() => api.deleteInventoryCategory(c.id), () => categories.mutate())}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editingCategoryId ? (
            <form
              className="flex flex-wrap items-end gap-3 rounded-md border p-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () => api.updateInventoryCategory(editingCategoryId, editCategoryForm),
                  () => {
                    setEditingCategoryId(null);
                    categories.mutate();
                  },
                );
              }}
            >
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  className="w-40"
                  value={editCategoryForm.name}
                  onChange={(e) => setEditCategoryForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Code</Label>
                <Input
                  className="w-28"
                  value={editCategoryForm.code}
                  onChange={(e) => setEditCategoryForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm" disabled={!editCategoryForm.name || !editCategoryForm.code}>
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingCategoryId(null)}>
                Cancel
              </Button>
            </form>
          ) : null}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(() => api.createInventoryCategory(categoryForm), () => {
                setCategoryForm({ name: "", code: "" });
                categories.mutate();
              });
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                className="w-40"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Code</Label>
              <Input
                className="w-28"
                value={categoryForm.code}
                onChange={(e) => setCategoryForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!categoryForm.name || !categoryForm.code}>
              Add category
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card id="suppliers" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Suppliers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!suppliers.data || suppliers.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No suppliers yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {suppliers.data.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{s.name}</span>
                    {s.contactName ? <span className="text-muted-foreground"> — {s.contactName}</span> : null}
                    {s.phone ? <span className="text-muted-foreground"> · {s.phone}</span> : null}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingSupplierId(s.id);
                        setEditSupplierForm({
                          name: s.name,
                          contactName: s.contactName ?? "",
                          phone: s.phone ?? "",
                          email: s.email ?? "",
                          address: s.address ?? "",
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => submitDelete(() => api.deleteSupplier(s.id), () => suppliers.mutate())}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editingSupplierId ? (
            <form
              className="flex flex-wrap items-end gap-3 rounded-md border p-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () =>
                    api.updateSupplier(editingSupplierId, {
                      name: editSupplierForm.name,
                      contactName: editSupplierForm.contactName || undefined,
                      phone: editSupplierForm.phone || undefined,
                      email: editSupplierForm.email || undefined,
                      address: editSupplierForm.address || undefined,
                    }),
                  () => {
                    setEditingSupplierId(null);
                    suppliers.mutate();
                  },
                );
              }}
            >
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  className="w-40"
                  value={editSupplierForm.name}
                  onChange={(e) => setEditSupplierForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contact (optional)</Label>
                <Input
                  className="w-32"
                  value={editSupplierForm.contactName}
                  onChange={(e) => setEditSupplierForm((f) => ({ ...f, contactName: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone (optional)</Label>
                <Input
                  className="w-28"
                  value={editSupplierForm.phone}
                  onChange={(e) => setEditSupplierForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email (optional)</Label>
                <Input
                  className="w-40"
                  value={editSupplierForm.email}
                  onChange={(e) => setEditSupplierForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Address (optional)</Label>
                <Input
                  className="w-48"
                  value={editSupplierForm.address}
                  onChange={(e) => setEditSupplierForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm" disabled={!editSupplierForm.name}>
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingSupplierId(null)}>
                Cancel
              </Button>
            </form>
          ) : null}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () =>
                  api.createSupplier({
                    name: supplierForm.name,
                    contactName: supplierForm.contactName || undefined,
                    phone: supplierForm.phone || undefined,
                    email: supplierForm.email || undefined,
                    address: supplierForm.address || undefined,
                  }),
                () => {
                  setSupplierForm({ name: "", contactName: "", phone: "", email: "", address: "" });
                  suppliers.mutate();
                },
              );
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                className="w-40"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contact (optional)</Label>
              <Input
                className="w-32"
                value={supplierForm.contactName}
                onChange={(e) => setSupplierForm((f) => ({ ...f, contactName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone (optional)</Label>
              <Input
                className="w-28"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!supplierForm.name}>
              Add supplier
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card id="items" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!items.data || items.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No items yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {items.data.map((i) => (
                <li id={`inventory-item-${i.id}`} key={i.id} className="flex items-center justify-between py-2">
                  <span>
                    <span className="font-medium">{i.name}</span> <span className="text-muted-foreground">({i.sku})</span> —{" "}
                    {i.category.name}
                  </span>
                  <Badge variant={i.reorderLevel != null && i.currentStock <= i.reorderLevel ? "destructive" : "secondary"}>
                    {i.currentStock} {i.unit}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () =>
                  api.createInventoryItem({
                    categoryId: itemForm.categoryId,
                    name: itemForm.name,
                    sku: itemForm.sku,
                    unit: itemForm.unit,
                    barcode: itemForm.barcode || undefined,
                    reorderLevel: itemForm.reorderLevel ? Number(itemForm.reorderLevel) : undefined,
                  }),
                () => {
                  setItemForm({ categoryId: "", name: "", sku: "", unit: "", barcode: "", reorderLevel: "" });
                  items.mutate();
                },
              );
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <NativeSelect
                className="w-36"
                placeholder="Category"
                value={itemForm.categoryId}
                onChange={(v) => setItemForm((f) => ({ ...f, categoryId: v }))}
                options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input className="w-32" value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SKU</Label>
              <Input className="w-24" value={itemForm.sku} onChange={(e) => setItemForm((f) => ({ ...f, sku: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit</Label>
              <Input className="w-20" value={itemForm.unit} onChange={(e) => setItemForm((f) => ({ ...f, unit: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reorder level (optional)</Label>
              <Input
                className="w-24"
                type="number"
                value={itemForm.reorderLevel}
                onChange={(e) => setItemForm((f) => ({ ...f, reorderLevel: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!itemForm.categoryId || !itemForm.name || !itemForm.sku || !itemForm.unit}>
              Add item
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card id="purchase-orders" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Purchase orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!purchaseOrders.data || purchaseOrders.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No purchase orders yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {purchaseOrders.data.map((po) => (
                <li key={po.id} className="rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{po.supplier.name}</span>{" "}
                      <span className="text-muted-foreground">— {new Date(po.orderDate).toLocaleDateString()}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(po.status)}>{po.status}</Badge>
                      <Button type="button" size="sm" variant="outline" onClick={() => setSelectedPoId(po.id)}>
                        Manage
                      </Button>
                    </div>
                  </div>
                  {po.items.length > 0 ? (
                    <ul className="text-muted-foreground mt-1 text-xs">
                      {po.items.map((it) => (
                        <li key={it.id}>
                          {it.item.name} — {it.quantityReceived}/{it.quantityOrdered} received @ {it.unitPrice}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () => api.createPurchaseOrder({ supplierId: poForm.supplierId, notes: poForm.notes || undefined }),
                () => {
                  setPoForm({ supplierId: "", notes: "" });
                  purchaseOrders.mutate();
                },
              );
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Supplier</Label>
              <NativeSelect
                className="w-48"
                placeholder="Select supplier"
                value={poForm.supplierId}
                onChange={(v) => setPoForm((f) => ({ ...f, supplierId: v }))}
                options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Input className="w-48" value={poForm.notes} onChange={(e) => setPoForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <Button type="submit" size="sm" disabled={!poForm.supplierId}>
              Create order
            </Button>
          </form>

          {selectedPo ? (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">
                Managing order to {selectedPo.supplier.name} — <Badge variant={statusVariant(selectedPo.status)}>{selectedPo.status}</Badge>
              </p>

              {selectedPo.status === "DRAFT" ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    submitAction(
                      () =>
                        api.addPurchaseOrderItem(selectedPo.id, {
                          itemId: poItemForm.itemId,
                          quantityOrdered: Number(poItemForm.quantityOrdered),
                          unitPrice: Number(poItemForm.unitPrice),
                        }),
                      () => {
                        setPoItemForm({ itemId: "", quantityOrdered: "", unitPrice: "" });
                        purchaseOrders.mutate();
                      },
                    );
                  }}
                >
                  <NativeSelect
                    className="h-7 w-36"
                    placeholder="Item"
                    value={poItemForm.itemId}
                    onChange={(v) => setPoItemForm((f) => ({ ...f, itemId: v }))}
                    options={(items.data ?? []).map((i) => ({ value: i.id, label: i.name }))}
                  />
                  <Input
                    className="h-7 w-20"
                    type="number"
                    placeholder="Qty"
                    value={poItemForm.quantityOrdered}
                    onChange={(e) => setPoItemForm((f) => ({ ...f, quantityOrdered: e.target.value }))}
                  />
                  <Input
                    className="h-7 w-24"
                    type="number"
                    placeholder="Unit price"
                    value={poItemForm.unitPrice}
                    onChange={(e) => setPoItemForm((f) => ({ ...f, unitPrice: e.target.value }))}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-7"
                    disabled={!poItemForm.itemId || !poItemForm.quantityOrdered || !poItemForm.unitPrice}
                  >
                    Add line
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={selectedPo.items.length === 0}
                    onClick={() =>
                      submitAction(() => api.placePurchaseOrder(selectedPo.id), () => purchaseOrders.mutate())
                    }
                  >
                    Place order
                  </Button>
                </form>
              ) : null}

              {selectedPo.status === "ORDERED" ? (
                <form
                  className="space-y-2"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    const lines = selectedPo.items
                      .filter((it) => Number(receiveQty[it.id] ?? "0") > 0)
                      .map((it) => ({ purchaseOrderItemId: it.id, quantity: Number(receiveQty[it.id]) }));
                    if (lines.length === 0) return;
                    submitAction(
                      () => api.receivePurchaseOrder(selectedPo.id, { lines }),
                      () => {
                        setReceiveQty({});
                        purchaseOrders.mutate();
                        items.mutate();
                        stockMovements.mutate();
                      },
                    );
                  }}
                >
                  {selectedPo.items.map((it) => {
                    const remaining = it.quantityOrdered - it.quantityReceived;
                    return (
                      <div key={it.id} className="flex items-center gap-2 text-xs">
                        <span className="w-32">{it.item.name}</span>
                        <span className="text-muted-foreground">{remaining} remaining</span>
                        <Input
                          className="h-7 w-20"
                          type="number"
                          placeholder="Receive qty"
                          disabled={remaining <= 0}
                          value={receiveQty[it.id] ?? ""}
                          onChange={(e) => setReceiveQty((m) => ({ ...m, [it.id]: e.target.value }))}
                        />
                      </div>
                    );
                  })}
                  <Button type="submit" size="sm" className="h-7">
                    Receive stock
                  </Button>
                </form>
              ) : null}

              {selectedPo.status !== "RECEIVED" && selectedPo.status !== "CANCELLED" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => submitAction(() => api.cancelPurchaseOrder(selectedPo.id), () => purchaseOrders.mutate())}
                >
                  Cancel order
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card id="stock-movements" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Stock movements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!stockMovements.data || stockMovements.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No stock movements yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {stockMovements.data.slice(0, 20).map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <span>
                    {m.item.name} — <Badge variant={m.type === "IN" ? "secondary" : "outline"}>{m.type}</Badge> {m.quantity}
                    {m.reason ? <span className="text-muted-foreground"> ({m.reason})</span> : null}
                  </span>
                  <span className="text-muted-foreground text-xs">{new Date(m.movementDate).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <p className="text-xs font-medium">Manual stock adjustment</p>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () =>
                  api.createStockAdjustment({
                    itemId: adjustmentForm.itemId,
                    quantity: Number(adjustmentForm.quantity),
                    reason: adjustmentForm.reason || undefined,
                  }),
                () => {
                  setAdjustmentForm({ itemId: "", quantity: "", reason: "" });
                  stockMovements.mutate();
                  items.mutate();
                },
              );
            }}
          >
            <NativeSelect
              className="w-36"
              placeholder="Item"
              value={adjustmentForm.itemId}
              onChange={(v) => setAdjustmentForm((f) => ({ ...f, itemId: v }))}
              options={(items.data ?? []).map((i) => ({ value: i.id, label: i.name }))}
            />
            <div className="space-y-1">
              <Label className="text-xs">Quantity (± signed)</Label>
              <Input
                className="w-24"
                type="number"
                value={adjustmentForm.quantity}
                onChange={(e) => setAdjustmentForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <Input
              className="w-40"
              placeholder="Reason (optional)"
              value={adjustmentForm.reason}
              onChange={(e) => setAdjustmentForm((f) => ({ ...f, reason: e.target.value }))}
            />
            <Button type="submit" size="sm" disabled={!adjustmentForm.itemId || !adjustmentForm.quantity}>
              Record adjustment
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card id="assets" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Assets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!assets.data || assets.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No assets yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {assets.data.map((a) => {
                const activeAssignment = a.assignments[0];
                return (
                  <li key={a.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        <span className="font-medium">{a.name}</span> <span className="text-muted-foreground">({a.assetTag})</span>
                        {activeAssignment ? (
                          <span className="text-muted-foreground">
                            {" "}
                            — with {activeAssignment.assignedToEmployee.firstName} {activeAssignment.assignedToEmployee.lastName}
                          </span>
                        ) : null}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={a.status === "AVAILABLE" ? "secondary" : "destructive"}>{a.status}</Badge>
                        {activeAssignment ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              submitAction(() => api.returnAsset(activeAssignment.id), () => assets.mutate())
                            }
                          >
                            Return
                          </Button>
                        ) : null}
                        {a.status === "AVAILABLE" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              submitAction(
                                () => api.updateAsset(a.id, { status: "MAINTENANCE" }),
                                () => assets.mutate(),
                              )
                            }
                          >
                            Send to maintenance
                          </Button>
                        ) : a.status === "MAINTENANCE" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              submitAction(() => api.updateAsset(a.id, { status: "AVAILABLE" }), () => assets.mutate())
                            }
                          >
                            Mark available
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () =>
                  api.createAsset({
                    categoryId: assetForm.categoryId || undefined,
                    assetTag: assetForm.assetTag,
                    name: assetForm.name,
                  }),
                () => {
                  setAssetForm({ categoryId: "", assetTag: "", name: "" });
                  assets.mutate();
                },
              );
            }}
          >
            <NativeSelect
              className="w-36"
              placeholder="Category (optional)"
              value={assetForm.categoryId}
              onChange={(v) => setAssetForm((f) => ({ ...f, categoryId: v }))}
              options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <div className="space-y-1">
              <Label className="text-xs">Asset tag</Label>
              <Input
                className="w-28"
                value={assetForm.assetTag}
                onChange={(e) => setAssetForm((f) => ({ ...f, assetTag: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input className="w-40" value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <Button type="submit" size="sm" disabled={!assetForm.assetTag || !assetForm.name}>
              Add asset
            </Button>
          </form>

          <p className="text-xs font-medium">Assign an available asset</p>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(() => api.assignAsset(assignForm), () => {
                setAssignForm({ assetId: "", employeeId: "" });
                assets.mutate();
              });
            }}
          >
            <NativeSelect
              className="w-40"
              placeholder="Asset"
              value={assignForm.assetId}
              onChange={(v) => setAssignForm((f) => ({ ...f, assetId: v }))}
              options={(assets.data ?? []).filter((a) => a.status === "AVAILABLE").map((a) => ({ value: a.id, label: `${a.name} (${a.assetTag})` }))}
            />
            <NativeSelect
              className="w-40"
              placeholder="Employee"
              value={assignForm.employeeId}
              onChange={(v) => setAssignForm((f) => ({ ...f, employeeId: v }))}
              options={(employees.data ?? []).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))}
            />
            <Button type="submit" size="sm" disabled={!assignForm.assetId || !assignForm.employeeId}>
              Assign
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
    </FeatureLock>
  );
}
