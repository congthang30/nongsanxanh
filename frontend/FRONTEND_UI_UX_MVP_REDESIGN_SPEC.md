# Frontend UI/UX MVP Redesign Spec

Ngay tao: 2026-05-31

Nguon tham chieu:

- `BACH_HOA_XANH_STORE_MVP_SPEC.md`
- `STORE_POS_CHECKOUT_SPEC.md`
- `RISK_ANALYSIS_REPORT.md`
- `frontend/src/App.tsx`
- `frontend/package.json`

Pham vi file nay: lam chuan de AI/code agent redesign toan bo `/frontend` theo MVP web. File nay khong yeu cau sua backend va khong yeu cau lam mobile native.

---

## 1. Product Direction

NongSan Xanh la web ban nong san/thuc pham tuoi theo mo hinh chuoi cua hang noi bo, gan voi cach khach hang mua o Bach Hoa Xanh: chon hang nhanh, nhap dia chi giao, he thong tu tim cua hang phu hop co du hang, cua hang soan hang, shipper cua cua hang giao.

Giao dien moi phai truyen tai 5 y:

- **Tuoi va gan**: san pham hien ro, anh san pham that, ngon mat, khong dung hero minh hoa chung chung.
- **Mua nhanh**: customer di tu home -> product -> cart -> checkout trong it buoc.
- **Tin cay**: payment, ton kho, dia chi, trang thai don, doi tra phai ro rang.
- **Chuoi cua hang noi bo**: admin/manager/staff/warehouse/shipper van hanh theo store, khong phai marketplace seller.
- **Tu dong chon cua hang**: customer khong chon store/khu vuc thu cong; he thong tu resolve theo dia chi va ton kho.

Tinh cach UI:

- Storefront: tuoi, sach, gan gui, de mua.
- Dashboard noi bo: gon, work-focused, de quet du lieu, uu tien bang/filter/action.
- POS: toc do cao, it animation, barcode input luon san sang.
- Shipper web: dung duoc tren dien thoai, dia chi va nut chi duong la trong tam.

Nguyen tac bat buoc:

- Khong de bat ky customer flow nao co dropdown/chon tay `store`, `shop`, `seller`, `region`, `service area`.
- Neu can hien store, chi hien dang thong tin: "Cua hang phu trach: X", khong cho user ep chon.
- Khong dung UI marketplace: "shop cua nguoi ban", "seller", "mo shop", "multi-shop", "shipper dau gia/nhan offer".
- Text tieng Viet phai co dau, ngan, tu nhien.

---

## 2. MVP Scope

### 2.1 Must Have

- Customer storefront.
- Product list/detail.
- Cart.
- Checkout.
- Payment return.
- Order history/detail.
- Admin dashboard.
- Admin stores/products/inventory/orders/users/reports/audit.
- Store manager dashboard/orders/inventory/staff/reports/POS reports.
- Store staff order handling.
- Warehouse dashboard/pick/inventory/transactions.
- POS terminal.
- POS returns/refunds.
- Shipper dashboard/active/history.
- Support console neu giu trong route hien tai.

### 2.2 Should Have

- Landing page co visual nong san that va transition san pham phu hop brand.
- Checkout quote hien ro phi ship, tong tien, ton kho, coupon invalid, payment state.
- Order detail co timeline order + delivery ro hon.
- Dashboard co filter theo store/status/date.
- Empty/loading/error state dung chuan cho moi man.
- Confirm dialog thay cho `window.confirm` hoac thao tac nguy hiem.
- Shipper co nut mo Google Maps/Apple Maps.
- POS co receipt modal in/xuat ro, QR payment confirm 2 buoc.

### 2.3 Not In MVP

- Seller marketplace.
- Seller onboarding.
- Seller shop public page.
- Manual customer store/region selection.
- Multi-store split checkout.
- Shipper bidding/offer/accept.
- Native mobile iOS/Android.
- Loyalty phuc tap.
- Offline POS mode.
- ERP procurement phuc tap.
- Route optimization nhieu don.

---

## 3. Current Frontend Architecture

Frontend hien tai:

- React `18.3.1`.
- Vite `6.0.3`.
- TypeScript.
- React Router DOM.
- TanStack Query.
- Axios.
- Zustand.
- CSS global theo file: `styles/index.css`, `dashboard/layout/dashboard.css`, page CSS, POS CSS.

Khong co Tailwind, khong co UI component library, khong co lucide-react trong `frontend/package.json`. Redesign nen tiep tuc dung CSS hien co va tao shared component/dynamic class ro rang. Khong them UI framework lon trong MVP.

Thu muc chinh:

- `frontend/src/pages`: storefront, auth, customer order, admin pages.
- `frontend/src/components`: layout/customer/shared widgets.
- `frontend/src/dashboard`: dashboard shell, menu, shared dashboard components, internal pages.
- `frontend/src/pos`: POS terminal, returns, POS API, modals.
- `frontend/src/lib`: API client, auth/cart/toast stores, format helpers.

Van de hien tai can sua khi redesign:

- Nhieu text khong dau: "Gio hang", "Dat hang", "Don hang", "Khach", "Ton kho".
- Nhieu inline style trong pages lam UI khong dong nhat.
- Home page con dung emoji/orb/pattern nhieu, chua du "nong san that".
- Dashboard menu icon hien rong `icon: ''`.
- DataTable loading/empty text con khong dau.
- Checkout co wording "Khu vuc" trong address form, can doi thanh dia chi giao hang/duong/phuong/quan.
- Payment/order UI con hien raw status nhu `SUCCESS`, `VNPAY`, `PENDING`.
- POS da dung dark UI rieng, can giu huong full-screen nhung polish text, spacing, confirm state.

---

## 4. Route Audit

