# NongSan Xanh Store-Chain MVP Spec

Ngay tao: 2026-05-31

## 0. Ket luan nghiep vu moi

Du an chuyen tu mo hinh marketplace nhieu seller kieu Shopee sang mo hinh chuoi cua hang theo khu vuc, gan voi cach van hanh cua Bach Hoa Xanh:

```text
Customer cung cap vi tri/dia chi giao hang
He thong tu tinh cua hang phu hop nhat: gan nhat, co phuc vu khu vuc, co du hang
Customer mua hang tu cua hang duoc gan
Cua hang xu ly don, soan hang tu kho cua hang
Shipper co dinh cua cua hang giao don
Admin quan tri toan bo chuoi cua hang
```

Trong MVP:

- Moi khu vuc se co mot cua hang/diem ban chinh.
- Mot don hang chi thuoc ve mot cua hang.
- He thong tu dong gan don cho cua hang phu hop nhat dua tren dia chi giao hang.
- Khach khong phai chon khu vuc/cua hang thu cong trong UI.
- Neu cua hang gan nhat khong du hang, he thong tu xet cua hang gan tiep theo co du hang.
- Moi cua hang co mot quan ly.
- Moi cua hang co nhieu nhan vien.
- Moi cua hang co nhan vien kho.
- Moi cua hang co mot shipper chinh.
- Shipper cua cua hang do la nguoi giao cac don cua cua hang do.
- Khong con seller doc lap tu dang ky shop va tu ban hang nhu marketplace.

Ten mien nghiep vu nen doi:

```text
Shop/Seller cu  -> Store/Branch/Cua hang noi bo
SellerOrder cu -> StoreOrder hoac Order gan storeId
SellerInventory cu -> StoreInventory
Dispatch offer cu -> Delivery assignment truc tiep cho shipper cua store
```

## 1. Nguon su that moi

File nay la nguon su that moi cho MVP.

Neu code, tai lieu, route, database, UI hien tai con cac flow sau thi xem la legacy can bo hoac migrate:

- Seller dang ky mo shop.
- Admin duyet seller/shop doc lap.
- Seller tu dang san pham rieng.
- Seller voucher rieng.
- Shop service area theo seller.
- Multi-shop cart.
- Tach don theo seller.
- Dispatch service offer don cho nhieu shipper.
- Shipper accept/reject offer nhu gig marketplace.
- Seller payout, seller commission, seller dispute.
- Public shop page nhu san nhieu nguoi ban.

Mo hinh moi chi co cua hang noi bo cua he thong. Cua hang khong phai seller ben thu ba.

## 2. Muc tieu MVP

### 2.1 Muc tieu san pham

Xay dung he thong ban nong san theo chuoi cua hang khu vuc:

- Khach mua hang nhanh theo dia chi.
- San pham va kha nang mua duoc tinh theo cua hang he thong resolve tu dia chi/vi tri khach.
- Ton kho la ton kho cua tung cua hang.
- Don hang moi duoc gan tu dong cho cua hang gan nhat/phu hop nhat co du hang.
- Nhan vien cua hang xu ly don.
- Nhan vien kho soan hang.
- Shipper co dinh cua cua hang giao hang.
- Quan ly cua hang theo doi van hanh cua cua hang.
- Admin theo doi va cau hinh toan chuoi.

### 2.2 Non-goals trong MVP

Khong lam trong MVP:

- Marketplace seller ben thu ba.
- Nhieu shipper dau gia/nhan offer cho mot don.
- Dieu phoi shipper phuc tap.
- Multi-store cart.
- Tach don thanh nhieu store.
- Seller payout.
- Commission theo seller.
- Mo shop public cho doi tac ngoai.
- Loyalty phuc tap.
- ERP procurement phuc tap.
- Multi-warehouse trung tam.
- Route optimization nhieu don cho shipper.
- Phan ca nhan vien phuc tap.

Co the de sau MVP:

- Backup shipper neu shipper chinh vang.
- Gom nhieu don theo tuyen giao.
- Chuyen don giua cua hang khi het hang.
- Dieu phoi lien khu vuc.
- Quan ly mua hang/nhap hang tu nha cung cap.
- Loyalty/diem thuong.

## 3. Tu dien thuat ngu

| Thuat ngu | Dinh nghia |
| --- | --- |
| Store / Branch / Cua hang | Diem ban noi bo cua he thong phu trach mot khu vuc |
| Service area | Khu vuc cua hang phuc vu, co the la tinh/thanh, quan/huyen, phuong/xa, ban kinh hoac polygon |
| Store Manager | Quan ly cua hang, chiu trach nhiem nhan su, don hang, ton kho, bao cao |
| Store Staff | Nhan vien cua hang, xac nhan va xu ly don |
| Warehouse Staff | Nhan vien kho tai cua hang, soan hang, dong goi, cap nhat ton |
| Store Shipper | Shipper chinh cua cua hang, nhan don tu dong |
| Store Inventory | Ton kho cua mot variant tai mot cua hang |
| Assigned Store | Cua hang duoc he thong gan cho don hang |
| Delivery | Phien giao hang cua don, gan voi shipper cua cua hang |

## 4. Role moi

### 4.1 Customer

Nguoi mua hang.

Quyen:

- Dang ky/dang nhap.
- Nhap dia chi giao hang.
- Cho phep trinh duyet lay GPS neu muon.
- Xem san pham theo cua hang he thong tu resolve tu dia chi/vi tri.
- Tim kiem/loc san pham.
- Them gio hang.
- Checkout.
- Thanh toan COD/VNPay.
- Theo doi don va trang thai giao hang.
- Huy don khi don chua duoc soan/giao.
- Danh gia san pham/don hang sau khi giao.
- Tao ticket ho tro neu can.

