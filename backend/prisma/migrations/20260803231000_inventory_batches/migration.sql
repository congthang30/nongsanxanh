-- Inventory is now tracked by physical receipt batch. StoreInventory remains a
-- summary projection for fast catalog/checkout reads.
CREATE TYPE "InventoryBatchStatus" AS ENUM ('ACTIVE', 'DEPLETED', 'BLOCKED');
CREATE TYPE "BatchAllocationStatus" AS ENUM ('RESERVED', 'COMMITTED', 'RELEASED');

CREATE TABLE "inventory_batches" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "batch_code" TEXT NOT NULL,
    "received_date" DATE NOT NULL,
    "expiry_date" DATE NOT NULL,
    "quantity_on_hand" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reserved_quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "status" "InventoryBatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_batches_dates_check" CHECK ("expiry_date" >= "received_date"),
    CONSTRAINT "inventory_batches_quantities_check" CHECK (
      "quantity_on_hand" >= 0 AND "reserved_quantity" >= 0
      AND "reserved_quantity" <= "quantity_on_hand"
    )
);

ALTER TABLE "inventory_transactions" ADD COLUMN "batch_id" TEXT;

CREATE TABLE "order_item_batch_allocations" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "returned_quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "status" "BatchAllocationStatus" NOT NULL DEFAULT 'RESERVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "order_item_batch_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_item_batch_allocations_quantities_check" CHECK (
      "quantity" > 0 AND "returned_quantity" >= 0
      AND "returned_quantity" <= "quantity"
    )
);

CREATE TABLE "pos_sale_item_batch_allocations" (
    "id" TEXT NOT NULL,
    "sale_item_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "returned_quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pos_sale_item_batch_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pos_sale_item_batch_allocations_quantities_check" CHECK (
      "quantity" > 0 AND "returned_quantity" >= 0
      AND "returned_quantity" <= "quantity"
    )
);

CREATE UNIQUE INDEX "inventory_batches_store_id_variant_id_batch_code_key"
  ON "inventory_batches"("store_id", "variant_id", "batch_code");
CREATE INDEX "inventory_batches_store_id_variant_id_expiry_date_status_idx"
  ON "inventory_batches"("store_id", "variant_id", "expiry_date", "status");
CREATE INDEX "inventory_batches_expiry_date_status_idx"
  ON "inventory_batches"("expiry_date", "status");
CREATE INDEX "inventory_transactions_batch_id_created_at_idx"
  ON "inventory_transactions"("batch_id", "created_at");
CREATE INDEX "order_item_batch_allocations_order_item_id_status_idx"
  ON "order_item_batch_allocations"("order_item_id", "status");
CREATE INDEX "order_item_batch_allocations_batch_id_status_idx"
  ON "order_item_batch_allocations"("batch_id", "status");
CREATE INDEX "pos_sale_item_batch_allocations_sale_item_id_idx"
  ON "pos_sale_item_batch_allocations"("sale_item_id");
CREATE INDEX "pos_sale_item_batch_allocations_batch_id_idx"
  ON "pos_sale_item_batch_allocations"("batch_id");

ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_item_batch_allocations" ADD CONSTRAINT "order_item_batch_allocations_order_item_id_fkey"
  FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_item_batch_allocations" ADD CONSTRAINT "order_item_batch_allocations_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_sale_item_batch_allocations" ADD CONSTRAINT "pos_sale_item_batch_allocations_sale_item_id_fkey"
  FOREIGN KEY ("sale_item_id") REFERENCES "pos_sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_sale_item_batch_allocations" ADD CONSTRAINT "pos_sale_item_batch_allocations_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve pre-batch development data as one synthetic, long-lived batch per
-- store/variant. New receipts must always supply real dates and a real code.
INSERT INTO "inventory_batches" (
  "id", "store_id", "variant_id", "batch_code", "received_date", "expiry_date",
  "quantity_on_hand", "reserved_quantity", "status", "created_at", "updated_at"
)
SELECT
  'legacy-' || si."id", si."store_id", si."variant_id",
  'LEGACY-' || substr(si."id", 1, 8), CURRENT_DATE, CURRENT_DATE + 3650,
  GREATEST(si."quantity_on_hand", 0),
  LEAST(GREATEST(si."reserved_quantity", 0), GREATEST(si."quantity_on_hand", 0)),
  CASE WHEN si."quantity_on_hand" > 0 THEN 'ACTIVE'::"InventoryBatchStatus"
       ELSE 'DEPLETED'::"InventoryBatchStatus" END,
  si."created_at", CURRENT_TIMESTAMP
FROM "store_inventories" si;

UPDATE "inventory_transactions" it
SET "batch_id" = ib."id"
FROM "inventory_batches" ib
WHERE ib."store_id" = it."store_id" AND ib."variant_id" = it."variant_id";

ALTER TABLE "inventory_transactions" ALTER COLUMN "batch_id" SET NOT NULL;

-- Historical fulfilled orders remain returnable to the synthetic batch. Open
-- legacy orders are intentionally not fabricated as reservations: current
-- StoreInventory reservation totals cannot be safely attributed per order.
INSERT INTO "order_item_batch_allocations" (
  "id", "order_item_id", "batch_id", "quantity", "status", "created_at", "updated_at"
)
SELECT
  'legacy-order-' || oi."id", oi."id", ib."id", oi."quantity",
  'COMMITTED'::"BatchAllocationStatus", o."created_at", CURRENT_TIMESTAMP
FROM "order_items" oi
JOIN "orders" o ON o."id" = oi."order_id"
JOIN "inventory_batches" ib
  ON ib."store_id" = o."store_id" AND ib."variant_id" = oi."variant_id"
WHERE o."status" IN ('DELIVERED', 'COMPLETED', 'RETURN_REQUESTED', 'RETURNED');

-- Existing paid POS items remain returnable to the correct synthetic batch.
INSERT INTO "pos_sale_item_batch_allocations" (
  "id", "sale_item_id", "batch_id", "quantity", "created_at", "updated_at"
)
SELECT
  'legacy-pos-' || psi."id", psi."id", ib."id", psi."quantity",
  ps."created_at", CURRENT_TIMESTAMP
FROM "pos_sale_items" psi
JOIN "pos_sales" ps ON ps."id" = psi."sale_id"
JOIN "inventory_batches" ib
  ON ib."store_id" = ps."store_id" AND ib."variant_id" = psi."variant_id"
WHERE ps."status" IN ('PAID', 'PARTIAL_REFUNDED', 'REFUNDED');