| Route | Role | Current purpose | MVP purpose | UI status | Priority |
| --- | --- | --- | --- | --- | --- |
| `/` | Public/customer | Home/Landing | Landing + product entry, no manual region/store | Redesign | P0 |
| `/products` | Public/customer | Product list | Browse/search/filter products | Redesign | P0 |
| `/products/:slug` | Public/customer | Product detail | Product info + add cart | Redesign | P0 |
| `/cart` | Public/customer | Cart | Cart validation + checkout entry | Redesign | P0 |
| `/login` | Public | Login | Login by email/Google if configured | Redesign | P1 |
| `/register` | Public | Register | Customer registration | Redesign | P1 |
| `/payment/vnpay/return` | Public | VNPay return | Success/failed/pending/retry state | Redesign | P0 |
| `/checkout` | Customer | Checkout | Address, quote, payment, place order | Redesign | P0 |
| `/orders` | Customer | Order list | Customer order history | Redesign | P0 |
| `/orders/:id` | Customer | Order detail | Timeline, payment, delivery, return/review | Redesign | P0 |
| `/admin` | Admin | Redirect | Redirect to dashboard | Keep | P2 |
| `/admin/dashboard` | Admin/Super Admin | Admin overview | Chain-wide ops overview | Redesign | P0 |
| `/admin/stores` | Admin/Super Admin | Manage stores | Internal store/manager/shipper/staff | Redesign | P0 |
| `/admin/orders` | Admin/Super Admin | Manage orders | All orders, risk/payment/store filters | Redesign | P0 |
| `/admin/products` | Admin/Super Admin | Manage products | Catalog, variants, barcode entry | Redesign | P0 |
| `/admin/inventory` | Admin/Super Admin | Inventory overview | Cross-store stock visibility | Redesign | P0 |
| `/admin/users` | Admin/Super Admin | Users/roles | Role assignment and scope | Redesign | P1 |
| `/admin/reports` | Admin/Super Admin | Reports | Revenue/order/POS/stock report | Redesign | P1 |
| `/admin/audit` | Admin/Super Admin | Audit logs | Trace payment/order/inventory actions | Redesign | P1 |
| `/store-manager` | Store Manager/Admin | Redirect | Redirect to manager dashboard | Keep | P2 |
| `/store-manager/dashboard` | Store Manager/Admin | Store overview | Store KPIs, alerts, today workload | Redesign | P0 |
| `/store-manager/orders` | Store Manager/Admin | Store orders | Confirm/exception/delivery failed | Redesign | P0 |
| `/store-manager/inventory` | Store Manager/Admin | Store inventory | Stock alerts and adjustments | Redesign | P0 |
| `/store-manager/staff` | Store Manager/Admin | Staff list | Staff/shipper/store scope | Redesign | P1 |
| `/store-manager/reports` | Store Manager/Admin | Store reports | Store revenue/order/POS report | Redesign | P1 |
| `/store-manager/pos-reports` | Store Manager/Admin | POS report | POS sales/shift/returns report | Redesign | P1 |
| `/store` | Store Staff/Manager/Admin | Redirect | Redirect to store order queue | Keep | P2 |
| `/store/orders` | Store Staff/Manager/Admin | Staff orders | Confirm, prepare, pack order | Redesign | P0 |
| `/pos` | Store Staff/Manager/Admin | Full-screen POS | Cashier terminal | Polish | P0 |
| `/pos/returns` | Store Manager/Admin | POS returns | Return/refund approval flow | Redesign | P0 |
| `/warehouse` | Warehouse/Manager/Admin | Redirect | Redirect to warehouse dashboard | Keep | P2 |
| `/warehouse/dashboard` | Warehouse/Manager/Admin | Warehouse overview | Pick/stock/task overview | Redesign | P0 |
| `/warehouse/pick` | Warehouse/Manager/Admin | Pick orders | Pick/pack queue | Redesign | P0 |
| `/warehouse/inventory` | Warehouse/Manager/Admin | Inventory ops | Import/export/adjust with confirm | Redesign | P0 |
| `/warehouse/transactions` | Warehouse/Manager/Admin | Transactions | Audit trail of stock movements | Redesign | P1 |
| `/shipper` | Shipper/Admin | Redirect | Redirect to shipper dashboard | Keep | P2 |
| `/shipper/dashboard` | Shipper/Admin | Shipper overview | Assigned jobs summary | Redesign | P0 |
| `/shipper/active` | Shipper/Admin | Active jobs | Mobile-friendly delivery console | Redesign | P0 |
| `/shipper/history` | Shipper/Admin | Delivery history | Completed/failed jobs | Redesign | P1 |
| `/staff` | Support/Admin | Redirect | Redirect to support dashboard | Keep | P2 |
| `/staff/dashboard` | Support/Admin | Staff dashboard | Support overview | Keep/Redesign light | P2 |
| `/staff/tickets` | Support/Admin | Support console | Ticket list/detail/reply | Redesign | P2 |
| `*` | Any | Redirect home | Fallback | Keep | P3 |

---

## 5. Design System

### 5.1 Tokens

Keep global CSS variables in `frontend/src/styles/index.css`, but revise to one consistent system shared by customer, dashboard, and internal pages.

Palette must not be one-note green. Suggested tokens:

| Token | Value | Use |
| --- | --- | --- |
| `--color-leaf-600` | `#16a34a` | Primary action |
| `--color-leaf-700` | `#15803d` | Primary hover |
| `--color-mint-50` | `#f0fdf4` | Soft backgrounds |
| `--color-citrus-500` | `#f59e0b` | Promotion, warnings |
| `--color-tomato-600` | `#dc2626` | Errors, destructive |
| `--color-sky-600` | `#0284c7` | Info/payment pending |
| `--color-soil-700` | `#92400e` | Harvest accent |
| `--color-ink-900` | `#0f172a` | Main text |
| `--color-ink-600` | `#475569` | Secondary text |
| `--color-border` | `#e2e8f0` | Borders |
| `--color-surface` | `#ffffff` | Cards/panels |
| `--color-page` | `#f8fafc` | Page bg |