Khong duoc:

- Chon san pham tu nhieu cua hang trong cung mot gio MVP.
- Tu chon cua hang/khu vuc thu cong de ep fulfillment, tru khi Admin/Store Manager thao tac ngoai le.
- Xem dashboard noi bo.
- Xem ton kho noi bo ngoai so luong co the ban.

### 4.2 Store Manager

Quan ly cua hang. Moi cua hang MVP co mot quan ly chinh.

Quyen:

- Xem dashboard cua cua hang minh.
- Xem don cua cua hang minh.
- Phan cong nhan vien xu ly neu can.
- Xem va dieu chinh ton kho cua cua hang.
- Quan ly nhan vien cua cua hang.
- Xem shipper cua cua hang.
- Cap nhat trang thai cua hang: dang hoat dong, tam dung nhan don.
- Xu ly ngoai le don: huy, giao that bai, het hang.
- Xem bao cao doanh thu cua cua hang.

Khong duoc:

- Xem don cua cua hang khac.
- Sua gia toan he thong neu khong duoc admin cap quyen.
- Gan shipper ngoai cua hang trong MVP.
- Tao admin.

### 4.3 Store Staff

Nhan vien ban hang/van hanh cua cua hang.

Quyen:

- Xem don moi cua cua hang.
- Xac nhan don.
- Chuyen don sang soan hang.
- Cap nhat ghi chu noi bo.
- Lien he khach neu can.
- Bao het hang/yeu cau quan ly xu ly.

Khong duoc:

- Xem don cua cua hang khac.
- Sua ton kho truc tiep neu khong co quyen kho.
- Sua gia.
- Quan ly nhan su.
- Tao/xoa cua hang.

### 4.4 Warehouse Staff

Nhan vien kho tai cua hang.

Quyen:

- Xem danh sach don can soan.
- Pick hang theo order item.
- Dong goi don.
- Cap nhat don da dong goi.
- Cap nhat ton kho thuc te theo phieu nhap/xuat/dieu chinh.
- Xem canh bao sap het hang.
- Xem lich su giao dich kho cua cua hang.

Khong duoc:

- Sua don sau khi da giao cho shipper neu khong co quyen quan ly.
- Xem kho cua cua hang khac.
- Sua gia/san pham toan he thong.

### 4.5 Shipper

Shipper chinh cua cua hang. MVP: mot cua hang chi co mot shipper chinh.

Quyen:

- Xem don duoc gan cho minh.
- Xem dia chi lay hang tai cua hang.
- Xem dia chi giao hang.
- Xem so tien COD can thu.
- Cap nhat trang thai giao hang.
- Bao giao that bai kem ly do.
- Xac nhan da thu COD neu co.

Khong duoc:

- Tu do nhan don cua cua hang khac.
- Reject/accept offer nhu marketplace.
- Sua san pham/gia/ton kho.
- Huy don tuy tien.

### 4.6 Admin

Quan tri toan he thong.

Quyen:

- Quan ly tat ca cua hang.
- Cau hinh service area cua tung cua hang.
- Tao/khoa quan ly, nhan vien, nhan vien kho, shipper.
- Gan quan ly cho cua hang.
- Gan shipper chinh cho cua hang.
- Quan ly danh muc va san pham.
- Quan ly gia/chinh sach khuyen mai.
- Xem tat ca don.
- Xu ly ngoai le lien cua hang.
- Xem bao cao toan chuoi.

### 4.7 Super Admin

Quyen cao nhat:

- Tat ca quyen admin.
- Quan ly admin.
- Cau hinh bao mat/thanh toan.
- Thao tac nhay cam: refund bat buoc, khoa tai khoan, sua du lieu he thong.
- Xem audit log.

### 4.8 Support

Support co the giu nhung khong bat buoc trong MVP.

Phuong an khuyen nghi:

- MVP: Admin/Store Manager xu ly ticket co ban.
- Sau MVP: tach role Support rieng.

Neu giu Support:

- Xem ticket.
- Xem don lien quan ticket.
- Reply khach.
- Escalate cho Store Manager/Admin.
- Khong duoc sua gia/ton/hoan tien truc tiep.

## 5. Mo hinh kinh doanh moi

### 5.1 Store la trung tam

Cua hang la don vi van hanh chinh.

Moi store can co:

- Ten cua hang.
- Ma cua hang.
- Dia chi.
- Toa do lat/lng.
- Tinh/thanh.
- Quan/huyen.
- Phuong/xa.
- Trang thai: `ACTIVE`, `PAUSED`, `CLOSED`, `SUSPENDED`.
- Gio mo cua.
- So dien thoai.
- Quan ly chinh.
- Shipper chinh.
- Danh sach nhan vien.
- Danh sach nhan vien kho.
- Service areas.
- Kho hang cua store.

### 5.2 Khu vuc phuc vu

Moi store phuc vu mot hoac nhieu khu vuc.

MVP co hai cach cau hinh, uu tien cach don gian:

1. Theo dia gioi hanh chinh:
   - province
   - district
   - ward

2. Theo ban kinh:
   - store lat/lng
   - serviceRadiusKm

Khuyen nghi MVP:

- Luu province/district/ward de matching nhanh.
- Luu lat/lng va radius de tinh store gan nhat.
- Neu nhieu store match cung mot dia chi, xep hang theo do gan va do phu hop.
- Store duoc gan cuoi cung van phai du hang cho nhu cau hien tai cua khach.
- Neu mot ward/district chi duoc phuc vu boi mot store, dat unique constraint trong DB.

