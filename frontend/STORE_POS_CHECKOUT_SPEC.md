# NongSan Xanh Store POS Checkout Spec

Ngay tao: 2026-05-31

## 0. Muc dich

File nay bo sung cho `BACH_HOA_XANH_STORE_MVP_SPEC.md`.

Muc tieu: them nghiep vu ban hang tai quay cho cua hang vat ly, tuong tu mo hinh sieu thi/cua hang Bach Hoa Xanh:

```text
Khach den cua hang
Nhan vien thu ngan quet barcode san pham
He thong lay gia + ton kho cua chinh cua hang
Ap dung khuyen mai/hoi vien neu co
Khach thanh toan tien mat/chuyen khoan/the/vi
He thong in hoa don
Ton kho cua cua hang giam ngay
Doanh thu vao bao cao cua cua hang va ca lam viec cua nhan vien
```

Day la luong **offline in-store purchase**, khac voi luong online order giao hang.

## 1. Ket luan nghiep vu

Can them module POS (Point of Sale) cho tung cua hang.

Trong MVP:

- Moi cua hang co man hinh thu ngan.
- Nhan vien cua hang co quyen tinh tien tai quay.
- Moi san pham/variant co barcode.
- Thu ngan quet barcode de them san pham vao hoa don.
- He thong lay gia theo cua hang hien tai.
- He thong tru ton kho cua cua hang sau khi thanh toan thanh cong.
- Hoa don POS gan voi:
  - storeId
  - cashierId
  - shiftId neu co
  - payment method
  - items
  - inventory transactions
- POS sale khong tao delivery.
- POS sale khong can dia chi khach.
- POS sale khong can resolve store vi nhan vien dang ban tai store cua minh.

## 2. Pham vi MVP

### 2.1 Co trong MVP

- Dang nhap nhan vien.
- Man hinh POS cua cua hang.
- Quet barcode san pham.
- Tim san pham thu cong neu barcode hong.
- Them/xoa/sua so luong item tren hoa don.
- Ho tro san pham ban theo don vi dem: hop, tui, bo, chai.
- Ho tro san pham can ky bang cach nhap khoi luong thu cong.
- Tam tinh, giam gia, tong tien.
- Thanh toan tien mat.
- Thanh toan QR/chuyen khoan ghi nhan thu cong.
- Thanh toan the/vi dien tu neu payment gateway da co.
- In/xuat hoa don.
- Huy hoa don truoc thanh toan.
- Hoan hang/tra hang co quyen quan ly.
- Bao cao doanh thu theo ca/ngay/cua hang.
- Tru ton kho store sau khi thanh toan.

### 2.2 De sau MVP

- Tich hop can dien tu tu dong.
- Ma barcode can ky nhung san pham tuoi phuc tap theo chuan EAN-13 weight embedded.
- May in hoa don vat ly.
- May quet barcode vat ly qua HID/USB da chuan hoa.
- Payment terminal card that.
- Hoa don dien tu/VAT chuan thue.
- Loyalty/diem thuong phuc tap.
- Split payment nhieu phuong thuc.
- Offline mode khi mat mang.
- Quan ly ket ca nang cao.

## 3. Role va quyen

### 3.1 Cashier

Co the la `STORE_STAFF` co permission `POS_CASHIER`.

Quyen:

- Mo man hinh POS cua store minh.
- Quet barcode.
- Tao hoa don POS.
- Ap dung voucher/khuyen mai duoc phep.
- Nhan thanh toan.
- In hoa don.
- Huy hoa don chua thanh toan.
- Xem hoa don minh tao trong ca.

Khong duoc:

- Sua gia goc.
- Ban am ton neu khong duoc cap quyen.
- Hoan tien/tra hang sau thanh toan neu khong co manager approve.
- Xem doanh thu cua store khac.

### 3.2 Store Manager

Quyen:

- Tat ca quyen cashier trong store minh.
- Mo/khoa ca ban hang.
- Duyet void/return/refund.
- Xem bao cao POS cua store.
- Xem chenhlech tien mat cuoi ca.
- Dieu chinh ton kho neu can.

### 3.3 Warehouse Staff

Quyen lien quan:

- Xem ton kho.
- Cap nhat nhap/xuat/dieu chinh.
- Khong mac dinh duoc tinh tien tai quay, tru khi duoc cap them permission POS.

### 3.4 Admin/Super Admin

Quyen:

- Quan ly barcode.
- Quan ly product/variant.
- Quan ly gia/khuyen mai.
- Xem tat ca hoa don POS.
- Xem bao cao doanh thu toan chuoi.
- Cau hinh payment methods.

## 4. Barcode model

### 4.1 Barcode gan voi variant

Moi variant can co it nhat mot barcode.