Spacing:

- `--space-1: 4px`
- `--space-2: 8px`
- `--space-3: 12px`
- `--space-4: 16px`
- `--space-5: 20px`
- `--space-6: 24px`
- `--space-8: 32px`
- `--space-10: 40px`
- `--space-12: 48px`

Radius:

- Buttons/input: 8-10px.
- Cards/table panels: 8px.
- Badges: pill allowed.
- POS panels: 10-12px.
- Avoid large decorative rounded cards unless needed.

Typography:

- Body: keep system or current `Be Vietnam Pro` if loaded correctly.
- Do not scale font size with viewport width.
- Dashboard heading: 20-28px.
- Card heading: 14-18px.
- POS scan input: 20-24px, tabular numbers for money.
- All labels Vietnamese with diacritics.

### 5.2 Components

Buttons:

- `Button` variants: primary, secondary, ghost, danger, neutral.
- Must support `loading`, `disabled`, `icon`, `aria-label`.
- Dangerous actions use danger variant + confirm dialog.

Inputs:

- Labels always visible.
- Error text below input.
- Helper text allowed.
- Address autocomplete must distinguish "Địa chỉ giao hàng" from "khu vực".

Tables:

- Dense but readable.
- Header sticky if table long.
- Filter row above table.
- Empty/loading/error states inside table area.
- On mobile, customer tables become cards; dashboard tables can horizontal-scroll.

Badges/status chips:

- Centralized status map in `StatusBadge`.
- No raw enum shown to user unless in admin debug/audit context.
- Payment status and order status must have separate visual language.

Modals:

- Use `ConfirmModal` for cancel, void, refund, stock adjust, delivery failed.
- Focus first meaningful input.
- Escape closes only non-destructive modal.

Toasts:

- Success: short confirmation.
- Error: clear next action.
- No technical stack/error raw text.

Cards:

- Use for repeated items, metric cards, POS panels, modals.
- Do not put card inside card unless it is a real nested tool/panel.
- Page sections should be unframed or table panels, not decorative card stacks.

### 5.3 Icon Rule

Current package has no icon library. Do not add a heavy icon package during redesign unless required. Replace emoji UI with:

- small CSS/icon components in `frontend/src/components/icons.tsx`, or
- text labels + minimal inline icon components.

If project later installs `lucide-react`, replace common icon buttons with lucide icons.

---

## 6. Customer UI/UX

### 6.1 Customer Flow

Target flow:

```text
Home -> Products -> Product Detail -> Cart -> Checkout -> Payment/COD -> Order Detail
```

Backend remains source of truth for store, price, stock, shipping fee, coupon, payment total. Frontend only displays quote/order returned by API.

### 6.2 Home / Landing Page

Route: `/`

Current issue:

- Uses emoji-heavy hero and decorative orbs/pattern.
- Copy still has non-accent text.
- Does not strongly explain auto store assignment.

Target:

- First viewport must show actual fresh produce/product imagery, not abstract illustration.
- Hero copy:
  - H1: `Nông sản tươi mỗi ngày`
  - Supporting copy: `Đặt rau củ, trái cây và đồ thiết yếu. Hệ thống tự chọn cửa hàng phù hợp gần bạn có đủ hàng.`
  - CTA primary: `Mua ngay`
  - CTA secondary: `Xem đơn hàng`
- Add 3 trust chips:
  - `Tự kiểm tồn trước khi đặt`
  - `Giao từ cửa hàng phù hợp`
  - `COD hoặc VNPay`
- Optional P1: carousel transition theo 4 nhóm:
  - Rau sạch
  - Trái cây
  - Củ quả
  - Gạo/đồ thiết yếu
- CTA must route to `/products`.

Acceptance:

- No customer store/region picker.
- No emoji as primary product visual.
- On mobile, hero text and CTA are visible without overlap.

### 6.3 Product List

Route: `/products`

Target:

- Header: search + category + sort.
- Filter must be product/category/price based, not store/region.
- Product card shows:
  - image,
  - name,
  - unit,
  - price,
  - stock signal: `Có thể đặt` / `Tạm hết` / `Cần kiểm tồn`,
  - add to cart.
- If stock depends on delivery address, copy should say:
  - `Tồn kho được kiểm tra theo địa chỉ giao hàng ở bước thanh toán.`

Acceptance:

- No "seller/shop" label.
- Empty state: `Không tìm thấy sản phẩm phù hợp. Thử đổi từ khóa hoặc danh mục.`

### 6.4 Product Detail

Route: `/products/:slug`

Target:

- Product image gallery.
- Product name, unit, price, quantity stepper.
- Origin/source information if available.
- Storage note/quality note for fresh products.
- CTA add cart.
- Related products.
- Review section if data exists.

Risk guard:

- If add cart fails due to stock: show clear message and keep quantity editable.
- Do not show internal store stock numbers unless backend explicitly returns sellable availability.

### 6.5 Cart

Route: `/cart`

Current issues:

- Many labels without diacritics.
- Summary only says shipping calculated next step.
- Need clearer stock/address caveat.

Target:

- Page title: `Giỏ hàng`.
- Each item:
  - image,
  - name,
  - unit price,
  - quantity stepper,
  - line total,
  - remove button with icon/label,
  - stock warning if backend says unavailable.
- Summary:
  - `Tạm tính`
  - `Phí giao hàng: Tính sau khi chọn địa chỉ`
  - `Tổng tạm tính`
  - `Tiến hành đặt hàng`
- Info note:
  - `Cửa hàng phụ trách sẽ được hệ thống chọn tự động theo địa chỉ giao hàng và tồn kho.`

Risk guard:

- Disable checkout if cart has issues.
- If update quantity pending, disable item controls.