### 5.3 San pham va ton kho

San pham la cua he thong, khong thuoc seller.

Product:

- Ten.
- Slug.
- Danh muc.
- Mo ta.
- Anh.
- Trang thai.
- Don vi mac dinh.
- Gia niem yet mac dinh.
- Thuoc tinh: xuat xu, bao quan, han su dung, chung nhan.

Variant:

- SKU.
- Don vi: kg, gram, bo, tui, hop, thung.
- Gia mac dinh.

StoreInventory:

- storeId.
- variantId.
- quantityOnHand.
- reservedQuantity.
- lowStockThreshold.
- status.

StoreProduct optional:

- storeId.
- productId.
- status cua san pham tai store.
- priceOverride.
- salePrice.

Quy tac:

- Khach chi thay san pham dang `ACTIVE` va con ton kha dung tai store duoc gan.
- Ton kha dung = quantityOnHand - reservedQuantity.
- Khi checkout thanh cong, he thong reserve ton.
- Khi store huy/het hang, release reserved.
- Khi don delivered/completed, commit ton.

## 6. Luong gan cua hang tu dong

### 6.0 Nguyen tac UX: khong bat khach chon khu vuc

Customer UI khong hien dropdown bat khach chon khu vuc/cua hang nhu form hanh chinh.

Dung:

- Lay dia chi mac dinh cua user neu da dang nhap.
- Neu chua co dia chi, co the xin GPS trinh duyet.
- Neu GPS bi tu choi/loi, cho customer nhap dia chi giao hang.
- He thong tu tinh cua hang phu hop nhat dua tren dia chi/lat/lng.
- UI chi hien ket qua: "Don hang se duoc xu ly boi cua hang gan nhat co du hang".

Khong dung:

- Khong bat customer tu chon "khu vuc".
- Khong bat customer tu chon "store".
- Khong lay storeId tu client lam source of truth khi checkout.
- Khong chan customer chi vi cua hang gan nhat thieu hang neu con cua hang gan tiep theo co du hang va van nam trong vung phuc vu.

Ly do:

- Mo hinh giong Bach Hoa Xanh: khach mua theo dia chi, he thong tu quyet dinh cua hang fulfillment.
- Khach khong can hieu noi bo store/khu vuc.
- Store assignment phai dua tren distance, service area, ton kho, trang thai store va shipper.

### 6.1 Thoi diem gan store

He thong nen gan store o 3 thoi diem:

1. Khi app co du vi tri/dia chi tam tinh:
   - user da dang nhap co dia chi mac dinh
   - hoac GPS thanh cong
   - hoac customer nhap dia chi thu cong
2. Khi xem cart/checkout de bao dam store van phu hop voi cac item hien tai.
3. Khi tao order, phai resolve lai va gan store chinh thuc trong transaction.

### 6.2 Dau vao

Can co:

- Dia chi giao hang.
- Lat/lng cua dia chi.
- Province/district/ward neu co.
- Danh sach item trong cart.
- So luong moi item.
- Trang thai store.
- Service area cua store.
- Ton kho cua store.
- Shipper chinh cua store.

### 6.3 Thuat toan gan store

Pseudo flow:

```text
resolveStoreForOrder(address, cartItems):
  1. Validate address co lat/lng hoac it nhat province/district/ward.
  2. Lay cac store ACTIVE/PAUSED?:
     - MVP chi lay ACTIVE.
  3. Loc store co service area match dia chi:
     - ward match uu tien cao nhat
     - district match tiep theo
     - province match sau cung
     - neu dung radius: distance(store, address) <= serviceRadiusKm
  4. Loc store co primaryShipper ACTIVE.
  5. Tinh distanceKm tu store den address.
  6. Sap xep candidate theo:
     - service area specificity cao hon
     - distanceKm thap hon
     - load hien tai thap hon neu can
  7. Duyet tung store theo thu tu gan nhat:
     - Kiem tra ton kho cua tat ca cartItems tai store do
     - available = quantityOnHand - reservedQuantity
     - Neu du hang tat ca item -> chon store nay va dung
     - Neu thieu hang -> ghi vao rejectionReasons roi thu store tiep theo
  8. Gan:
     - order.storeId = autoAssignedStore.id
     - order.assignedStoreId = autoAssignedStore.id
     - order.shipperId = autoAssignedStore.primaryShipperId
     - order.assignmentDistanceKm = autoAssignedStore.distanceKm
     - order.assignmentReason = "NEAREST_STORE_WITH_FULL_STOCK"
     - order.assignmentCandidates = danh sach store da xet + ly do bi bo qua neu can audit
```

### 6.3.1 Fallback khi cua hang gan nhat thieu hang

Rule bat buoc:

```text
Nearest store is not always the fulfillment store.
Auto assigned store = nearest serviceable active store that can fulfill every item in the order.
```

Vi du:

```text
Customer o Quan 7, cart co: Rau cai x2, Tao x1

Store A Quan 7:
- distance 1.2 km
- serviceable yes
- Rau cai du
- Tao het hang
=> bo qua vi INSUFFICIENT_STOCK

Store B Nha Be:
- distance 3.8 km
- serviceable yes
- Rau cai du
- Tao du
=> chon Store B
```

Neu khong store nao co du tat ca item:

- Checkout bi chan.
- UI hien danh sach item thieu va cua hang gan nhat co ton tung item neu co.
- Goi y:
  - giam so luong
  - xoa item het hang
  - doi dia chi giao hang neu customer muon giao den noi khac
