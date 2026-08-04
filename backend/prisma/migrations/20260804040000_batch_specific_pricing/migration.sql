-- Optional lot targeting keeps legacy FEFO rows valid while allowing explicit selection.
ALTER TABLE "cart_items" ADD COLUMN "batch_id" TEXT;
ALTER TABLE "pos_sale_items" ADD COLUMN "batch_id" TEXT;
ALTER TABLE "campaign_items" ADD COLUMN "batch_id" TEXT;

ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_sale_items"
  ADD CONSTRAINT "pos_sale_items_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "campaign_items"
  ADD CONSTRAINT "campaign_items_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "cart_items_batch_id_idx" ON "cart_items"("batch_id");
CREATE INDEX "pos_sale_items_batch_id_idx" ON "pos_sale_items"("batch_id");
CREATE INDEX "campaign_items_variant_id_batch_id_idx" ON "campaign_items"("variant_id", "batch_id");

DROP INDEX "campaign_items_campaign_id_variant_id_key";
CREATE UNIQUE INDEX "campaign_items_campaign_id_variant_id_batch_id_key"
  ON "campaign_items"("campaign_id", "variant_id", "batch_id");