### 6.6 Checkout

Route: `/checkout`

Target checkout sections:

1. Địa chỉ giao hàng.
2. Kiểm tra khả năng phục vụ.
3. Phương thức thanh toán.
4. Mã giảm giá.
5. Tóm tắt đơn hàng.

Wording changes:

- Replace `Khu vuc (duong / phuong / quan)` with `Tìm địa chỉ giao hàng`.
- Replace `So nha / hem / chi tiet` with `Số nhà, hẻm, tầng, ghi chú địa chỉ`.
- Replace `Dang xu ly...` with `Đang tạo đơn...`.
- Replace `Dat hang (COD)` with `Đặt hàng COD`.
- Replace `Thanh toan VNPay` with `Thanh toán qua VNPay`.

Store display rule:

- Allowed: `Cửa hàng hệ thống chọn: {store.name}` or `Cửa hàng phụ trách: {store.name}` after quote.
- Not allowed: radio/dropdown to choose store.
- If store changed due to address/stock, show info banner:
  - `Giá và phí giao hàng đã được cập nhật theo cửa hàng phù hợp với địa chỉ này.`

Risk guards:

- Disable submit while placing.
- Generate/display loading state while quote recalculates.
- If `quote.serviceable=false`, block submit and show exact fix:
  - change address,
  - reduce quantity,
  - remove unavailable item.
- For VNPay, show pending explanation before redirect:
  - `Bạn sẽ được chuyển sang VNPay. Đơn chỉ được xác nhận sau khi thanh toán thành công.`

Acceptance:

- No frontend sends `storeId`, `price`, `shippingFee`, `discount`, `grandTotal`.
- Checkout only sends allowed fields: `addressId`, `paymentMethod`, `couponCode`, `note`.

### 6.7 Payment Return

Route: `/payment/vnpay/return`

Target states:

- Loading: `Đang xác nhận thanh toán`.
- Success: `Thanh toán thành công`.
- Failed: `Thanh toán chưa hoàn tất`.
- Pending/unknown: `Chúng tôi đang chờ xác nhận từ cổng thanh toán`.

Actions:

- `Xem đơn hàng`.
- `Thử thanh toán lại` if orderId available.
- `Tiếp tục mua hàng`.

Risk guard:

- Do not mark success visually until backend verifies callback.
- If backend returns pending or network error, tell user to open order detail.

### 6.8 Orders List

Route: `/orders`

Target:

- Search by order number.
- Filter by status/payment.
- Each order card/table row:
  - order number,
  - created time,
  - status badge,
  - payment status,
  - store responsible,
  - grand total,
  - action `Xem chi tiết`.

Mobile:

- Use cards, not compressed table.

### 6.9 Order Detail

Route: `/orders/:id`

Target sections:

- Header: order number + status + payment status.
- Store responsible.
- Delivery address.
- Items.
- Payment summary.
- Order timeline.
- Delivery timeline.
- Actions: pay, cancel, return, review.

Copy changes:

- `Don #` -> `Đơn #`.
- `San pham` -> `Sản phẩm`.
- `Lich su don hang` -> `Lịch sử đơn hàng`.
- `Giao den` -> `Giao đến`.
- `Huy don` -> `Hủy đơn`.
- `Yeu cau tra hang` -> `Yêu cầu trả hàng`.

Risk guards:

- Cancel requires confirm modal.
- Return requires reason/item quantity form, not instant full return.
- Payment retry disabled while pending request.

---

## 7. Admin UI/UX

Admin pages must feel like chain operation software, not marketing website.

### 7.1 Admin Dashboard

Route: `/admin/dashboard`

Target metric cards:

- Doanh thu hôm nay.
- Đơn mới.
- Đơn đang xử lý.
- Đơn giao thất bại.
- Tồn kho cảnh báo.
- Thanh toán cần đối soát.

Primary panels:

- Order status funnel.
- Store performance table.
- Risk alert list from payment/inventory/delivery states.
- Recent audit events.

### 7.2 Stores

Route: `/admin/stores`

Target:

- Table stores with code/name/status/province/manager/shipper/staff count.
- Detail drawer/modal:
  - store info,
  - manager,
  - primary shipper,
  - staff,
  - service radius/area,
  - status.
- Actions:
  - create/edit store,
  - assign manager,
  - assign primary shipper,
  - add/remove staff.

Not allowed:

- Seller approval/shop onboarding wording.

### 7.3 Orders

Route: `/admin/orders`

Target filters:

- Date range.
- Store.
- Order status.
- Payment status.
- Payment method.
- Delivery status.
- Risk only.

Order row:

- Order number.
- Customer.
- Store.
- Status.
- Payment.
- Delivery.
- Total.
- Created time.

Order detail admin view should show:

- auto-assigned store reason/distance if available,
- payment transaction status,
- inventory risk,
- delivery state,
- audit log link.

### 7.4 Products

Route: `/admin/products`

Target:

- Product list with variants.
- Category filter.
- Active/inactive filter.
- Barcode manager entry point.
- Image quality visible.
- Variant unit/sale mode clear.

Barcode modal:

- Label: `Mã vạch`.
- States: active/inactive, primary.
- Error if duplicate.

### 7.5 Inventory

Route: `/admin/inventory`

Target:

- Cross-store inventory matrix.
- Filter by store/category/low stock/out of stock.
- Columns: product, variant, store, on hand, reserved, available, reorder threshold.
- Link to warehouse transaction history.

### 7.6 Users

Route: `/admin/users`

Target:

- Role filter.
- Store scope filter.
- User status.
- Role assignment modal with store scope.

Need clarify:

- Store Manager/Staff/Warehouse/Shipper must be store-scoped.
- Admin/Super Admin global.

### 7.7 Reports

Route: `/admin/reports`

Target:

- Revenue by day/store.
- Online vs POS vs COD/VNPay.
- Refund/return summary.
- Delivery failure summary.
- Inventory movement summary.