- MVP khong tach don thanh nhieu store.

### 6.3.2 Resolver theo tung ngu canh

Store resolver can ho tro 3 ngu canh khac nhau:

```text
Browsing without cart:
  autoAssignedStore = nearest active serviceable store
  purpose = show nearby store catalog/inventory

Product detail / add one item:
  autoAssignedStore = nearest active serviceable store that has requested variant quantity
  purpose = avoid showing "het hang" if nearby next store can fulfill that item

Cart / checkout / order:
  autoAssignedStore = nearest active serviceable store that can fulfill every cart item
  purpose = one order, one store, full fulfillment
```

Khong duoc de customer tu chon store, nhung UI co the giai thich:

```text
Cua hang gan nhat hien thieu mot so san pham.
He thong se xu ly don tu cua hang gan tiep theo co du hang.
```

### 6.4 Truong hop khong tim duoc store

Neu khong co store nao:

- Storefront: hien thong bao "Khu vuc nay chua ho tro giao hang".
- Product list: khong hien san pham mua duoc.
- Checkout: chan dat hang.

Neu co store nhung khong du ton:

- Khong dung ngay o store gan nhat.
- He thong phai tiep tuc thu cac store serviceable gan tiep theo.
- Chi bao loi khi khong co store nao du ton cho toan bo cart.
- UI hien item nao khong fulfill duoc va goi y giam so luong/xoa item.
- MVP khong tach don sang nhieu store.

Neu co store nhung chua co shipper:

- MVP nen xem la store tam thoi khong nhan giao hang.
- Admin/Store Manager can gan shipper chinh.

Neu store dong cua:

- Khach co the dat lich sau neu co feature.
- MVP: chan checkout hoac hien ETA ngay lam viec tiep theo.

## 7. Don hang moi

### 7.1 Order lifecycle

Trang thai order moi:

```text
PENDING_PAYMENT      Cho thanh toan online neu dung VNPay
PLACED               Don da tao thanh cong
STORE_CONFIRMED      Cua hang da xac nhan
PICKING              Nhan vien kho dang soan hang
PACKED               Da dong goi
READY_FOR_DELIVERY   San sang giao cho shipper
OUT_FOR_DELIVERY     Shipper dang giao
DELIVERED            Da giao thanh cong
COMPLETED            Hoan tat sau khi thanh toan/doi soat
CANCELLED            Da huy
DELIVERY_FAILED      Giao that bai
RETURN_REQUESTED     Khach yeu cau tra hang
RETURNED             Da tra hang
```

### 7.2 Delivery lifecycle

MVP khong can offer.

```text
ASSIGNED             Tu dong gan cho shipper cua store
PICKED_FROM_STORE    Shipper da lay hang tu cua hang
OUT_FOR_DELIVERY     Dang giao
ARRIVED_AT_CUSTOMER  Da den noi giao
DELIVERED            Giao thanh cong
FAILED               Giao that bai
```

### 7.3 Flow chi tiet

```text
Customer checkout
  -> System resolve nearest serviceable store
  -> System reserve inventory at that store
  -> System create Order(storeId, shipperId)
  -> Store Staff sees new order
  -> Store Staff confirms order
  -> Warehouse Staff starts picking
  -> Warehouse Staff marks packed
  -> Store Staff/Manager marks ready for delivery
  -> Delivery automatically assigned to store shipper
  -> Shipper picks from store
  -> Shipper delivers
  -> System completes order
```

### 7.4 Ai duoc lam gi tren don

| Hanh dong | Customer | Store Staff | Warehouse Staff | Store Manager | Shipper | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Tao don | Co | Khong | Khong | Khong | Khong | Co ho tro |
| Xac nhan don | Khong | Co | Khong | Co | Khong | Co |
| Soan hang | Khong | Co neu duoc cap quyen | Co | Co | Khong | Co |
| Dong goi | Khong | Co neu duoc cap quyen | Co | Co | Khong | Co |
| Giao hang | Khong | Khong | Khong | Khong | Co | Khong |
| Huy don | Co truoc khi picking | Co voi ly do | Khong | Co | Khong | Co |
| Giao that bai | Khong | Khong | Khong | Co xu ly | Co bao ly do | Co |
| Hoan tien | Khong | Khong | Khong | De xuat | Khong | Co |

## 8. Data model de xuat

### 8.1 User va role

```text
User
- id
- email
- phone
- passwordHash
- status
- createdAt
- updatedAt

UserProfile
- userId
- fullName
- avatarUrl

Role
- CUSTOMER
- ADMIN
- SUPER_ADMIN
- STORE_MANAGER
- STORE_STAFF
- WAREHOUSE_STAFF
- SHIPPER
- SUPPORT optional
```

### 8.2 Store

```text
Store
- id
- code unique
- name
- slug unique
- status enum ACTIVE | PAUSED | CLOSED | SUSPENDED
- phone
- email
- addressLine
- formattedAddress
- province
- district
- ward
- lat
- lng
- serviceRadiusKm
- openTime
- closeTime
- managerId nullable User
- primaryShipperId nullable User
- createdAt
- updatedAt
```

Rules:

- `managerId` phai tro den user co role `STORE_MANAGER`.
- `primaryShipperId` phai tro den user co role `SHIPPER`.
- MVP: mot store co toi da mot manager active.
- MVP: mot store co toi da mot primary shipper active.

### 8.3 Store staff membership