```text
Product
- id
- name

ProductVariant
- id
- productId
- sku
- unit
- unitValue
- basePrice

ProductBarcode
- id
- variantId
- barcode unique
- type enum EAN13 | UPC | CODE128 | INTERNAL | SCALE_LABEL
- isPrimary
- status ACTIVE | INACTIVE
- createdAt
```

Vi du:

```text
Product: Tao Fuji
Variant A: Tao Fuji 1kg
Barcode: 893xxxx001

Product: Rau cai ngot
Variant A: Rau cai ngot 500g
Barcode: 893xxxx002

Product: Chuoi cau
Variant A: Chuoi cau ban theo kg
Barcode: 893xxxx003 hoac ma can ky
```

### 4.2 Nhieu barcode cho mot variant

Can ho tro:

- Barcode nha cung cap.
- Barcode noi bo.
- Barcode tem can.
- Barcode moi khi thay bao bi.

Rule:

- Mot barcode chi map den mot variant active.
- Mot variant co the co nhieu barcode.
- Khi quet barcode inactive, POS bao "Ma vach da ngung dung".

### 4.3 San pham can ky

Co 2 cach:

#### Cach MVP don gian

Nhan vien quet barcode cua variant, sau do nhap khoi luong:

```text
Scan barcode "CA-CHUA-KG"
POS hien "Ca chua - gia/kg"
Cashier nhap 0.7 kg
Line total = unitPrice * 0.7
```

Can co field:

```text
ProductVariant.saleMode = UNIT | WEIGHT
ProductVariant.unit = kg | gram | bo | tui | hop
ProductVariant.allowDecimalQuantity = true/false
```

#### Cach sau MVP

Dung barcode can ky embedded weight/price:

```text
Barcode tem can gom:
- prefix
- product code
- weight hoac price
- check digit
```

MVP chua bat buoc lam.

## 5. POS sale lifecycle

Trang thai hoa don POS:

```text
DRAFT       Dang quet hang
HELD        Tam treo hoa don
PAID        Da thanh toan
VOIDED      Huy truoc/sau thanh toan theo quyen
REFUNDED    Da hoan tien toan bo
PARTIAL_REFUNDED Hoan mot phan
```

Flow chinh:

```text
Cashier login
-> Open POS screen
-> Scan barcode
-> POS lookup variant + store inventory + price
-> Add item to draft sale
-> Repeat scan
-> Apply promotion/member phone optional
-> Select payment method
-> Customer pays
-> POS creates paid sale in transaction
-> Decrease store inventory
-> Create inventory transaction COMMIT_POS
-> Print receipt
```

## 6. Payment flow tai quay

### 6.1 Tien mat

Flow:

```text
Cashier chon payment CASH
Nhap tien khach dua
POS tinh tien thoi
Cashier xac nhan da nhan tien
Sale status = PAID
Cash drawer expectedCash += paidAmount
```

Can UI:

- Tong tien.
- Tien khach dua.
- Tien thoi.
- Nut xac nhan thanh toan.
- Canh bao neu tien khach dua < tong tien.

### 6.2 Chuyen khoan/QR thu cong

Flow MVP:

```text
POS hien QR cua cua hang hoac thong tin tai khoan
Khach chuyen khoan
Cashier kiem tra app ngan hang
Cashier bam "Da nhan chuyen khoan"
Sale status = PAID
Payment reference optional
```

Rui ro:

- Cashier bam nham khi chua nhan tien.

Xu ly:

- Ghi audit log.
- Cho manager void/refund.
- Sau MVP tich hop webhook ngan hang/QR dynamic.

### 6.3 The/vi dien tu/gateway

Neu gateway da co:

```text
POS tao payment request
Khach thanh toan QR/VNPay/MoMo/ZaloPay
Gateway callback SUCCESS
Sale status = PAID
```

Neu gateway chua co, MVP co the de payment method `BANK_TRANSFER_MANUAL`.

### 6.4 Split payment

Sau MVP. Vi du:

- 100k tien mat + 50k QR.

MVP nen khong lam de tranh phuc tap ket ca.

## 7. Inventory behavior

### 7.1 Tru ton

POS la ban tai cua hang, nen ton kho giam ngay khi thanh toan thanh cong.

Transaction:

```text
BEGIN
  Lock StoreInventory rows
  Validate available >= quantity
  Create POSSale
  Create POSSaleItems
  Update quantityOnHand -= quantity
  Create InventoryTransaction type POS_SALE
  Create Payment record
COMMIT
```

### 7.2 Khong reserve dai han

Khac online order:

- POS sale draft chua can reserve inventory.
- Khi scan, co the warning neu ton khong du.
- Khi pay, validate lai ton trong transaction.

### 7.3 Ban vuot ton

MVP mac dinh:

- Khong cho ban vuot ton.

Ngoai le:

- Store Manager/Admin co permission `ALLOW_NEGATIVE_STOCK`.
- Neu cho ban vuot ton, phai log audit va tao canh bao kho.

