-- Preserve in-flight legacy orders across the batch cut-over. The old aggregate
-- reservation remains authoritative when it is larger; active order lines fill
-- any missing reservation total so delivery can commit exact synthetic batches.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT o."store_id", oi."variant_id", SUM(oi."quantity") AS required_quantity
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."order_id"
      WHERE o."status" IN (
        'PENDING_PAYMENT', 'PLACED', 'STORE_CONFIRMED', 'PICKING', 'PACKED',
        'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED'
      )
      GROUP BY o."store_id", oi."variant_id"
    ) pending
    JOIN "store_inventories" si
      ON si."store_id" = pending."store_id" AND si."variant_id" = pending."variant_id"
    WHERE pending.required_quantity > si."quantity_on_hand"
  ) THEN
    RAISE EXCEPTION 'Cannot backfill open order batches: reserved order quantity exceeds stock';
  END IF;
END $$;

INSERT INTO "order_item_batch_allocations" (
  "id", "order_item_id", "batch_id", "quantity", "status", "created_at", "updated_at"
)
SELECT
  'legacy-open-order-' || oi."id",
  oi."id",
  ib."id",
  oi."quantity",
  'RESERVED'::"BatchAllocationStatus",
  o."created_at",
  CURRENT_TIMESTAMP
FROM "order_items" oi
JOIN "orders" o ON o."id" = oi."order_id"
JOIN "inventory_batches" ib
  ON ib."store_id" = o."store_id"
 AND ib."variant_id" = oi."variant_id"
 AND ib."batch_code" = 'LEGACY-' || LEFT(oi."variant_id", 8)
WHERE o."status" IN (
  'PENDING_PAYMENT', 'PLACED', 'STORE_CONFIRMED', 'PICKING', 'PACKED',
  'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED'
)
ON CONFLICT ("id") DO NOTHING;

WITH pending AS (
  SELECT ib."store_id", ib."variant_id", SUM(a."quantity") AS quantity
  FROM "order_item_batch_allocations" a
  JOIN "inventory_batches" ib ON ib."id" = a."batch_id"
  WHERE a."status" = 'RESERVED'::"BatchAllocationStatus"
  GROUP BY ib."store_id", ib."variant_id"
)
UPDATE "inventory_batches" ib
SET "reserved_quantity" = GREATEST(ib."reserved_quantity", pending.quantity),
    "updated_at" = CURRENT_TIMESTAMP
FROM pending
WHERE ib."store_id" = pending."store_id"
  AND ib."variant_id" = pending."variant_id"
  AND ib."batch_code" = 'LEGACY-' || LEFT(ib."variant_id", 8);

WITH pending AS (
  SELECT ib."store_id", ib."variant_id", SUM(a."quantity") AS quantity
  FROM "order_item_batch_allocations" a
  JOIN "inventory_batches" ib ON ib."id" = a."batch_id"
  WHERE a."status" = 'RESERVED'::"BatchAllocationStatus"
  GROUP BY ib."store_id", ib."variant_id"
)
UPDATE "store_inventories" si
SET "reserved_quantity" = GREATEST(si."reserved_quantity", pending.quantity),
    "updated_at" = CURRENT_TIMESTAMP
FROM pending
WHERE si."store_id" = pending."store_id"
  AND si."variant_id" = pending."variant_id";