```text
StoreStaff
- id
- storeId
- userId
- role enum STORE_MANAGER | STORE_STAFF | WAREHOUSE_STAFF | SHIPPER
- status enum ACTIVE | INACTIVE | SUSPENDED
- joinedAt
- leftAt nullable
```

Rules:

- Mot user co the thuoc nhieu store o tuong lai, nhung MVP nen gioi han mot active store de don gian.
- Store Manager chi thao tac trong storeId cua minh.
- Warehouse Staff chi thao tac inventory cua storeId cua minh.
- Shipper chi xem delivery co shipperId cua minh.

### 8.4 Service area

```text
StoreServiceArea
- id
- storeId
- province
- district nullable
- ward nullable
- polygonJson nullable
- radiusKm nullable
- priority int default 0
- status enum ACTIVE | INACTIVE
```

Rules:

- Neu ward duoc gan cho mot store ACTIVE, khong nen gan ward do cho store khac trong MVP.
- Neu service area overlap, dung distance de xep hang candidate.
- Store gan nhat chi duoc gan neu co du hang cho nhu cau hien tai.

### 8.5 Product

```text
Category
- id
- name
- slug
- parentId nullable
- status

Product
- id
- name
- slug
- categoryId
- description
- imageUrl
- status enum DRAFT | ACTIVE | INACTIVE
- originRegion
- storageInstruction
- shelfLifeDays nullable
- createdAt
- updatedAt

ProductVariant
- id
- productId
- sku unique
- unit
- unitValue
- basePrice
- compareAtPrice nullable
- barcode nullable
- status enum ACTIVE | INACTIVE
```

### 8.6 Store inventory

```text
StoreInventory
- id
- storeId
- variantId
- quantityOnHand
- reservedQuantity
- lowStockThreshold
- status enum ACTIVE | INACTIVE | OUT_OF_STOCK
- updatedAt

InventoryTransaction
- id
- storeId
- variantId
- type enum IMPORT | EXPORT | RESERVE | RELEASE | COMMIT | ADJUST
- quantity
- beforeQty
- afterQty
- reason
- orderId nullable
- createdBy userId
- createdAt
```

Rules:

- Moi cap `(storeId, variantId)` la unique.
- Khong cho quantityOnHand am.
- Khong cho reservedQuantity > quantityOnHand.
- Moi thay doi ton phai co transaction log.

### 8.7 Cart

```text
Cart
- id
- userId nullable
- sessionId nullable
- storeId nullable
- createdAt
- updatedAt

CartItem
- id
- cartId
- variantId
- quantity
- unitPriceSnapshot
- createdAt
- updatedAt
```

Rules:

- Cart MVP chi co mot storeId.
- Khi customer doi dia chi va store thay doi, he thong phai validate lai cart:
  - item con ban tai store moi khong
  - ton kho co du khong
  - gia co thay doi khong
- Neu khong hop le, UI phai yeu cau cap nhat gio.

### 8.8 Order

```text
Order
- id
- orderNumber unique
- userId
- storeId
- shipperId nullable
- status
- paymentMethod enum COD | VNPAY
- paymentStatus enum PENDING | SUCCESS | FAILED | REFUNDED
- subtotal
- discountTotal
- shippingFee
- grandTotal
- recipientName
- recipientPhone
- deliveryAddress
- deliveryLat
- deliveryLng
- assignmentDistanceKm nullable
- assignmentReason
- note nullable
- createdAt
- updatedAt

OrderItem
- id
- orderId
- productId
- variantId
- productNameSnapshot
- skuSnapshot
- unitSnapshot
- unitPrice
- quantity
- lineTotal

OrderStatusHistory
- id
- orderId
- fromStatus nullable
- toStatus
- reason nullable
- actorId nullable
- createdAt
```

### 8.9 Delivery

```text
Delivery
- id
- orderId unique
- storeId
- shipperId
- status
- pickupAddress
- dropoffAddress
- distanceKm nullable
- codAmount nullable
- failureReason nullable
- pickedAt nullable
- deliveredAt nullable
- createdAt
- updatedAt

DeliveryEvent
- id
- deliveryId
- status
- note nullable
- actorId
- createdAt
```

### 8.10 Promotion

MVP nen don gian:

```text
Promotion
- id
- code
- name
- type enum PERCENT | FIXED | FREESHIP
- scope enum PLATFORM | STORE
- storeId nullable
- value
- minOrderValue
- usageLimit
- usageCount
- startsAt
- endsAt
- status
```

Khong can voucher seller.

## 9. API de xuat

### 9.1 Customer APIs

```text
POST /stores/resolve
body: { addressId? | lat,lng,province,district,ward, cartItems? }
return: autoAssignedStore, candidates, rejectedCandidates, reason, serviceable, inventoryWarnings

GET /stores/current
return current resolved fulfillment store from default address/GPS/manual address context

GET /products?storeId=&q=&categoryId=&sort=
return products available at store

GET /products/:slug?storeId=
return product detail + store inventory availability

GET /cart
POST /cart/items
PATCH /cart/items/:id
DELETE /cart/items/:id
POST /cart/revalidate

POST /cart/checkout/quote
body: { addressId, paymentMethod, couponCode? }
return autoAssignedStore, candidateStores, distance, shippingFee, inventoryWarnings, total

POST /orders
GET /orders
GET /orders/:id
POST /orders/:id/cancel
POST /orders/:id/reviews
```

### 9.2 Store Manager APIs

```text
GET /store-manager/dashboard
GET /store-manager/store
PATCH /store-manager/store/status
GET /store-manager/orders
GET /store-manager/orders/:id
POST /store-manager/orders/:id/confirm
POST /store-manager/orders/:id/cancel
POST /store-manager/orders/:id/ready-for-delivery
GET /store-manager/staff
POST /store-manager/staff
PATCH /store-manager/staff/:id
GET /store-manager/inventory
GET /store-manager/reports
```