### 7.4 Return/refund

Khi tra hang:

- Tao POSReturn.
- Neu hang con ban duoc: tang quantityOnHand.
- Neu hang hong: khong tang quantityOnHand, tao loss transaction.

## 8. Promotion tai quay

MVP can ho tro don gian:

- Giam gia theo ma.
- Giam gia theo san pham.
- Giam gia theo store.
- Freeship khong lien quan POS.

Can ap dung khuyen mai theo thu tu:

1. Product sale price tai store.
2. Promotion theo line item.
3. Voucher/order discount neu co.
4. Lam tron tien neu can.

POS can hien ro:

- Gia goc.
- Gia sau giam.
- Ly do giam.
- Tong tiet kiem.

Khong cho cashier sua discount tu do trong MVP, tru khi manager approve.

## 9. Customer phone/member

Bach Hoa Xanh thuong co so dien thoai khach/hoi vien. MVP co the them:

```text
Cashier nhap so dien thoai khach
Neu user ton tai -> attach customerId vao POSSale
Neu khong ton tai -> luu customerPhoneSnapshot
```

Dung de:

- Tra cuu lich su mua tai cua hang.
- Ho tro doi tra.
- Sau MVP: loyalty.

Khong bat buoc customer dang nhap khi mua tai quay.

## 10. POS data model de xuat

```text
POSSale
- id
- saleNumber unique
- storeId
- cashierId
- shiftId nullable
- customerId nullable
- customerPhoneSnapshot nullable
- status DRAFT | HELD | PAID | VOIDED | REFUNDED | PARTIAL_REFUNDED
- subtotal
- discountTotal
- taxTotal default 0
- grandTotal
- amountPaid
- changeAmount
- paymentStatus PENDING | PAID | FAILED | REFUNDED
- note nullable
- paidAt nullable
- voidedAt nullable
- voidReason nullable
- createdAt
- updatedAt

POSSaleItem
- id
- saleId
- productId
- variantId
- barcodeSnapshot
- productNameSnapshot
- skuSnapshot
- unitSnapshot
- unitPrice
- quantity decimal
- discountAmount
- lineTotal

POSPayment
- id
- saleId
- method CASH | BANK_TRANSFER_MANUAL | CARD | VNPAY | MOMO | ZALOPAY
- amount
- status PENDING | SUCCESS | FAILED | REFUNDED
- reference nullable
- paidAt nullable
- createdAt

ProductBarcode
- id
- variantId
- barcode unique
- type
- isPrimary
- status

CashierShift
- id
- storeId
- cashierId
- openedAt
- closedAt nullable
- openingCash
- expectedCash
- countedCash nullable
- cashDifference nullable
- status OPEN | CLOSED

POSReturn
- id
- originalSaleId
- storeId
- cashierId
- approvedBy nullable
- refundAmount
- reason
- status REQUESTED | APPROVED | REJECTED | COMPLETED
- createdAt

POSReturnItem
- id
- returnId
- saleItemId
- quantity
- refundAmount
- restockable boolean
```

## 11. POS APIs de xuat

### 11.1 Cashier

```text
POST /pos/shifts/open
POST /pos/shifts/close
GET /pos/shifts/current

POST /pos/sales
GET /pos/sales/:id
POST /pos/sales/:id/scan
PATCH /pos/sales/:id/items/:itemId
DELETE /pos/sales/:id/items/:itemId
POST /pos/sales/:id/hold
POST /pos/sales/:id/resume
POST /pos/sales/:id/pay
POST /pos/sales/:id/void
GET /pos/sales/:id/receipt

GET /pos/products/lookup?barcode=
GET /pos/products/search?q=
```

### 11.2 Manager

```text
GET /pos/reports/daily
GET /pos/reports/shifts
GET /pos/sales?storeId=&from=&to=
POST /pos/sales/:id/manager-void
POST /pos/returns
POST /pos/returns/:id/approve
POST /pos/returns/:id/complete
```

### 11.3 Admin

```text
GET /admin/barcodes
POST /admin/products/:variantId/barcodes
PATCH /admin/barcodes/:id
DELETE /admin/barcodes/:id
GET /admin/pos/sales
GET /admin/pos/reports
```

## 12. POS UI chi tiet

### 12.1 Man hinh POS chinh

Layout nen giong cashier terminal:

Ben trai:

- O scan barcode lon, auto focus.
- Tim san pham thu cong.
- Ket qua lookup.
- Nut them san pham can ky.

Giua:

- Danh sach item trong hoa don.
- Ten san pham.
- Barcode/SKU.
- Gia.
- So luong.
- Thanh tien.
- Nut xoa item.

Ben phai:

