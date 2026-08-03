-- Don PACKED cu da hoan tat cong viec kho; bo buoc quan ly xac nhan trung lap.
INSERT INTO "order_status_history" (
  "id",
  "order_id",
  "from_status",
  "to_status",
  "reason",
  "created_at"
)
SELECT
  'auto-ready-' || "id",
  "id",
  'PACKED'::"OrderStatus",
  'READY_FOR_DELIVERY'::"OrderStatus",
  'Tu dong ban giao shipper khi bo buoc quan ly xac nhan',
  CURRENT_TIMESTAMP
FROM "orders"
WHERE "status" = 'PACKED'::"OrderStatus"
ON CONFLICT ("id") DO NOTHING;

UPDATE "orders"
SET
  "status" = 'READY_FOR_DELIVERY'::"OrderStatus",
  "updated_at" = CURRENT_TIMESTAMP
WHERE "status" = 'PACKED'::"OrderStatus";
