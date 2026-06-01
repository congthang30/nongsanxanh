-- P2-01: chong double redemption coupon o tang DB.
-- Buoc 1: xoa ban ghi trung (giu ban ghi cu nhat) neu co, de them unique an toan.
DELETE FROM "coupon_redemptions" a
USING "coupon_redemptions" b
WHERE a."coupon_id" = b."coupon_id"
  AND a."user_id" = b."user_id"
  AND a."order_id" = b."order_id"
  AND a."created_at" > b."created_at";

-- Buoc 2: them unique constraint.
CREATE UNIQUE INDEX "coupon_redemptions_coupon_id_user_id_order_id_key"
  ON "coupon_redemptions"("coupon_id", "user_id", "order_id");