### 9.3 Store Staff APIs

```text
GET /store/orders
GET /store/orders/:id
POST /store/orders/:id/confirm
POST /store/orders/:id/start-picking
POST /store/orders/:id/cancel-request
```

### 9.4 Warehouse Staff APIs

```text
GET /warehouse/orders-to-pick
POST /warehouse/orders/:id/start-picking
POST /warehouse/orders/:id/packed
GET /warehouse/inventory
POST /warehouse/inventory/adjust
POST /warehouse/inventory/import
GET /warehouse/inventory/transactions
GET /warehouse/low-stock
```

Luu y: Trong mo hinh moi, warehouse la kho cua store, khong phai kho trung tam.

### 9.5 Shipper APIs

```text
GET /shipper/jobs
GET /shipper/jobs/:id
POST /shipper/jobs/:id/picked-from-store
POST /shipper/jobs/:id/out-for-delivery
POST /shipper/jobs/:id/arrived
POST /shipper/jobs/:id/delivered
POST /shipper/jobs/:id/failed
```

Khong can:

```text
GET /shipper/offers
POST /shipper/offers/:id/accept
POST /shipper/offers/:id/reject
```

### 9.6 Admin APIs

```text
GET /admin/dashboard
GET /admin/stores
POST /admin/stores
GET /admin/stores/:id
PATCH /admin/stores/:id
POST /admin/stores/:id/service-areas
DELETE /admin/stores/:id/service-areas/:areaId
POST /admin/stores/:id/assign-manager
POST /admin/stores/:id/assign-shipper

GET /admin/users
POST /admin/users
PATCH /admin/users/:id/roles

GET /admin/products
POST /admin/products
PATCH /admin/products/:id
GET /admin/inventory?storeId=
PATCH /admin/inventory/:id

GET /admin/orders
GET /admin/orders/:id
POST /admin/orders/:id/reassign-store
POST /admin/orders/:id/refund

GET /admin/reports/revenue
GET /admin/reports/stores
```

## 10. UI/UX moi

### 10.1 Storefront customer

Header:

- Brand.
- O tim kiem.
- Dia chi giao hang hien tai hoac nut "Dung vi tri cua toi".
- Thong bao cua hang du kien phuc vu, vi du: "Du kien giao tu: NongSan Xanh Quan 7".
- Gio hang.
- Dang nhap/don hang/thong bao.

Home:

- Khong bat customer chon khu vuc/cua hang.
- Neu da co dia chi mac dinh/GPS, tu resolve store va hien store du kien.
- Neu chua co vi tri, hien CTA "Nhap dia chi giao hang" hoac "Dung vi tri cua toi".
- Hien danh muc.
- Hien san pham co the mua theo store du kien neu da resolve duoc.
- Neu chua co vi tri, co the hien catalog chung nhung phai ghi ro "Nhap dia chi de kiem tra ton kho va giao hang".
- Hien uu dai cua store.

Product list:

- Loc theo category, gia, tinh trang con hang.
- Neu da co vi tri/dia chi, hien kha nang mua theo store duoc resolve tu dong.
- Neu customer doi dia chi, resolve lai danh sach store candidate va reload products theo store fulfillment moi.
- Khong co dropdown chon store/khu vuc thu cong.

Product detail:

- Hien gia, ton kha dung tai store fulfillment du kien.
- Hien "Du kien xu ly boi cua hang: ...".
- Neu store gan nhat het hang nhung store gan tiep theo co hang, hien store fulfillment thuc te sau khi resolver chon.
- Neu khong store nao co hang, khong cho add cart.

Cart:

- Gan voi mot store duy nhat.
- Neu dia chi doi lam store thay doi, can revalidate cart.
- Khong co multi-shop warning nua.
- Thay bang warning: "Dia chi moi lam he thong doi cua hang fulfillment; vui long kiem tra lai ton kho/gia."
- Neu store gan nhat thieu hang, cart revalidate phai tu thu store gan tiep theo truoc khi bao loi.

Checkout:

- Dia chi giao hang.
- Store duoc he thong gan tu dong.
- Khoang cach.
- Shipper cua store neu can hien noi bo thi khong hien cho customer ten day du, chi hien "Shipper cua cua hang".
- Phi giao hang.
- Payment.
- Summary.
- Khong cho client ep storeId; backend phai resolve lai tu dia chi giao hang cuoi cung.

Order detail:

- Timeline order.
- Timeline delivery.
- Store xu ly don.
- Trang thai shipper giao hang.

### 10.2 Admin UI

Admin dashboard:

- Tong doanh thu.
- So don.
- So cua hang.
- Don dang cho xu ly.
- Don giao that bai.
- Cua hang sap het hang.

Stores:

- Danh sach cua hang.
- Trang thai.
- Khu vuc phuc vu.
- Manager.
- Shipper.
- So don hom nay.
- Doanh thu.

Store detail:

- Thong tin cua hang.
- Service areas.
- Staff.
- Inventory.
- Orders.
- Reports.

Products:

- Quan ly product global.
- Quan ly variant.
- Cau hinh san pham co ban.

Inventory:

- Xem ton theo cua hang.
- Loc sap het hang.
- Dieu chinh ton.

Orders:

- Loc theo store.
- Loc theo status.
- Reassign store cho truong hop ngoai le.

### 10.3 Store Manager UI

Dashboard cua hang:

