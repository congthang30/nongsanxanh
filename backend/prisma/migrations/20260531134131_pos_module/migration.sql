-- CreateEnum
CREATE TYPE "VariantSaleMode" AS ENUM ('UNIT', 'WEIGHT');

-- CreateEnum
CREATE TYPE "BarcodeType" AS ENUM ('EAN13', 'UPC', 'CODE128', 'INTERNAL', 'SCALE_LABEL');

-- CreateEnum
CREATE TYPE "BarcodeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "POSSaleStatus" AS ENUM ('DRAFT', 'HELD', 'PAID', 'VOIDED', 'REFUNDED', 'PARTIAL_REFUNDED');

-- CreateEnum
CREATE TYPE "POSPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "POSPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER_MANUAL', 'CARD', 'VNPAY', 'MOMO', 'ZALOPAY');

-- CreateEnum
CREATE TYPE "POSPaymentRecordStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CashierShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "POSReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryTxType" ADD VALUE 'POS_SALE';
ALTER TYPE "InventoryTxType" ADD VALUE 'POS_RETURN';
ALTER TYPE "InventoryTxType" ADD VALUE 'POS_LOSS';

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "allow_decimal_quantity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sale_mode" "VariantSaleMode" NOT NULL DEFAULT 'UNIT';

-- CreateTable
CREATE TABLE "product_barcodes" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "type" "BarcodeType" NOT NULL DEFAULT 'EAN13',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "BarcodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashier_shifts" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "cashier_id" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "opening_cash" INTEGER NOT NULL DEFAULT 0,
    "expected_cash" INTEGER NOT NULL DEFAULT 0,
    "counted_cash" INTEGER,
    "cash_difference" INTEGER,
    "status" "CashierShiftStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashier_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sales" (
    "id" TEXT NOT NULL,
    "sale_number" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "cashier_id" TEXT NOT NULL,
    "shift_id" TEXT,
    "customer_id" TEXT,
    "customer_phone_snapshot" TEXT,
    "status" "POSSaleStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discount_total" INTEGER NOT NULL DEFAULT 0,
    "tax_total" INTEGER NOT NULL DEFAULT 0,
    "grand_total" INTEGER NOT NULL DEFAULT 0,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "change_amount" INTEGER NOT NULL DEFAULT 0,
    "payment_status" "POSPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "paid_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "voided_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sale_items" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "barcode_snapshot" TEXT,
    "product_name_snapshot" TEXT NOT NULL,
    "sku_snapshot" TEXT NOT NULL,
    "unit_snapshot" TEXT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "line_total" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_payments" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "method" "POSPaymentMethod" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "POSPaymentRecordStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "tendered" INTEGER,
    "change" INTEGER,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_returns" (
    "id" TEXT NOT NULL,
    "original_sale_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "cashier_id" TEXT NOT NULL,
    "approved_by" TEXT,
    "refund_amount" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "status" "POSReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "pos_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_return_items" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "sale_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "refund_amount" INTEGER NOT NULL,
    "restockable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pos_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_barcodes_barcode_key" ON "product_barcodes"("barcode");

-- CreateIndex
CREATE INDEX "product_barcodes_variant_id_status_idx" ON "product_barcodes"("variant_id", "status");

-- CreateIndex
CREATE INDEX "cashier_shifts_store_id_status_idx" ON "cashier_shifts"("store_id", "status");

-- CreateIndex
CREATE INDEX "cashier_shifts_cashier_id_status_idx" ON "cashier_shifts"("cashier_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pos_sales_sale_number_key" ON "pos_sales"("sale_number");

-- CreateIndex
CREATE INDEX "pos_sales_store_id_status_created_at_idx" ON "pos_sales"("store_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "pos_sales_cashier_id_created_at_idx" ON "pos_sales"("cashier_id", "created_at");

-- CreateIndex
CREATE INDEX "pos_sales_shift_id_idx" ON "pos_sales"("shift_id");

-- CreateIndex
CREATE INDEX "pos_sale_items_sale_id_idx" ON "pos_sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "pos_payments_sale_id_idx" ON "pos_payments"("sale_id");

-- CreateIndex
CREATE INDEX "pos_returns_store_id_status_idx" ON "pos_returns"("store_id", "status");

-- CreateIndex
CREATE INDEX "pos_returns_original_sale_id_idx" ON "pos_returns"("original_sale_id");

-- CreateIndex
CREATE INDEX "pos_return_items_return_id_idx" ON "pos_return_items"("return_id");

-- AddForeignKey
ALTER TABLE "product_barcodes" ADD CONSTRAINT "product_barcodes_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "cashier_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "pos_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "pos_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_original_sale_id_fkey" FOREIGN KEY ("original_sale_id") REFERENCES "pos_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_return_items" ADD CONSTRAINT "pos_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "pos_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_return_items" ADD CONSTRAINT "pos_return_items_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "pos_sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