- Thong tin cua hang.
- Cashier/shift.
- Tam tinh.
- Giam gia.
- Tong tien.
- Payment method.
- Tien khach dua/tien thoi.
- Nut thanh toan.
- Nut in hoa don.
- Nut treo hoa don.

### 12.2 Scan barcode behavior

Khi scan:

```text
barcode input receives Enter
-> call lookup
-> if one active variant found:
     if saleMode UNIT:
        add quantity +1
     if saleMode WEIGHT:
        open quantity modal
-> if not found:
     show inline error + sound/visual warning
-> if inventory insufficient:
     show warning, block add unless manager override
```

### 12.3 UX can co

- Input barcode auto focus sau moi lan scan.
- Phim tat:
  - Enter: scan/add.
  - F2: tim san pham.
  - F4: thanh toan tien mat.
  - F6: treo hoa don.
  - Esc: huy modal.
- So tien dung font tabular.
- Loi hien ngay tai khu vuc scan/payment.
- Khong dung browser `prompt()`.
- Hanh dong void/refund can modal nhap ly do.

## 13. Receipt

Hoa don can co:

- Ten cua hang.
- Dia chi cua hang.
- Ma hoa don.
- Ngay gio.
- Thu ngan.
- Danh sach item.
- Gia/so luong/thanh tien.
- Giam gia.
- Tong tien.
- Phuong thuc thanh toan.
- Tien khach dua/tien thoi neu tien mat.
- Hotline ho tro.
- Ma QR/receipt code de tra cuu doi tra neu can.

MVP co the in bang browser print.

## 14. Bao cao

Can co:

- Doanh thu POS theo ngay.
- Doanh thu theo cashier.
- Doanh thu theo store.
- Top san pham ban tai quay.
- So hoa don.
- Gia tri hoa don trung binh.
- Tien mat expected vs counted.
- So hoa don void/refund.
- Ton kho giam do POS sale.

## 15. Bao mat va audit

Audit bat buoc:

- Mo/ket ca.
- Tao hoa don thanh toan.
- Void hoa don.
- Refund/return.
- Manager override.
- Ban am ton neu cho phep.
- Sua barcode.
- Dieu chinh gia/discount thu cong.

Ownership:

- Cashier chi POS trong store cua minh.
- Manager chi xem POS cua store minh.
- Admin xem toan bo.

Chong gian lan:

- Khong cho sua gia line item neu khong co quyen.
- Void/refund can ly do va manager approve.
- Ket ca phai doi soat tien mat.
- Barcode unique toan he thong.

## 16. Tich hop voi online order

POS va online cung dung:

- Product.
- ProductVariant.
- StoreInventory.
- InventoryTransaction.
- Store.
- Staff permissions.

Khac nhau:

| Luong | Online order | POS sale |
| --- | --- | --- |
| Dia chi | Bat buoc | Khong can |
| Store assignment | He thong tu resolve theo dia chi/GPS, khach khong chon store | Store cua cashier |
| Delivery | Co | Khong |
| Reserve inventory | Co khi tao order | Khong reserve dai, tru khi pay |
| Payment | COD/online | Tien mat/QR/the |
| Hoa don | Order receipt | POS receipt |

## 17. Acceptance criteria

POS MVP dung khi:

- Moi variant co barcode hoac co the gan barcode.
- Cashier quet barcode them item vao hoa don.
- POS lay gia va ton kho theo store cua cashier.
- POS chan ban neu store khong du ton.
- Thanh toan tien mat tinh dung tien thoi.
- Thanh toan QR thu cong ghi nhan reference optional.
- Sau khi thanh toan, store inventory giam dung.
- Co InventoryTransaction cho moi item POS.
- Hoa don gan storeId, cashierId, shiftId neu co.
- Receipt co du thong tin can thiet.
- Store Manager xem bao cao POS cua store.
- Admin xem POS report toan chuoi.
- Cashier khong xem du lieu store khac.
- Void/refund can ly do va audit.

## 18. Prompt trien khai POS cho AI/coding agent

```text
Doc STORE_POS_CHECKOUT_SPEC.md va BACH_HOA_XANH_STORE_MVP_SPEC.md.
Them module POS ban hang tai quay cho chuoi cua hang.
Moi product variant phai ho tro barcode.
Cashier quet barcode de them san pham vao hoa don.
Gia va ton kho phai lay theo store cua cashier.
POS sale khong co delivery, khong resolve store theo dia chi, khong multi-store.
Khi thanh toan thanh cong, tru StoreInventory trong transaction va tao InventoryTransaction.
Ho tro cash payment voi tien khach dua/tien thoi.
Ho tro bank transfer manual/QR voi reference optional.
Them shift, receipt, void/refund co manager approval neu kip MVP.
Dam bao cashier/manager bi scope theo store, admin xem toan he thong.
Build/test va smoke test flow barcode -> pay -> inventory decrease -> receipt.
```