- Don moi.
- Don dang soan.
- Don san sang giao.
- Don dang giao.
- Doanh thu ngay.
- Ton kho sap het.

Orders:

- Kanban/table theo status:
  - Moi
  - Da xac nhan
  - Dang soan
  - Da dong goi
  - Dang giao
  - Hoan tat

Staff:

- Danh sach nhan vien.
- Role.
- Trang thai.

Inventory:

- Ton kho.
- Sap het hang.
- Lich su dieu chinh.

### 10.4 Warehouse Staff UI

Man hinh chinh:

- Don can soan hang.
- Chi tiet item can lay.
- Button:
  - Bat dau soan
  - Da dong goi
- Canh bao het hang.

Inventory:

- Tim SKU.
- Nhap hang.
- Dieu chinh ton.
- Lich su giao dich kho.

### 10.5 Shipper UI

Mobile-first.

Dashboard:

- Don can giao.
- Don dang giao.
- Lich su giao.

Job card:

- Ma don.
- Lay hang tai cua hang nao.
- Giao den ai.
- Dia chi.
- Sdt.
- COD.
- Button cap nhat:
  - Da lay hang
  - Bat dau giao
  - Da den noi
  - Giao thanh cong
  - Giao that bai

Khong co tab offer/accept/reject trong MVP.

## 11. Bao mat va phan quyen

### 11.1 Ownership checks bat buoc

- Store Manager chi truy cap store cua minh.
- Store Staff chi truy cap order cua store cua minh.
- Warehouse Staff chi truy cap inventory/order cua store cua minh.
- Shipper chi truy cap delivery co shipperId cua minh.
- Customer chi xem order cua minh.
- Admin/Super Admin xem toan he thong.

### 11.2 IDOR can tranh

Khong duoc chi kiem tra role. Moi endpoint co id can check scope:

```text
GET /store-manager/orders/:id
-> order.storeId must equal manager.storeId

POST /warehouse/orders/:id/packed
-> order.storeId must equal warehouseStaff.storeId

POST /shipper/jobs/:id/delivered
-> delivery.shipperId must equal currentUser.id
```

### 11.3 Audit log

Can log:

- Gan store cho order.
- Reassign store.
- Dieu chinh ton kho.
- Huy don.
- Giao that bai.
- Refund.
- Doi manager/shipper cua store.

## 12. Tinh phi ship va ETA

MVP:

- Phi ship tinh tu store.lat/lng den address.lat/lng.
- Neu khong co lat/lng thi dung phi mac dinh theo district/province.
- Mot store co serviceRadiusKm toi da.

Cong thuc don gian:

```text
baseFee = 15000
perKmFee = 4000
shippingFee = baseFee + max(0, distanceKm - 2) * perKmFee
```

ETA:

```text
prepareTime = store default 30-60 phut
travelTime = distanceKm / avgSpeedKmPerMin
eta = prepareTime + travelTime
```

Sau MVP co the dung Google Distance Matrix.

## 13. Nhung module can bo hoac migrate tu code cu

### 13.1 Bo khoi MVP

- Seller registration.
- Seller dashboard theo shop ngoai.
- Seller product approval.
- Seller service areas.
- Seller vouchers.
- Multi-shop cart.
- SellerOrder split.
- Dispatch offer.
- Shipper offer accept/reject.
- Admin seller moderation.
- Supplier payout/commission neu co.

### 13.2 Migrate/doi nghia

| Code/Module cu | Huong moi |
| --- | --- |
| Supplier/Shop | Rename/migrate thanh Store |
| ShopServiceArea | StoreServiceArea |
| SellerInventory | StoreInventory |
| SellerOrder | Bo, Order gan truc tiep storeId hoac doi thanh StoreOrder |
| DispatchService | Bo trong MVP, thay bang DeliveryAssignmentService don gian |
| SellerDashboard | StoreManagerDashboard |
| Warehouse legacy | Doi thanh Store Warehouse, co store scope |
| Shipper offers | Doi thanh Shipper jobs |
| Admin shops | Doi thanh Admin stores |

### 13.3 Co the giu lai

- Auth/JWT.
- Role guard.
- Product/category base.
- Cart base, nhung can storeId.
- Orders base, nhung can store assignment.
- Shipping quote, nhung origin la store.
- Notification.
- Support ticket neu muon.
- Review.
- Payment.

## 14. Implementation phases

### Phase 1: Domain reset

- Tao spec nay la source of truth.
- Doi vocabulary trong code/UI tu seller/shop marketplace sang store/branch.
- Them roles moi:
  - STORE_MANAGER
  - STORE_STAFF
  - WAREHOUSE_STAFF
  - SHIPPER
- Bo role SELLER khoi MVP UI.

### Phase 2: Database migration

- Tao Store.
- Tao StoreStaff.
- Tao StoreServiceArea.
- Tao StoreInventory.
- Them storeId vao Cart, Order, Delivery.
- Them primaryShipperId/managerId cho Store.
- Migrate Supplier hien co thanh Store neu co du lieu.

### Phase 3: Store resolver

- Implement `StoreResolverService`.
- Input dia chi/lat/lng + cart items.
- Output autoAssignedStore + candidates + rejectedCandidates + reason + distance + warnings.
- Resolver phai thu store gan nhat truoc, neu khong du hang thi thu store gan tiep theo.
- Tich hop product list/cart/checkout/order creation.

### Phase 4: Inventory/order flow

- Reserve inventory theo store.
- Order status moi.
- Warehouse pick/pack flow.
- Delivery assigned truc tiep cho shipper cua store.