### 7.8 Audit

Route: `/admin/audit`

Target:

- Filter action/actor/store/date/target.
- Compact event row:
  - timestamp,
  - actor,
  - action,
  - target,
  - store,
  - summary.
- Expand metadata as JSON only on demand.

---

## 8. Store Manager UI/UX

### 8.1 Dashboard

Route: `/store-manager/dashboard`

Target:

- Store name/status.
- Today revenue.
- New orders.
- Orders needing action.
- Delivery failed.
- Low stock.
- POS sales today.
- Staff/shipper quick info.

Manager should see actionable alerts first:

- `Đơn mới cần xác nhận`
- `Đơn giao thất bại`
- `Sắp hết hàng`
- `Yêu cầu trả hàng`
- `COD cần đối soát`

### 8.2 Orders

Route: `/store-manager/orders`

Target:

- Queue tabs:
  - Mới,
  - Đã xác nhận,
  - Đang soạn,
  - Sẵn sàng giao,
  - Giao thất bại,
  - Hoàn tất/hủy.
- Row action depends on state.
- Detail side panel:
  - items to prepare,
  - customer delivery info,
  - payment method/status,
  - shipper assigned,
  - internal note.

### 8.3 Inventory

Route: `/store-manager/inventory`

Target:

- Store-scoped inventory only.
- Low stock first.
- Adjustment action requires reason.
- Dangerous actions confirm.

### 8.4 Staff

Route: `/store-manager/staff`

Target:

- Staff table by role/status.
- Show primary shipper.
- Manager cannot create global admin.

### 8.5 Reports / POS Reports

Routes:

- `/store-manager/reports`
- `/store-manager/pos-reports`

Target:

- Daily sales.
- POS vs online.
- Cashier shift summary.
- Return/refund summary.
- COD pending.

---

## 9. Store Staff UI/UX

Route: `/store/orders`

Store staff task is not "browse dashboard"; it is process order fast.

Target layout:

- Left: order queue by status.
- Right/drawer: selected order detail.
- Large clear buttons:
  - `Xác nhận đơn`
  - `Bắt đầu soạn`
  - `Đã đóng gói`
  - `Sẵn sàng giao`
  - `Báo thiếu hàng`

Order detail should emphasize:

- item name,
- quantity,
- unit,
- packing note,
- stock warning,
- customer note,
- payment method.

Risk guard:

- If staff reports stock issue, show structured reason and notify manager.
- No access to other store orders.

---

## 10. Warehouse UI/UX

### 10.1 Dashboard

Route: `/warehouse/dashboard`

Target:

- Orders waiting pick.
- Orders currently picking.
- Low stock.
- Recent inventory transactions.
- Quick actions: import, export, adjust.

### 10.2 Pick Orders

Route: `/warehouse/pick`

Target:

- Pick queue grouped by order.
- Each order shows:
  - order number,
  - customer area,
  - payment status,
  - item checklist.
- Actions:
  - start picking,
  - mark item picked,
  - mark packed,
  - report shortage.

### 10.3 Inventory

Route: `/warehouse/inventory`

Target:

- Inventory table by product/variant.
- Available = on hand - reserved.
- Import/export/adjust forms.
- Reason required.
- Confirm modal for export/adjust.

### 10.4 Transactions

Route: `/warehouse/transactions`

Target:

- Filter by type/date/product/order/reference.
- Type labels:
  - `Nhập kho`
  - `Xuất kho`
  - `Giữ hàng`
  - `Hủy giữ hàng`
  - `Bán hàng`
  - `Điều chỉnh`
  - `Hao hụt`
- Show actor and reason.

---

## 11. POS UI/UX

Routes:

- `/pos`
- `/pos/returns`

### 11.1 POS Terminal

Keep full-screen POS style, but improve copy, density, and critical states.

Layout:

- Top bar:
  - store,
  - cashier,
  - shift status,
  - link back dashboard,
  - clock optional.
- Column 1:
  - barcode input always focused,
  - manual search,
  - scan result/error.
- Column 2:
  - sale item list,
  - quantity controls,
  - remove item,
  - hold/void.
- Column 3:
  - totals,
  - payment method,
  - cash input,
  - quick cash buttons,
  - QR/reference,
  - pay button,
  - receipt.

Critical POS states:

- No active shift.
- Barcode not found.
- Barcode inactive.
- Product out of stock.
- Weight product requires quantity.
- Cash not enough.
- QR/manual payment requires reference + confirm.
- Pay in progress disables pay button.
- Paid sale opens receipt.

Copy changes:

- `Da them` -> `Đã thêm`.
- `Tien khach dua khong du` -> `Tiền khách đưa chưa đủ`.
- `Thanh toan thanh cong` -> `Thanh toán thành công`.
- `Da huy hoa don` -> `Đã hủy hóa đơn`.
- `Da treo hoa don` -> `Đã treo hóa đơn`.

Risk guard:

- Payment button disabled while `paying`.
- Show final confirmation for QR/manual:
  - `Tôi đã kiểm tra giao dịch chuyển khoản đúng số tiền.`
- Void requires reason.
- If backend rejects double payment, show non-scary message:
  - `Hóa đơn này đã được xử lý. Vui lòng tải lại màn hình.`

### 11.2 POS Returns

Target flow:

1. Chọn hóa đơn đã thanh toán.
2. Chọn sản phẩm/số lượng trả.
3. Nhập lý do.
4. Tạo yêu cầu.
5. Manager duyệt.
6. Hoàn tất hoàn tiền/nhập lại kho nếu đủ điều kiện.

UI requirements:

- Show already returned quantity if backend returns it.
- Do not allow return quantity > sold quantity.
- Restockable checkbox must be explicit:
  - `Nhập lại kho`
  - `Không nhập kho`
