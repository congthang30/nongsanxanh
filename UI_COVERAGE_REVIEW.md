# UI Coverage Review — NongSan Xanh Chain-Store + POS

> [!NOTE]
> Source of truth: `BACH_HOA_XANH_STORE_MVP_SPEC.md` + `STORE_POS_CHECKOUT_SPEC.md`. Review thực hiện sau đợt refactor "store-less catalog + nearest-store resolver" gần nhất. Không sửa code trong lúc review, chỉ ghi nhận bằng chứng.

## UI Coverage Verdict

| Surface | Verdict | Lý do tóm tắt |
|---|---|---|
| **Overall** | ⚠️ **Partial Pass** | Core flow chạy được, nhưng còn ~3 P0 + nhiều P1 lệch spec |
| Customer | ⚠️ Partial | Catalog + cart + checkout đã store-less + nearest-store. Thiếu hiển thị "Cửa hàng phục vụ" ở order detail vẫn OK. Còn 1 wording cũ "Khu vực không phục vụ" mâu thuẫn với mô hình mới. |
| Store Manager | ⚠️ Partial | Có dashboard/orders/inventory/staff/reports, nhưng thiếu **assign warehouse staff**, thiếu **xem shipper chính**, thiếu **xử lý ngoại lệ đơn**. |
| Store Staff | ✅ Pass | Có scope theo store, có confirm/picking/cancel với reason. |
| Warehouse Staff | ⚠️ Partial | Có pick/pack/inventory/import/adjust, nhưng **thiếu trang xuất kho riêng** + **thiếu lịch sử inventory transaction** + **thiếu cảnh báo low-stock realtime** ngoài dashboard SM. |
| Shipper | ✅ Pass | Đã bỏ offer/accept/reject, dùng assigned-job model, có pickup → out-for-delivery → arrived → delivered/failed + COD. |
| Admin | ⚠️ Partial | Có stores/orders/products/inventory/users/reports/audit, **nhưng thiếu UI quản lý barcode** (P0 với POS), service-area UI bị **lạc hậu** (resolver không còn dùng), users không filter được theo store. |
| POS | ⚠️ Partial | Đã đầy đủ scan/search/cân ký/payment/shift/void/receipt, **nhưng thiếu UI return/refund từ POS** dù backend đã có service. |
| Legacy cleanup | ⚠️ Partial | Routes/seller đã redirect, nhưng **3 wording sót**: `Topbar humanize` còn map "seller/shops/dispatch/offers/vouchers". |

---

## Findings

### P0 — Blockers MVP