### Phase 5: UI rewrite

- Customer location/store selector.
- Product list theo store he thong tu resolve; khong co UI bat chon khu vuc/store.
- Cart one-store.
- Checkout one-store.
- Admin stores.
- Store manager dashboard.
- Warehouse staff console.
- Shipper jobs.

### Phase 6: Cleanup

- Remove seller routes.
- Remove dispatch offer routes.
- Remove marketplace terminology.
- Remove multi-shop warning.
- Update seed data.
- Update tests.

## 15. E2E MVP flows can pass

### 15.1 Customer flow

```text
Customer login
-> Add delivery address
-> System calculates nearest fulfillable store automatically
-> Customer browses products available from auto-resolved fulfillment store
-> Add items to cart
-> Checkout
-> System re-runs resolver from final delivery address
-> If nearest store lacks any item, system tries next nearest serviceable store
-> Order created with storeId = autoAssignedStore that has full stock
-> Customer tracks order
```

### 15.2 Store staff flow

```text
Store Staff login
-> Sees new order for their store only
-> Confirms order
-> Moves to picking
```

### 15.3 Warehouse staff flow

```text
Warehouse Staff login
-> Sees orders to pick for their store
-> Opens order
-> Picks items
-> Marks packed
-> Inventory reserved remains until delivery completed
```

### 15.4 Shipper flow

```text
Shipper login
-> Sees assigned jobs for their store
-> Picks order from store
-> Starts delivery
-> Marks delivered
-> COD collected if paymentMethod = COD
```

### 15.5 Store manager flow

```text
Store Manager login
-> Sees dashboard for own store
-> Checks orders, inventory, staff
-> Handles exception order
```

### 15.6 Admin flow

```text
Admin login
-> Creates store
-> Configures service area
-> Assigns manager
-> Assigns primary shipper
-> Adds inventory to store
-> Monitors reports
```

## 16. Acceptance criteria

MVP duoc xem la dung khi:

- Customer khong con mua theo seller/shop marketplace.
- Customer khong bi bat chon khu vuc/cua hang thu cong.
- Customer phai co dia chi/vi tri giao hang truoc khi checkout.
- Product list phu thuoc store he thong tu resolve tu dia chi/vi tri.
- Cart chi thuoc mot store.
- Checkout gan order cho store gan nhat/phu hop nhat co du hang.
- Neu store gan nhat thieu hang, he thong tu thu store gan tiep theo truoc khi bao loi.
- Order co `storeId`.
- Order co `shipperId` lay tu `store.primaryShipperId`.
- Khong con dispatch offer trong flow moi.
- Warehouse Staff co man hinh soan hang theo store.
- Store Manager chi xem du lieu store cua minh.
- Shipper chi xem job cua minh.
- Admin quan ly store/service area/staff/inventory.
- Build frontend/backend pass.
- E2E customer -> store -> warehouse -> shipper -> delivered pass.

## 17. Rui ro va cach xu ly

### 17.1 Store gan nham

Rui ro:

- Dia chi khach khong co toa do.
- Service area cau hinh sai.
- Resolver chon store gan nhat nhung store do thieu hang neu khong co fallback.

Xu ly:

- Bat buoc geocode dia chi khi checkout.
- Luu assignmentReason.
- Luu danh sach candidate va rejectedCandidates de audit vi sao khong chon store gan hon.
- Thu store gan tiep theo neu store gan nhat khong du ton.
- Admin co man hinh reassign store cho ngoai le.

### 17.2 Het hang sau khi customer them gio

Rui ro:

- Customer them gio luc con hang, checkout sau thi het.

Xu ly:

- Revalidate cart truoc checkout.
- Reserve inventory trong transaction tao order.
- Hien item het hang ro rang.
- Neu store hien tai het hang, resolver phai thu store serviceable gan tiep theo co du hang.
- Chi bao loi het hang khi khong co store nao fulfill duoc toan bo cart.

### 17.3 Shipper chinh vang

Rui ro:

- Store co 1 shipper, shipper nghi thi don khong giao.

MVP:

- Store Manager/Admin xu ly thu cong.
- Store status co the tam dung giao hang.

Sau MVP:

- Backup shipper.
- Shipper pool theo khu vuc.

### 17.4 Overlap service area

Rui ro:

- Hai store cung phuc vu mot dia chi.

Xu ly:

- MVP uu tien unique ward/district.
- Neu overlap, xep candidate theo distance.
- Neu store gan nhat thieu hang, thu store gan tiep theo.
- Log autoAssignedStore, distance, candidates va rejectedCandidates.

## 18. Prompt trien khai cho AI/coding agent

Dung prompt nay khi bat dau sua code:

```text
Doc file BACH_HOA_XANH_STORE_MVP_SPEC.md va xem day la source of truth moi.
Migrate he thong tu marketplace seller sang store-chain theo khu vuc.
Khong con seller doc lap, khong con multi-shop cart, khong con dispatch offers.
Moi order phai gan store gan nhat/phu hop nhat co du hang theo dia chi customer.
Khong bat customer chon khu vuc/store thu cong; UI chi thu dia chi/GPS va hien store he thong tu tinh.
Neu store gan nhat khong du hang, resolver phai thu store gan tiep theo truoc khi bao loi.
Moi store co mot manager, nhieu staff, warehouse staff, va mot primary shipper.
Shipper cua store duoc gan delivery truc tiep, khong accept/reject offer.
Thuc hien theo phase: schema -> roles -> store resolver -> inventory/order -> UI -> cleanup -> tests.
Build va verify E2E truoc khi ket luan.
```