- Refund amount visible before submit.
- Completion action requires confirm.

---

## 12. Shipper UI/UX Web

Routes:

- `/shipper/dashboard`
- `/shipper/active`
- `/shipper/history`

Primary target: shipper can use web on phone.

### 12.1 Active Delivery

Each job card must show:

- Order number.
- Status.
- Pickup store name/address/phone.
- Dropoff customer/address/phone.
- Items summary.
- COD amount if COD.
- Distance.
- Main action button for next status.
- Secondary action:
  - `Chỉ đường`
  - `Gọi khách`
  - `Giao thất bại`

Map/deep link:

- Use Google Maps direction URL when lat/lng available.
- If no lat/lng, encode address string.
- Future mobile native can use Apple Maps/Google Maps.

COD guard:

- For COD delivery, completing order requires modal:
  - COD amount large and clear.
  - `Đã thu đủ tiền`
  - `Chưa thu được tiền`
- If `Chưa thu được tiền`, backend may reject completion; UI should show next step.

Copy changes:

- `Don dang giao` -> `Đơn đang giao`.
- `Cap nhat trang thai tung don` -> `Cập nhật trạng thái từng đơn`.
- `Lay hang tai` -> `Lấy hàng tại`.
- `Giao den` -> `Giao đến`.
- `Chi duong` -> `Chỉ đường`.
- `Giao that bai` -> `Giao thất bại`.

### 12.2 History

Show completed/failed jobs:

- order number,
- final status,
- completed/failed time,
- failure reason,
- COD collected state.

---

## 13. Support UI/UX

Routes:

- `/staff/dashboard`
- `/staff/tickets`

Support is P2 for MVP unless project wants active customer service.

Target:

- Ticket list:
  - subject,
  - customer,
  - priority,
  - status,
  - last update.
- Ticket detail:
  - message thread,
  - customer/order link if available,
  - reply box,
  - internal note optional.

Copy:

- `Tickets` -> `Yêu cầu hỗ trợ`.
- `Support` -> `Hỗ trợ`.

---

## 14. Information Architecture

### 14.1 Customer Nav

Top nav:

- Logo: `Nông Sản Xanh`.
- `Sản phẩm`.
- `Đơn hàng` if logged in.
- Cart icon/count.
- Login/user menu.

No `Khu vực`, no `Chọn cửa hàng`.

### 14.2 Admin Sidebar

Groups:

- Tổng quan
- Chuỗi cửa hàng
  - Cửa hàng
  - Đơn hàng
  - Sản phẩm
  - Tồn kho
- Vận hành
  - Người dùng & vai trò
  - Báo cáo
  - Nhật ký hệ thống

### 14.3 Store Manager Sidebar

Groups:

- Tổng quan
- Cửa hàng của tôi
  - Đơn hàng
  - Tồn kho
  - Nhân viên
  - Báo cáo
- Bán hàng tại quầy
  - Màn hình thu ngân
  - Trả hàng / Hoàn tiền
  - Báo cáo POS

### 14.4 Store Staff Sidebar

Groups:

- Đơn hàng cửa hàng
- Bán hàng tại quầy
  - POS

### 14.5 Warehouse Sidebar

Groups:

- Tổng quan
- Kho cửa hàng
  - Soạn hàng
  - Tồn kho
  - Lịch sử nhập/xuất

### 14.6 Shipper Sidebar

Groups:

- Tổng quan
- Giao hàng
  - Đang giao
  - Lịch sử

### 14.7 POS Route

`/pos` remains full-screen and should not be inside dashboard shell.

---

## 15. Component Mapping

| Component | Purpose | Used in routes | Requirements |
| --- | --- | --- | --- |
| `CustomerLayout` | Storefront shell | `/`, `/products`, `/cart`, `/checkout`, `/orders` | Sticky header, cart count, responsive nav |
| `DashboardLayout` | Internal app shell | Admin/manager/staff/warehouse/shipper/support | Sidebar, topbar, responsive collapse |
| `PageHeader` | Standard page title/actions | All dashboard pages | Title, subtitle, actions, breadcrumbs optional |
| `DataTable` | Internal tabular data | Admin, manager, warehouse, reports | Loading/empty/error, filters, responsive scroll |
| `StatusBadge` | Status label/chip | Orders, delivery, inventory, POS | Full Vietnamese map, no raw enum |
| `MetricCard`/`StatCard` | KPI card | Dashboards/reports | Small, dense, trend/alert support |
| `EmptyState` | No data state | All list pages | Icon optional, title, description, CTA |
| `ErrorState` | Recoverable error | API pages | Message + retry button |
| `LoadingState` | Skeleton/loading | All async pages | Contextual, not layout-shifting |
| `ConfirmDialog` | Destructive/risky actions | Cancel, refund, void, inventory adjust | Reason field optional/required |
| `AddressBlock` | Display delivery address | Checkout/order/shipper | Recipient, phone, address, note |
| `MoneyText` | VND formatting | Everywhere money appears | Tabular, green only for positive value |
| `OrderTimeline` | Order/delivery history | Order detail, admin order detail | Dates, actor/reason optional |
| `InventoryBadge` | Stock state | Product/cart/warehouse | Available/low/out/reserved |
| `POSCart` | POS sale item list | `/pos` | Fast qty update, remove, warning |
| `BarcodeInput` | Scanner input | `/pos` | Always focus, enter submit, error state |
| `PaymentSummary` | Totals/payment | Checkout/POS/order detail | subtotal, fee, discount, total, payment status |
| `FilterBar` | Common filters | Dashboards/tables | Date/status/store/search |
| `ActionToolbar` | Row/page actions | Dashboard pages | Buttons aligned and responsive |

Implementation note:

- Create reusable components only where they reduce real duplication.
- Do not rewrite every page into a new architecture before shipping P0 screens.

---

## 16. Copywriting

### 16.1 Common Replacements