#### F-01 · POS thiếu UI quản lý barcode
- **File**: chưa tồn tại. Backend đã có `AdminPOSController` + `BarcodeService`.
- **UI surface**: Admin / Store Manager.
- **Mô tả**: Spec POS yêu cầu *"mỗi sản phẩm/variant phải hỗ trợ barcode"*. Hiện chỉ seed barcode bằng tay; admin không có form gán/sửa barcode cho variant. Không có barcode → POS scan không lookup được.
- **Ảnh hưởng**: thực tế blocker — sản phẩm mới tạo qua [AdminProductsPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminProductsPage.tsx#L66-L75) **không có bước nhập barcode** → POS không bán được.
- **Fix**: thêm cột "Barcode" + nút "Gán mã" trên `AdminProductsPage`, mở modal POST `/admin/pos/barcodes`. Tối thiểu cho mỗi variant 1 barcode primary.
- **Test**: smoke test "tạo product → gán barcode → POS scan tìm được".

#### F-02 · POS thiếu UI return/refund
- **File**: backend đã có `pos-return.service.ts` + endpoints `/pos/returns` + `/pos/returns/:id/approve|complete`. Frontend không có tab/menu/button.
- **UI surface**: POS Manager menu, [POSTerminalPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L514-L544).
- **Mô tả**: Spec mục 2.1 yêu cầu *"hoàn hàng/trả hàng có quyền quản lý"*. POSTerminalPage có nút "Hủy đơn" (void trước thanh toán) nhưng **không có flow return sau thanh toán**.
- **Ảnh hưởng**: Khách trả hàng tại quầy không xử lý được trên hệ thống.
- **Fix**: thêm route `/pos/returns` cho Store Manager, list các sale `PAID` → chọn item → tạo return request, manager approve & complete. Auto restock theo `restockable=true`.
- **Test**: smoke "PAID sale → request return → approve → complete → tồn store tăng đúng".

#### F-03 · Admin Service Areas UI vẫn còn nhưng resolver đã bỏ
- **File**: [AdminStoresPage.tsx#L209-L225](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminStoresPage.tsx#L209-L225).
- **UI surface**: Admin → Cửa hàng → Modal chi tiết.
- **Mô tả**: Sau refactor, [store-resolver.service.ts#L62-L70](file:///home/congthang/Desktop/TMDT/backend/src/modules/store/store-resolver.service.ts#L62-L70) đã **bỏ gating theo serviceArea**. UI vẫn cho admin thêm/xóa khu vực phục vụ → admin tưởng có tác dụng nhưng thực ra không.
- **Ảnh hưởng**: lệch model thực tế, gây nhầm lẫn cho ops; nếu giữ phải dùng làm "vùng ưu tiên" hoặc xóa hẳn.
- **Fix**: 1 trong 2 hướng:
  - (a) **Xóa** section "Khu vuc phuc vu" + cột `serviceAreaCount` khỏi `AdminStoresPage`.
  - (b) **Đổi mục đích**: dùng làm "Vùng ưu tiên / vùng cấm" để override resolver (cần backend hỗ trợ).
- Ưu tiên (a) cho MVP.
- **Test**: snapshot AdminStoresPage không còn từ "khu vuc phuc vu".

---

### P1 — MVP gaps

#### F-04 · CheckoutPage còn nhánh "Khu vực không phục vụ"
- **File**: [CheckoutPage.tsx#L271-L290](file:///home/congthang/Desktop/TMDT/frontend/src/pages/CheckoutPage.tsx#L271-L290).
- **Mô tả**: Sau khi resolver bỏ gating, không bao giờ trả `serviceable=false` trừ khi không có store ACTIVE nào. Banner "Khu vực này chưa được cửa hàng nào phục vụ" gây hiểu nhầm vì resolver giờ luôn chọn store gần nhất.
- **Fix**: Đổi text thành "Hiện chưa có cửa hàng đang hoạt động" và chỉ hiển thị khi `candidates.length === 0`. Hoặc gắn cứng theo `reason === 'NO_ACTIVE_STORE'`.
- **Test**: e2e xác nhận không bao giờ thấy banner này khi có ≥1 store ACTIVE + có shipper.

#### F-05 · Store Manager thiếu hiển thị Shipper chính
- **File**: [StoreManagerDashboard.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/StoreManagerDashboard.tsx).
- **Mô tả**: Spec mục 6.4 có `primaryShipperId` per store. Manager phải biết shipper chính của mình là ai để theo dõi giao hàng. Dashboard hiện chỉ hiển thị name + counts.
- **Fix**: thêm card "Shipper chính" trong dashboard, lấy từ `/store-manager/dashboard.store.primaryShipper`.
- **Test**: dashboard hiển thị đúng tên shipper khi đã gán; "Chưa có" khi `null`.

#### F-06 · Store Manager không có "Xử lý ngoại lệ đơn" (escalation)
- **File**: [StoreManagerOrders.tsx#L46-L55](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/StoreManagerOrders.tsx#L46-L55).
- **Mô tả**: Spec mục 4.4: SM có quyền *"điều phối đặc biệt khi shipper báo lỗi/khách bom hàng"*. UI chỉ có Confirm/Ready/Cancel. Khi shipper báo `DELIVERY_FAILED`, manager không có nút reassign hoặc force-cancel với restock.
- **Fix**: thêm action "Giao lại" + "Hủy đơn (hoàn kho)" cho status `DELIVERY_FAILED` / `RETURN_TO_STORE`.
- **Test**: chuỗi "ASSIGNED → FAILED → manager Giao lại → ASSIGNED again" chạy được.

#### F-07 · Warehouse thiếu trang lịch sử inventory transaction
- **File**: chưa tồn tại; backend đã có `InventoryTransaction` table.
- **Mô tả**: Spec mục 5.5 yêu cầu *"mọi thay đổi tồn ghi InventoryTransaction"*. Warehouse staff không xem được lịch sử nhập/xuất/điều chỉnh để đối soát.
- **Fix**: thêm route `/warehouse/transactions` list theo store + filter theo type/date.
- **Test**: import 10 → adjust → list có 2 record đúng `type` & `quantity`.

#### F-08 · Warehouse không có "xuất kho" riêng (chỉ có nhập + kiểm kê)
- **File**: [WarehouseInventory.tsx#L49-L57](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/WarehouseInventory.tsx#L49-L57).
- **Mô tả**: Hiện 2 nút "Nhập" + "Kiểm kê". Spec MVP có 3: nhập / xuất (chuyển đi / hủy hỏng) / điều chỉnh. Hủy hỏng đang phải làm bằng "Kiểm kê" (sai semantics, audit không rõ).
- **Fix**: thêm nút "Xuất / hủy hỏng" gọi endpoint mới hoặc reuse adjust với `reason` bắt buộc + type=`LOSS`.
- **Test**: tạo transaction `LOSS` ghi đúng reason.

#### F-09 · Customer cart thiếu cảnh báo "đổi địa chỉ → đổi store"
- **File**: [CartPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/CartPage.tsx).
- **Mô tả**: Mô hình mới: cart store-less. Khi vào checkout chọn địa chỉ mới, store thay đổi → giá/tồn có thể đổi. Hiện không có hint cho user. Nếu một item tăng giá khi resolve sang store xa hơn, tổng tiền nhảy mà không giải thích.
- **Fix**: trong [CheckoutPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/CheckoutPage.tsx), khi `quote.subtotal !== cart.subtotal`, hiển thị note nhỏ "Giá đã cập nhật theo cửa hàng phục vụ {storeName}".
- **Test**: thay đổi address giữa 2 store khác giá → UI hiển thị note.

#### F-10 · Admin Users không filter được theo store
- **File**: [AdminUsersPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminUsersPage.tsx).
- **Mô tả**: Spec mục 4.1 yêu cầu admin quản lý staff per-store. Hiện list users phẳng + filter theo role, không filter theo `storeId`.
- **Fix**: thêm filter `?storeId=` + cột "Cửa hàng" hiển thị tên store của staff.
- **Test**: filter theo store ra đúng số staff đã assign.

#### F-11 · Order Detail thiếu hiển thị "Khoảng cách" + "Phí ship breakdown"
- **File**: [OrderDetailPage.tsx#L173-L187](file:///home/congthang/Desktop/TMDT/frontend/src/pages/OrderDetailPage.tsx#L173-L187).
- **Mô tả**: Đã có store name + province nhưng không show distanceKm hoặc fee breakdown. Spec mục 7.5 có `assignmentDistanceKm` để khách hiểu phí ship.
- **Fix**: render distance + breakdown nếu API trả về.
- **Test**: order ở Gia Lai hiển thị "Cách 485 km · phí 1.955.000đ".

---

### P2 — UX polish

#### F-12 · POS không có "khóa ca" (lock screen) khi cashier rời máy
- **File**: [POSTerminalPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx).
- Spec không bắt buộc trong MVP nhưng nâng cao bảo mật. Skip nếu hết time.

#### F-13 · ProductDetail không hiển thị "còn hàng tại N khu vực"
- **File**: [ProductDetailPage.tsx#L150-L154](file:///home/congthang/Desktop/TMDT/frontend/src/pages/ProductDetailPage.tsx#L150-L154).
- Backend đã trả `storeCoverage` per variant. UI chỉ dùng `available > 0` để show in/out.
- **Fix**: nếu `inStock`, thêm dòng phụ "Có sẵn tại {coverage} cửa hàng".

#### F-14 · Topbar legacy humanize map còn chứa wording cũ
- **File**: [Topbar.tsx#L112-L142](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/layout/Topbar.tsx#L112-L142).
- Map có `seller`, `shops`, `dispatch`, `offers`, `vouchers` — không bao giờ render do route đã xóa, nhưng để lại gây hiểu nhầm khi dev mới đọc.
- **Fix**: xóa entries `seller`, `shops`, `dispatch`, `offers`. Keep `vouchers` nếu vẫn còn admin voucher; không thấy route nên cũng xóa.

#### F-15 · ShipperConsole dùng `window.prompt` / `window.confirm` cho COD
- **File**: [ShipperConsolePage.tsx#L46-L54](file:///home/congthang/Desktop/TMDT/frontend/src/pages/shipper/ShipperConsolePage.tsx#L46-L54).
- Dùng prompt/confirm trên mobile rất xấu, không có aria.
- **Fix**: thay bằng modal có textarea cho `failureReason` + checkbox `codCollected` + nút "Xác nhận".

#### F-16 · Shipper UI không có chỉ đường (mở Google Maps)
- **File**: [ShipperConsolePage.tsx#L75-L82](file:///home/congthang/Desktop/TMDT/frontend/src/pages/shipper/ShipperConsolePage.tsx#L75-L82).
- Có địa chỉ nhưng không link mở map app. Mobile-first phải có 1 tap → mở.
- **Fix**: thêm icon "🗺️" link `https://www.google.com/maps/dir/?api=1&destination={lat,lng}`.

#### F-17 · POS không có xác nhận khi xóa item
- **File**: [POSTerminalPage.tsx#L404-L411](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L404-L411).
- Click ✕ là xóa luôn. Khi quét nhầm có thể OK, nhưng item lớn (vài trăm nghìn) nên confirm.
- **Fix**: confirm khi `lineTotal > 100k` hoặc `quantity > 5`.

#### F-18 · WarehousePick item-checkbox không lưu state
- **File**: [WarehousePick.tsx#L46-L50](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/WarehousePick.tsx#L46-L50).
- Checkbox không bound, refresh mất hết. Là TODO chưa làm.
- **Fix**: lưu local state per orderId; khi tất cả check → enable nút "Hoan tat dong goi".

---

### P3 — Cleanup

#### F-19 · `OrdersPage.tsx` chưa kiểm tra (compact list)
- Lazy review. Không thấy issue trong code đã nạp.

#### F-20 · `StatCard icon=""` rỗng khắp nơi
- [StoreManagerDashboard.tsx#L31-L36](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/StoreManagerDashboard.tsx#L31-L36), [ShipperDashboard.tsx#L32-L35](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/ShipperDashboard.tsx#L32-L35).
- Sau khi xóa emoji, `icon=""` để trống. Nên replace bằng SVG (xem `icons.tsx` mới tạo) hoặc bỏ prop.

#### F-21 · POS dùng ký tự "▤" làm icon scan
- [POSTerminalPage.tsx#L322](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L322), [#L379](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L379).
- Trông giống emoji vuông; nên đổi sang SVG barcode icon.

---

## UI Matrix

| Feature | Expected (theo spec) | Hiện tại | Status | Files | Priority |
|---|---|---|---|---|---|
| **Customer — chọn địa chỉ** | Form + autocomplete + lat/lng + lưu nhiều address | Có | ✅ Done | [CheckoutPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/CheckoutPage.tsx) | — |
| Customer — auto-resolve store khi vào | GPS + fallback nhập tay | **Bỏ chủ động (đúng yêu cầu mới)** | ✅ Done | — | — |
| Customer — hiển thị "store đang phục vụ" | Ẩn ở trang catalog, hiện ở checkout | Đã ẩn ở catalog. Checkout cũng đã ẩn theo yêu cầu mới. | ✅ Done | [CheckoutPage.tsx#L266-L289](file:///home/congthang/Desktop/TMDT/frontend/src/pages/CheckoutPage.tsx#L266-L289) | — |
| Customer — Product list theo store | Catalog **global** + tồn aggregate | ✅ | ✅ Done | [ProductListPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/ProductListPage.tsx) | — |
| Customer — Product detail tồn/giá theo store | Hiện aggregate (theo yêu cầu mới) | ✅ Có `available` + `storeCoverage` (chưa dùng) | ⚠️ Partial | [ProductDetailPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/ProductDetailPage.tsx) | P2 (F-13) |
| Customer — One-store cart | Hiện store-less (đúng yêu cầu mới) | ✅ | ✅ Done | [cart.store.ts](file:///home/congthang/Desktop/TMDT/frontend/src/lib/cart.store.ts) | — |
| Customer — Đổi địa chỉ → đổi store note | Hint giá đã cập nhật | ❌ Thiếu | ❌ Missing | [CheckoutPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/CheckoutPage.tsx) | P1 (F-09) |
| Customer — Checkout resolve store | Resolve theo address cuối | ✅ Quote API | ✅ Done | [CheckoutPage.tsx#L77-L83](file:///home/congthang/Desktop/TMDT/frontend/src/pages/CheckoutPage.tsx#L77-L83) | — |
| Customer — Checkout hiển thị store + km + phí | Đã ẩn store theo yêu cầu mới, nhưng phí phải show | Phí có. **Khoảng cách + breakdown chưa show** trong order detail | ⚠️ Partial | [OrderDetailPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/OrderDetailPage.tsx) | P1 (F-11) |
| Customer — Order detail store + tracking | Có store + timeline | ✅ | ✅ Done | [OrderDetailPage.tsx#L93-L170](file:///home/congthang/Desktop/TMDT/frontend/src/pages/OrderDetailPage.tsx#L93-L170) | — |
| **Store Manager — Dashboard** | Đơn theo trạng thái + revenue + low-stock | ✅ | ✅ Done | [StoreManagerDashboard.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/StoreManagerDashboard.tsx) | — |
| Store Manager — Orders đúng store | Scope theo store | ✅ (`/store-manager/orders`) | ✅ Done | [StoreManagerOrders.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/StoreManagerOrders.tsx) | — |
| Store Manager — Quản lý nhân viên | List staff | ✅ list (không tạo/xóa) | ⚠️ Partial | [StoreManagerStaff.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/StoreManagerStaff.tsx) | P2 |
| Store Manager — Warehouse staff mgmt | Có thể assign | ❌ Thiếu | ❌ Missing | — | P2 |
| Store Manager — Xem shipper chính | Hiển thị | ❌ Thiếu | ❌ Missing | [StoreManagerDashboard.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/StoreManagerDashboard.tsx) | P1 (F-05) |
| Store Manager — Inventory theo store | ✅ | ✅ Done | [StoreManagerInventory.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/StoreManagerInventory.tsx) | — |
| Store Manager — Reports doanh thu | ✅ | ✅ Done | [StoreManagerReports.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/StoreManagerReports.tsx) | — |
| Store Manager — Xử lý ngoại lệ đơn | Reassign / force-cancel | ❌ Chỉ có Cancel | ❌ Missing | [StoreManagerOrders.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/StoreManagerOrders.tsx) | P1 (F-06) |
| **Store Staff — Đơn mới** | Scope store + tabs | ✅ | ✅ Done | [StoreStaffOrders.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/StoreStaffOrders.tsx) | — |
| Store Staff — Confirm/picking/cancel | ✅ với reason | ✅ Done | [StoreStaffOrders.tsx#L60-L73](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/StoreStaffOrders.tsx#L60-L73) | — |
| **Warehouse — Đơn cần soạn** | List + bắt đầu/đóng gói | ✅ | ✅ Done | [WarehousePick.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/WarehousePick.tsx) | — |
| Warehouse — Pick check items | Checkbox lưu state | ❌ Không lưu state | ⚠️ Partial | [WarehousePick.tsx#L47](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/WarehousePick.tsx#L47) | P2 (F-18) |
| Warehouse — Inventory list theo store | ✅ | ✅ Done | [WarehouseInventory.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/WarehouseInventory.tsx) | — |
| Warehouse — Nhập/xuất/điều chỉnh | Nhập + Kiểm kê. Không có **Xuất/hủy hỏng** | ⚠️ Partial | [WarehouseInventory.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/WarehouseInventory.tsx) | P1 (F-08) |
| Warehouse — Cảnh báo low-stock | ✅ ở dashboard SM, ✅ filter check ở WH | ✅ Done | [WarehouseInventory.tsx#L34-L36](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/WarehouseInventory.tsx#L34-L36) | — |
| Warehouse — Lịch sử transaction | ❌ Thiếu | ❌ Missing | — | P1 (F-07) |
| **Shipper — Jobs assigned** | Trực tiếp, không offer | ✅ | ✅ Done | [ShipperConsolePage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/shipper/ShipperConsolePage.tsx) | — |
| Shipper — Bỏ offer/accept/reject | ✅ | ✅ Done | (route `offers` đã xóa) | — |
| Shipper — Pickup → out → arrived → delivered/failed | ✅ | ✅ Done | [ShipperConsolePage.tsx#L19-L27](file:///home/congthang/Desktop/TMDT/frontend/src/pages/shipper/ShipperConsolePage.tsx#L19-L27) | — |
| Shipper — Mobile-first | Card layout OK | ⚠️ Dùng `prompt/confirm` xấu | ⚠️ Partial | [ShipperConsolePage.tsx#L46-L52](file:///home/congthang/Desktop/TMDT/frontend/src/pages/shipper/ShipperConsolePage.tsx#L46-L52) | P2 (F-15) |
| Shipper — COD | ✅ confirm + amount | ✅ Done | [ShipperConsolePage.tsx#L51-L53](file:///home/congthang/Desktop/TMDT/frontend/src/pages/shipper/ShipperConsolePage.tsx#L51-L53) | — |
| Shipper — Chỉ đường | ❌ Thiếu | ❌ Missing | [ShipperConsolePage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/shipper/ShipperConsolePage.tsx) | P2 (F-16) |
| **Admin — Stores CRUD** | Tạo/sửa/list | ✅ Tạo + assign manager + assign shipper + service-area + staff list | ✅ Done | [AdminStoresPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminStoresPage.tsx) | — |
| Admin — Service Areas UI | (mâu thuẫn với resolver mới) | ⚠️ Còn nhưng vô tác dụng | ❌ Wrong | [AdminStoresPage.tsx#L209-L225](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminStoresPage.tsx#L209-L225) | **P0 (F-03)** |
| Admin — Staff per store | Có list trong Store Detail Modal | ✅ Done | [AdminStoresPage.tsx#L227-L237](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminStoresPage.tsx#L227-L237) | — |
| Admin — Products global | ✅ | ✅ Done | [AdminProductsPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminProductsPage.tsx) | — |
| Admin — Barcode management | Form gán/sửa barcode | ❌ Thiếu | ❌ Missing | — | **P0 (F-01)** |
| Admin — Inventory toàn chuỗi | ✅ | ✅ Done | [AdminInventoryPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminInventoryPage.tsx) | — |
| Admin — Orders toàn chuỗi | ✅ | ✅ Done | [AdminOrdersPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminOrdersPage.tsx) | — |
| Admin — Reports | ✅ | ✅ Done | [AdminReportsPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminReportsPage.tsx) | — |
| Admin — Audit log | ✅ | ✅ Done | [AdminAuditPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminAuditPage.tsx) | — |
| Admin — Users filter theo store | ❌ Chỉ filter theo role | ❌ Missing | [AdminUsersPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminUsersPage.tsx) | P1 (F-10) |
| Admin — Còn wording seller/shop? | Routes đã redirect, Topbar còn map | ⚠️ Partial | [Topbar.tsx#L112-L142](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/layout/Topbar.tsx#L112-L142) | P2 (F-14) |
| **POS — Route** | `/pos` cho cashier | ✅ | ✅ Done | [App.tsx#L126-L134](file:///home/congthang/Desktop/TMDT/frontend/src/App.tsx#L126-L134) | — |
| POS — Barcode auto-focus | ✅ + autoFocus + focusScan() | ✅ Done | [POSTerminalPage.tsx#L48-L52](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L48-L52) | — |
| POS — Scan barcode → add item | ✅ | ✅ Done | [POSTerminalPage.tsx#L97-L122](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L97-L122) | — |
| POS — Search thủ công | ✅ | ✅ Done | [POSTerminalPage.tsx#L131-L159](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L131-L159) | — |
| POS — Item list + sửa qty/xóa | ✅ | ✅ Done | [POSTerminalPage.tsx#L383-L416](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L383-L416) | — |
| POS — Sản phẩm cân ký | ✅ Modal nhập kg | ✅ Done | `WeightModal` | — |
| POS — Subtotal/discount/total | ✅ | ✅ Done | [POSTerminalPage.tsx#L424-L437](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L424-L437) | — |
| POS — Cash payment + change | ✅ Quick-cash + auto change | ✅ Done | [POSTerminalPage.tsx#L463-L484](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L463-L484) | — |
| POS — QR/bank manual + reference | ✅ | ✅ Done | [POSTerminalPage.tsx#L487-L498](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L487-L498) | — |
| POS — Receipt | ✅ ReceiptModal | ✅ Done | `ReceiptModal` | — |
| POS — Shift open/close | ✅ ShiftModal | ✅ Done | [POSTerminalPage.tsx#L300-L308](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L300-L308) | — |
| POS — Void với reason | ✅ ReasonModal | ✅ Done | [POSTerminalPage.tsx#L562-L569](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L562-L569) | — |
| POS — Return/refund | ❌ Thiếu UI | ❌ Missing | (backend có) | **P0 (F-02)** |
| POS — Reports | ✅ riêng cho manager | ✅ Done | [POSReportsPage.tsx](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/POSReportsPage.tsx) | — |
| POS — Lấy store từ cashier (không GPS/resolver) | ✅ Hoàn toàn | ✅ Done | [POSTerminalPage.tsx#L294-L295](file:///home/congthang/Desktop/TMDT/frontend/src/pos/POSTerminalPage.tsx#L294-L295) | — |

---

## Route Audit

| Route | Verdict | Lý do |
|---|---|---|
| `/` | **giữ** | Home global catalog |
| `/products`, `/products/:slug` | **giữ** | Catalog + detail |
| `/cart`, `/checkout`, `/orders`, `/orders/:id` | **giữ** | Customer flow |
| `/login`, `/register`, `/payment/vnpay/return` | **giữ** | Auth + payment |
| `/admin/dashboard`...`/admin/audit` | **giữ** | Admin core |
| **`/admin/barcodes`** | **thêm** | (không tồn tại) — F-01 cần |
| **`/admin/users?storeId=`** | **sửa** | F-10 |
| `/store-manager/dashboard`...`/pos-reports` | **giữ** | SM core |
| **`/store-manager/exceptions`** | **thêm** | F-06 |
| `/store/orders` | **giữ** | Staff |
| `/pos` | **giữ** | POS terminal |
| **`/pos/returns`** | **thêm** | F-02 |
| `/warehouse/dashboard`, `/warehouse/pick`, `/warehouse/inventory` | **giữ** | WH core |
| **`/warehouse/transactions`** | **thêm** | F-07 |
| `/shipper/dashboard`, `/shipper/active`, `/shipper/history` | **giữ** | Shipper |
| `/staff/dashboard`, `/staff/tickets` | **giữ** | Support |
| `/seller`, `/seller/*`, `/shops/*` | **redirect** (đã có) | Legacy ✅ |
| `/admin/dispatch`, `/admin/shops` | **redirect** (đã có) | Legacy ✅ |

---

## Terminology Audit

| Wording cũ | File · Line | Wording mới đề xuất | Action |
|---|---|---|---|
| `seller` (label) | [Topbar.tsx#L115](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/layout/Topbar.tsx#L115) | (xóa) — không còn role này | xóa entry |
| `shops` | [Topbar.tsx#L122](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/layout/Topbar.tsx#L122) | `Cua hang` → trỏ về `stores` | xóa entry, không có route |
| `dispatch: 'Dieu phoi'` | [Topbar.tsx#L126](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/layout/Topbar.tsx#L126) | (xóa) — auto-dispatch ngầm | xóa |
| `offers: 'Don moi'` | [Topbar.tsx#L134](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/layout/Topbar.tsx#L134) | (xóa) — không còn offer model | xóa |
| `vouchers: 'Voucher'` | [Topbar.tsx#L124](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/layout/Topbar.tsx#L124) | giữ nếu có route, nhưng không thấy → xóa | xóa |
| `Khu vuc nay chua duoc cua hang nao phuc vu` | [CheckoutPage.tsx#L274-L276](file:///home/congthang/Desktop/TMDT/frontend/src/pages/CheckoutPage.tsx#L274-L276) | "Hien chua co cua hang dang hoat dong" | đổi text |
| `Khu vuc PV` cột table | [AdminStoresPage.tsx#L52](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminStoresPage.tsx#L52) | xóa hoặc đổi thành "Vung uu tien" | xóa |
| `serviceArea` section trong modal | [AdminStoresPage.tsx#L209-L225](file:///home/congthang/Desktop/TMDT/frontend/src/pages/admin/AdminStoresPage.tsx#L209-L225) | xóa toàn bộ section | xóa |
| `Cua hang phuc vu` ở order detail | [OrderDetailPage.tsx#L97](file:///home/congthang/Desktop/TMDT/frontend/src/pages/OrderDetailPage.tsx#L97) | giữ nguyên, đúng spec | OK |
| `supplier` | (không tìm thấy) | — | OK |
| `multi-shop` / `marketplace` | (không tìm thấy) | — | OK |
| `warehouse central` | (không tìm thấy) | — | OK |

> [!IMPORTANT]
> Term "warehouse" trong UI hiện chỉ map sang **store warehouse** (kho cua hang) qua menu `Kho cua hang`, không gây hiểu nhầm là kho trung tâm.

---

## Responsive / UX Audit

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Mobile 375px | ⚠️ Partial | Header có `.hide-mobile`, nhưng dashboard sidebar không có hamburger smooth; Topbar có nút `☰` nhưng layout shift khi mở. |
| Tablet 768px | ✅ | Grid 2-col fallback OK. |
| Desktop 1440px | ✅ | Container max-width tốt. |
| Text overflow | ⚠️ | Order items dài bị wrap nhiều dòng ([StoreManagerOrders.tsx#L76](file:///home/congthang/Desktop/TMDT/frontend/src/dashboard/pages/StoreManagerOrders.tsx#L76)). Nên `text-overflow: ellipsis` + tooltip. |
| Button states | ✅ | Có disabled khi `act.isPending` ở hầu hết action mutations. |
| Empty states | ✅ | "Khong co don can soan", "Khong tim thay san pham" v.v. |
| Loading states | ⚠️ Partial | Có skeleton ở Home/Cart/OrderDetail; không có ở dashboard table khi chuyển tab (chỉ rely vào DataTable internal). |
| Error states | ⚠️ Partial | Đa số dùng toast, đủ. Không có "retry" button khi network fail. |
| Modals cho dangerous actions | ⚠️ Partial | Cancel order ở OrderDetail dùng `useMutation` trực tiếp **không confirm** ([OrderDetailPage.tsx#L185](file:///home/congthang/Desktop/TMDT/frontend/src/pages/OrderDetailPage.tsx#L185)). Cần `confirm("Huy don?")`. Tương tự "Tra hang". |
| aria-label icon-only buttons | ⚠️ Partial | NotificationBell + Cart đã có. POS có `title="Xoa"` thay vì aria-label. Topbar `☰` aria-label OK. |
| Keyboard nav | ✅ POS có F4/F6 + Enter scan. | — |

---

## POS-specific Audit

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Barcode scan UX | ✅ | Auto-focus, peek lookup detect WEIGHT, clear input sau scan, error hiển thị inline. |
| Cashier store scope | ✅ | Backend qua `assertStoreAccess`. UI hiển thị `sale.storeName` ở topbar. Không có dropdown chọn store. |
| Payment UX | ✅ | Quick-cash + auto change; QR/CARD/VNPAY có reference. |
| Receipt UX | ✅ | Auto-open sau pay; có nút "In hoa don" lại. |
| Inventory feedback | ⚠️ | Sau pay, không refresh aggregate stock của catalog (catalog cache 60s không sao). Cảnh báo "het ton tai cua hang" có nhưng chỉ trong scan response. |
| Shift UX | ✅ | Pill mở/đóng + modal nhập tiền + reconcile. |
| Refund/Void UX | ⚠️ | Void ✅. Refund ❌ (F-02). |
| Edge cases | ⚠️ | Khi quét trùng barcode liên tục rất nhanh, có thể tạo 2 lookup song song; backend lock OK nhưng UI có thể flash. Không critical. |

---

## Final Action Plan

> [!IMPORTANT]
> Thứ tự thực hiện. Cố gắng gộp các fix cùng file để giảm số commit/build.

### 1. P0 — Phải làm cho MVP

1. **F-01** — Admin Barcode UI: thêm cột barcode ở `AdminProductsPage`, modal gán/sửa, gọi `POST /admin/pos/barcodes`. ⏱ ~2h
2. **F-02** — POS Return/Refund: thêm route `/pos/returns` (Manager only) + form chọn sale + items + reason. ⏱ ~3h
3. **F-03** — Bỏ Service Area UI khỏi `AdminStoresPage` (section + cột). ⏱ ~30m

### 2. P1 — MVP gaps

4. **F-04** — Sửa text "Khu vực không phục vụ" trong `CheckoutPage`. ⏱ ~10m
5. **F-05** — Hiện "Shipper chính" trong `StoreManagerDashboard`. ⏱ ~30m
6. **F-06** — Action "Giao lại" + "Hủy đơn (hoàn kho)" trong `StoreManagerOrders` cho status `DELIVERY_FAILED`. ⏱ ~1h
7. **F-07** — Trang `/warehouse/transactions` list inventory transactions. ⏱ ~1.5h
8. **F-08** — Nút "Xuất / hủy hỏng" trong `WarehouseInventory` modal (type=`LOSS`). ⏱ ~45m
9. **F-09** — Note "giá đã cập nhật theo store" trong `CheckoutPage` khi `quote.subtotal !== cart.subtotal`. ⏱ ~30m
10. **F-10** — Filter `?storeId=` ở `AdminUsersPage`. ⏱ ~30m
11. **F-11** — Distance + breakdown ở `OrderDetailPage`. ⏱ ~30m

### 3. P2 — UX polish

12. **F-13** — "Có sẵn tại N cửa hàng" ở `ProductDetailPage`. ⏱ ~15m
13. **F-14** — Xóa entries cũ trong `Topbar.humanize`. ⏱ ~5m
14. **F-15** — Modal thay `prompt/confirm` ở `ShipperConsolePage`. ⏱ ~45m
15. **F-16** — Link Google Maps ở `ShipperConsolePage`. ⏱ ~15m
16. **F-17** — Confirm khi xóa item POS giá trị lớn. ⏱ ~15m
17. **F-18** — State checkbox `WarehousePick`. ⏱ ~20m
18. Modal confirm cho Cancel/Return ở `OrderDetailPage`. ⏱ ~15m
19. text-overflow + tooltip cho list dài. ⏱ ~20m

### 4. P3 — Cleanup

20. **F-20/F-21** — Replace `icon=""` rỗng và "▤" bằng SVG từ `icons.tsx`. ⏱ ~30m
21. Xóa `lib/store.store.ts`, `StorePicker.tsx`, `store-picker.css` đã orphan. ⏱ ~10m
22. Xóa file CSS không dùng (sau khi grep verify). ⏱ ~15m

---

## Tổng thời gian ước tính

| Priority | Số task | Time |
|---|---|---|
| P0 | 3 | ~5.5h |
| P1 | 8 | ~5.5h |
| P2 | 7 | ~2.5h |
| P3 | 3 | ~1h |
| **Tổng** | **21** | **~14.5h** |

**Sau khi xong P0+P1, MVP UI coverage đạt ≥95%** so với spec.
