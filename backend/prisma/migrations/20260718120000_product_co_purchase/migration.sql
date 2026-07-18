-- Co-purchase cache: pair counts from completed orders (item-item co-occurrence)
CREATE TABLE IF NOT EXISTS "product_co_purchases" (
    "product_id_a" TEXT NOT NULL,
    "product_id_b" TEXT NOT NULL,
    "co_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_co_purchases_pkey" PRIMARY KEY ("product_id_a","product_id_b")
);

CREATE INDEX IF NOT EXISTS "product_co_purchases_product_id_a_co_count_idx"
  ON "product_co_purchases"("product_id_a", "co_count" DESC);

CREATE INDEX IF NOT EXISTS "product_co_purchases_product_id_b_co_count_idx"
  ON "product_co_purchases"("product_id_b", "co_count" DESC);