| Old | New |
| --- | --- |
| `Gio hang` | `Giỏ hàng` |
| `Gio hang trong` | `Giỏ hàng trống` |
| `Dat hang` | `Đặt hàng` |
| `Don hang` | `Đơn hàng` |
| `Khach` | `Khách` |
| `San pham` | `Sản phẩm` |
| `Thanh toan` | `Thanh toán` |
| `Phi giao hang` | `Phí giao hàng` |
| `Tong cong` | `Tổng cộng` |
| `Tam tinh` | `Tạm tính` |
| `Dia chi giao hang` | `Địa chỉ giao hàng` |
| `Nhap/Xuat` | `Nhập/Xuất` |
| `Soan hang` | `Soạn hàng` |
| `Dang tai...` | `Đang tải...` |
| `Khong co du lieu` | `Không có dữ liệu` |
| `Da cap nhat` | `Đã cập nhật` |
| `Huy` | `Hủy` |
| `Xac nhan` | `Xác nhận` |

### 16.2 Payment Messages

- Success: `Thanh toán thành công. Đơn hàng đang được cửa hàng chuẩn bị.`
- Failed: `Thanh toán chưa hoàn tất. Bạn có thể thử lại từ chi tiết đơn hàng.`
- Pending: `Chúng tôi đang chờ xác nhận từ cổng thanh toán.`
- COD: `Thanh toán khi nhận hàng. Vui lòng chuẩn bị đúng số tiền khi shipper giao.`

### 16.3 Inventory Messages

- `Sản phẩm này tạm hết hàng tại cửa hàng phù hợp với địa chỉ của bạn.`
- `Số lượng đặt vượt quá tồn kho hiện có. Vui lòng giảm số lượng.`
- `Giá/tồn kho đã được cập nhật theo địa chỉ giao hàng.`

### 16.4 Delivery Messages

- `Đơn đã được gán cho shipper.`
- `Shipper đã lấy hàng.`
- `Đơn đang trên đường giao.`
- `Shipper đã đến nơi.`
- `Giao hàng thành công.`
- `Giao hàng chưa thành công.`

---

## 17. Responsive Rules

### 17.1 Breakpoints

- Mobile: `< 640px`.
- Tablet: `640px - 1023px`.
- Desktop: `>= 1024px`.
- Wide: `>= 1280px`.

### 17.2 Storefront

- Mobile first.
- Product cards: 2 columns on mobile if image/labels fit; 1 column for long names if needed.
- Cart/checkout: summary sticky on desktop, below form on mobile.
- Address autocomplete dropdown must not overflow viewport.

### 17.3 Dashboard

- Desktop: sidebar + dense table.
- Tablet/mobile: sidebar becomes drawer.
- Tables may horizontally scroll, but important action buttons stay visible.
- Metric cards grid:
  - mobile 1 column,
  - tablet 2 columns,
  - desktop 4 columns.

### 17.4 POS

- Preferred desktop/tablet.
- At `< 820px`, stack panels vertically.
- Barcode input remains visible above fold.
- Payment button always visible after totals.

### 17.5 Shipper

- Mobile is primary.
- Job cards should have large tap targets.
- `Chỉ đường`, `Gọi khách`, next state action must be visible without horizontal scroll.

---

## 18. Accessibility

Required:

- Every input has visible label.
- Icon-only buttons have `aria-label`.
- Focus state visible on buttons, links, form controls.
- Modal traps focus or at least focuses first input/action.
- Error message is tied to field by `aria-describedby` where practical.
- Loading buttons announce loading with text, not spinner only.
- Color is not the only state signal; badges need text.
- Contrast: text on green/dark backgrounds must meet readable contrast.
- Table row actions are keyboard reachable.
- POS barcode input auto-focus should not steal focus while modal is open.

---

## 19. Risk-Based UI Requirements

Based on `RISK_ANALYSIS_REPORT.md`, UI must help prevent or surface these risks.

| Risk | UI Requirement |
| --- | --- |
| Double submit checkout | Disable submit while creating order; show `Đang tạo đơn...`; prevent duplicate click |
| VNPay pending | Payment return and order detail must show pending/failed/success clearly |
| VNPay retry | Order detail pay button disabled while request pending |
| Stock changed | Checkout quote banner shows updated price/stock by address |
| Coupon invalid/exhausted | Coupon input displays inline error and removes discount |
| Order cancelled after payment | Order detail must show refund/manual support state if backend exposes it |
| POS double pay | Disable pay button while paying; backend error shown as already processed |
| POS QR manual | Two-step confirm for transfer/reference |
| POS return over quantity | UI must show sold qty and returned qty if available |
| Shipper COD | Completion modal requires COD collected confirmation |
| Warehouse export/adjust | Confirm modal + reason required |
| Delivery failed | Reason required; manager gets visible alert |
| Raw enum statuses | Map enum to Vietnamese labels |

---

## 20. Implementation Plan

### Phase 1: UI Foundation

Files likely touched:

- `frontend/src/styles/index.css`
- `frontend/src/dashboard/layout/dashboard.css`
- `frontend/src/dashboard/components/*`
- `frontend/src/components/ConfirmModal.tsx`
- `frontend/src/lib/format.ts`
- `frontend/src/dashboard/menu.ts`

Tasks:

- Normalize colors, spacing, typography.
- Add/upgrade shared Empty/Error/Loading components.
- Complete Vietnamese status labels.
- Replace empty menu icons with consistent symbols/components.
- Remove obvious non-accent text in shared components.

Acceptance:

- Internal pages still render.
- No build errors.
- `DataTable`, `StatusBadge`, `PageHeader`, `ConfirmModal` usable everywhere.

### Phase 2: Customer Storefront + Checkout

Files likely touched:

- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/home.css`
- `frontend/src/pages/ProductListPage.tsx`
- `frontend/src/pages/ProductDetailPage.tsx`
- `frontend/src/components/ProductCard.tsx`
- `frontend/src/pages/CartPage.tsx`
- `frontend/src/pages/CheckoutPage.tsx`
- `frontend/src/pages/PaymentReturnPage.tsx`
- `frontend/src/pages/OrdersPage.tsx`
- `frontend/src/pages/OrderDetailPage.tsx`
- related CSS files.

Acceptance:

- Customer can browse, cart, checkout, pay/COD.
- No manual store/region selection.
- Store auto-assignment copy is clear.
- Payment states are clear.
- Mobile storefront does not break.

### Phase 3: Admin + Manager

Files likely touched:

- `frontend/src/pages/admin/*`
- `frontend/src/dashboard/pages/AdminDashboard.tsx`
- `frontend/src/dashboard/pages/StoreManager*.tsx`
- `frontend/src/pages/admin/admin.css`

Acceptance:

- Admin sees chain-wide overview.
- Store manager sees store-scoped operations.
- Tables have filter/action states.
- Store/order/payment/inventory data is readable.

### Phase 4: Warehouse

Files likely touched:

- `frontend/src/dashboard/pages/WarehouseDashboard.tsx`
- `frontend/src/dashboard/pages/WarehousePick.tsx`
- `frontend/src/dashboard/pages/WarehouseInventory.tsx`
- `frontend/src/dashboard/pages/WarehouseTransactions.tsx`

Acceptance:

- Pick flow is clear.
- Import/export/adjust have reason and confirm.
- Transactions are readable for audit.

### Phase 5: POS

Files likely touched:

- `frontend/src/pos/POSTerminalPage.tsx`
- `frontend/src/pos/POSReturnsPage.tsx`
- `frontend/src/pos/components/*`
- `frontend/src/pos/pos.css`
- `frontend/src/pos/pos-returns.css`

Acceptance:

- Barcode input remains focused.
- Cash/QR/manual payment flow is clear.
- Receipt modal clear.
- Return/refund flow is manager-safe.
- POS works on tablet/desktop.

### Phase 6: Shipper + Support

Files likely touched:

- `frontend/src/dashboard/pages/ShipperDashboard.tsx`
- `frontend/src/pages/shipper/ShipperConsolePage.tsx`
- `frontend/src/dashboard/pages/StaffDashboard.tsx`
- `frontend/src/pages/support/SupportConsolePage.tsx`
- `frontend/src/pages/console.css`

Acceptance:

- Shipper active jobs are mobile-friendly.
- Map link and COD confirm are prominent.
- Delivery failed reason modal clear.
- Support remains functional if retained.

### Phase 7: Polish + QA

Tasks:

- Replace remaining non-accent text.
- Remove inline styles where they hurt consistency.
- Check mobile/desktop.
- Run build.
- Manual E2E smoke test.

Commands:

```bash
npm run build --workspace frontend
npm run build
```

---

## 21. Route-Level Acceptance Checklist

### Customer

- [ ] `/` has product-focused landing, no decorative-only hero.
- [ ] `/products` has search/filter/sort and product cards.
- [ ] `/products/:slug` supports add to cart and clear product info.
- [ ] `/cart` blocks checkout when stock issues exist.
- [ ] `/checkout` uses address only; no manual store selection.
- [ ] `/payment/vnpay/return` handles loading/success/failed/pending.
- [ ] `/orders` and `/orders/:id` show order/payment/delivery clearly.

### Admin

- [ ] Dashboard shows chain-wide metrics and alerts.
- [ ] Stores page manages internal stores, manager, shipper, staff.
- [ ] Orders page shows store/payment/delivery/filter.
- [ ] Products page supports variants/barcodes.
- [ ] Inventory page supports cross-store view.
- [ ] Users page supports roles and store scope.
- [ ] Reports and audit are readable.

### Store Manager/Staff

- [ ] Manager dashboard prioritizes action alerts.
- [ ] Manager orders support exception handling.
- [ ] Staff order queue supports confirm/prepare/pack.
- [ ] Staff cannot see marketplace/seller language.

### Warehouse

- [ ] Pick page works as checklist.
- [ ] Inventory actions require reason/confirm.
- [ ] Transactions support audit use.

### POS

- [ ] Barcode input always usable.
- [ ] POS payment disables double submit.
- [ ] QR/manual payment has confirmation.
- [ ] Receipt is clear.
- [ ] Returns require reason and manager flow.

### Shipper

- [ ] Active jobs mobile-friendly.
- [ ] Pickup/dropoff info clear.
- [ ] Directions button works.
- [ ] COD confirmation clear.
- [ ] Failed delivery requires reason.

---

## 22. Global Acceptance Criteria

- [ ] No customer manual store/region selection.
- [ ] No seller/marketplace UI in MVP path.
- [ ] Build passes.
- [ ] Customer can buy E2E.
- [ ] Admin/manager/staff/warehouse/shipper/POS all have coherent workflows.
- [ ] UI is visually consistent across customer and internal tools.
- [ ] Text is Vietnamese with diacritics.
- [ ] Responsive layout does not overlap or overflow incoherently.
- [ ] Payment/order/inventory states are visible and understandable.
- [ ] Risk-sensitive actions have disabled/loading/confirm states.
- [ ] No route is left with raw enum labels as primary user-facing text.
- [ ] POS remains optimized for speed.

---

## 23. Notes For AI Implementer

When using this spec to redesign `/frontend`:

1. Start with shared foundation before individual pages.
2. Keep API contracts unchanged unless backend work is explicitly requested.
3. Do not invent manual store picker.
4. Do not replace the app with a landing page only; keep full MVP workflows.
5. Prefer small scoped edits over wholesale rewrites.
6. Run build after each phase if possible.
7. If a page lacks API support for a desired UI state, show the best current state and document the backend gap instead of faking data.
