# Mobile Customer + Shipper Implementation Spec

Ngay tao: 2026-06-01

File nay duoc dat trong thu muc `/mobile` de khi mo IDE truc tiep tai `/mobile`, AI/code agent van co du boi canh va khong can doc file o parent folder.

Doc file nay nhu **source of truth cho mobile MVP**. Neu co thong tin khac ben ngoai repo parent ma ban khong thay, khong duoc doan bua; hay dua tren file nay va code hien co trong `/mobile`.

---

## 1. Muc Tieu

Xay dung mobile app cho **2 nhom user duy nhat trong MVP**:

1. **Customer**
   - Dang ky/dang nhap.
   - Nhap/chon dia chi giao hang.
   - App/backend tu resolve cua hang phu hop gan khach va co du hang.
   - Xem san pham, chi tiet san pham, gio hang.
   - Checkout COD/VNPay.
   - Xem danh sach don, chi tiet don, huy don neu duoc phep.
   - Theo doi trang thai giao hang.

2. **Shipper**
   - Dang nhap bang role `SHIPPER`.
   - Chi thay don da duoc backend gan cho minh.
   - Xem pickup store va dropoff customer.
   - Mo chi duong bang Google Maps/Apple Maps.
   - Goi khach/cua hang.
   - Cap nhat trang thai giao hang.
   - Xac nhan COD da thu du tien neu don COD.
   - Bao giao that bai kem ly do.

Khong lam trong mobile MVP:

- Admin mobile.
- Store Manager mobile.
- Store Staff mobile.
- Warehouse mobile.
- POS mobile.
- Seller marketplace.
- Manual customer store/region picker.
- Shipper offer/accept/bidding.
- In-app turn-by-turn navigation nhu Be/Grab. MVP dung external maps deep link.

---

## 2. Boi Canh Nghiep Vu Bat Buoc

Day la he thong ban nong san/thuc pham tuoi theo mo hinh **chuoi cua hang noi bo**, gan voi Bach Hoa Xanh.

Quy tac:

- Khong phai marketplace.
- Khong co seller doc lap.
- Khach hang khong tu chon store/khu vuc.
- Customer chi cung cap dia chi/GPS.
- Backend la source of truth de chon cua hang phu hop.
- Resolver backend chon store gan nhat co phuc vu va co du ton kho.
- Neu store gan nhat thieu hang, backend thu store gan tiep theo.
- MVP khong split mot don thanh nhieu store.
- Checkout mobile khong gui `storeId`, `price`, `shippingFee`, `discount`, `grandTotal` de backend tin.
- Checkout mobile chi gui `addressId`, `paymentMethod`, `couponCode`, `note`.
- Moi store co 1 shipper chinh; order cua store gan truc tiep cho shipper do.
- Shipper khong co flow nhan offer/reject offer.
- Shipper chi thao tac delivery duoc gan cho user dang nhap.

Wording UI:

- Dung tieng Viet co dau.
- Khong hien "seller", "shop nguoi ban", "chon khu vuc", "chon cua hang".
- Neu can hien store, chi hien thong tin: `Cua hang phu trach: {storeName}`.

---

## 3. Tech Stack Hien Co Trong `/mobile`

`package.json` hien co:

- Expo `~52.0.18`
- Expo Router `~4.0.11`
- React Native `0.76.5`
- React `18.3.1`
- TanStack Query
- Axios
- Zustand
- Expo Secure Store
- AsyncStorage
- Expo Location
- Expo Linking
- Expo Notifications
- React Native Maps
- React Native Safe Area Context

Scripts:

```bash
npm run start
npm run android
npm run ios
npm run web
npm run doctor
npm run typecheck
npm run lint
```

Khong them UI framework nang neu khong can. Uu tien dung component hien co trong `src/components/ui`.

---

## 4. Cau Truc Mobile Hien Tai

Hien co:

```text
app/
  _layout.tsx
  index.tsx
  (auth)/
    _layout.tsx
    login.tsx
    register.tsx
  (customer)/
    _layout.tsx
    home.tsx
    products.tsx
    cart.tsx
    product/[slug].tsx

src/
  components/
    customer/
      AddressResolverSheet.tsx
      StoreResolveBanner.tsx
    maps/
      DeliveryMap.tsx
    product/
      ProductCard.tsx
    ui/
      Badge.tsx
      Button.tsx
      Card.tsx
      Input.tsx
      SheetModal.tsx
      States.tsx
  lib/
    api/
      auth.api.ts
      cart.api.ts
      client.ts
      location.api.ts
      notifications.api.ts
      orders.api.ts
      products.api.ts
      queryClient.ts
      session.ts
      shipper.api.ts
      stores.api.ts
      users.api.ts
    auth/
      tokenStore.ts
    format/
      index.ts
      status.ts
    location/
      index.ts
    maps/
      navigation.ts
    notifications/
      index.ts
  store/
    auth.store.ts
    delivery.store.ts
  theme/
    index.ts
  types/
    index.ts
```

Dang thieu nhung da duoc route/layout tham chieu hoac can cho MVP:

```text
app/(customer)/checkout.tsx
app/(customer)/orders.tsx
app/(customer)/order/[id].tsx
app/(customer)/addresses.tsx
app/(customer)/account.tsx

app/(shipper)/_layout.tsx
app/(shipper)/jobs.tsx
app/(shipper)/history.tsx
app/(shipper)/job/[id].tsx
app/(shipper)/account.tsx

src/lib/api/payments.api.ts
src/components/order/*
src/components/shipper/*
src/components/customer/AddressCard.tsx
src/components/customer/CheckoutSummary.tsx
```

`app/index.tsx` hien da route shipper den `/(shipper)/jobs`, nen phai tao route group `(shipper)`.

---

## 5. API Contract Can Dung

Backend response envelope duoc unwrap boi `src/lib/api/client.ts`.

API helper hien tra ve `data` truc tiep, khong can component tu xu ly `{ success, data }`.

### 5.1 Auth

Da co `src/lib/api/auth.api.ts`:

```ts
POST /auth/login
POST /auth/register
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

User type:

```ts
interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  roles: RoleCode[];
  permissions: string[];
}
```

Mode:

- `customer`
- `shipper`

Nếu user co ca `CUSTOMER` va `SHIPPER`, app can co switch mode trong account/header.

### 5.2 Store Resolve

Da co `src/lib/api/stores.api.ts`:

```ts
POST /stores/resolve
```

Input:

```ts
{
  addressId?: string;
  lat?: number;
  lng?: number;
  province?: string;
  district?: string;
  ward?: string;
  cartItems?: { variantId: string; quantity: number }[];
}
```

Rule:

- Mobile duoc dung `selectedStore.storeId` lam context de xem product list.
- Mobile khong duoc coi storeId nay la source of truth khi checkout.
- Checkout backend se resolve lai theo `addressId`.

### 5.3 Products

Da co `src/lib/api/products.api.ts`:

```ts
GET /stores/:storeId/products
GET /stores/:storeId/products/:slug
```

Luu y:

- Product list hien theo store da auto resolve.
- Neu chua co store context, home/products phai mo sheet nhap dia chi/GPS.
- Khong tao UI chon store.

### 5.4 Cart

Da co `src/lib/api/cart.api.ts`:

```ts
GET    /cart
POST   /cart/items
PATCH  /cart/items/:id
DELETE /cart/items/:id
POST   /cart/revalidate
POST   /cart/checkout/quote
```

Luu y:

- `cartApi.addItem` hien co input `{ variantId, quantity, storeId? }`.
- Neu backend hien yeu cau `storeId` cho add cart context, chi gui storeId tu `deliveryStore.store.storeId` nhu context tam thoi.
- Checkout van khong gui storeId.

### 5.5 Orders

Da co `src/lib/api/orders.api.ts`:

```ts
POST /orders
GET  /orders
GET  /orders/:id
POST /orders/:id/cancel
```

Create input:

```ts
{
  addressId: string;
  paymentMethod: 'COD' | 'VNPAY';
  couponCode?: string;
  note?: string;
}
```

Can bo sung neu can:

```ts
POST /orders/:id/return
POST /orders/:id/reviews
```

Chi lam UI cho return/review neu API da co hoac helper duoc them ro rang. Neu backend khong support, ghi gap, khong fake success.

### 5.6 Payments

Can tao `src/lib/api/payments.api.ts`.

Expected endpoint:

```ts
POST /payments
```

Input:

```ts
{ orderId: string }
```

Output:

```ts
{ paymentUrl: string }
```

Mobile flow:

- Sau khi tao order VNPAY, goi `POST /payments`.
- Mo `paymentUrl` bang `Linking.openURL(paymentUrl)`.
- Sau khi user quay lai app, order detail phai refetch order.
- MVP khong bat buoc deep link callback hoan hao. Neu chua co app scheme tu backend, hien nut `Tôi đã thanh toán, kiểm tra lại đơn` de refetch.

### 5.7 Shipper

Da co `src/lib/api/shipper.api.ts`:

```ts
GET  /shipper/jobs?scope=active|history
GET  /shipper/jobs/:id
POST /shipper/jobs/:id/picked-from-store
POST /shipper/jobs/:id/out-for-delivery
POST /shipper/jobs/:id/arrived
POST /shipper/jobs/:id/delivered
POST /shipper/jobs/:id/failed
```

Delivered body:

```ts
{ codCollected?: boolean }
```

Failed body:

```ts
{ reason: string }
```

Shipper app khong co:

- accept job,
- reject job,
- bid job,
- browse all jobs.

---

## 6. Current Issues Can Fix Trong Mobile

1. Nhieu text khong dau:
   - `NongSan Xanh`
   - `San pham`
   - `Gio hang`
   - `Dang nhap`
   - `Mat khau`
   - `Don hang`
2. `app/(customer)/_layout.tsx` tham chieu routes chua ton tai: `orders`, `account`, `checkout`, `order/[id]`, `addresses`.
3. `app/index.tsx` route shipper den `/(shipper)/jobs` nhung chua co `(shipper)` group.
4. Home/products/cart da co auto resolve store nhung can polish UX va wording.
5. Checkout mobile chua co.
6. Order list/detail mobile chua co.
7. Shipper mobile chua co.
8. Payment VNPay mobile chua co.
9. Account screen/mode switch chua co.

---

## 7. Design System Mobile

Dung `src/theme/index.ts` lam source of truth.

Yeu cau:

- Touch target toi thieu 48px.
- Text tieng Viet co dau.
- Customer UI: sang, sach, san pham ro, khong qua nhieu card trang tri.
- Shipper UI: thuc dung, nut lon, thong tin dia chi ro, dung duoc khi dang di giao.
- Khong dung emoji lam icon chinh trong tab neu co the thay bang text/icon component don gian. Neu chua them icon library, co the giu emoji tam thoi nhung phai polish label co dau.
- Khong de text tran khoi button/card.
- Loading/empty/error state phai ro.

Can update labels:

```text
Trang chu    -> Trang chủ
San pham     -> Sản phẩm
Gio hang     -> Giỏ hàng
Don hang     -> Đơn hàng
Tai khoan    -> Tài khoản
Dang nhap    -> Đăng nhập
Mat khau     -> Mật khẩu
Dang tai     -> Đang tải
Xem tat ca   -> Xem tất cả
```

---

## 8. Customer App Requirements

### 8.1 Auth Screens

Files:

- `app/(auth)/login.tsx`
- `app/(auth)/register.tsx`

Requirements:

- Text co dau.
- Login supports customer and shipper account.
- Sau login, `app/index.tsx` dieu huong theo mode/role.
- If user has both roles, show account switch later.
- Error message tu API hien ro.
- Button disabled/loading while submitting.

Acceptance:

- Dang nhap customer -> `/(customer)/home`.
- Dang nhap shipper-only -> `/(shipper)/jobs`.
- Dang nhap both roles -> dung last mode; neu chua co, uu tien shipper nhu store hien tai.

### 8.2 Customer Tabs

File:

- `app/(customer)/_layout.tsx`

Tabs:

- `home`: Trang chủ
- `products`: Sản phẩm
- `cart`: Giỏ hàng
- `orders`: Đơn hàng
- `account`: Tài khoản

Hidden screens:

- `product/[slug]`
- `checkout`
- `order/[id]`
- `addresses`

Acceptance:

- Khong route loi do thieu file.
- Chua login bi redirect ve login.
- Shipper-only khong nen o customer tabs.

### 8.3 Home

File:

- `app/(customer)/home.tsx`

Current behavior da tot:

- Auto resolve default address -> GPS if permission granted -> show CTA.
- Product list by resolved store.

Required polish:

- Text co dau.
- Header:
  - `Nông Sản Xanh`
  - `Chào {name}` / `Chào bạn`
- Banner:
  - `Cửa hàng phù hợp: {storeName}`
  - `Hệ thống tự chọn theo địa chỉ và tồn kho`
  - action `Đổi địa chỉ`
- Empty:
  - `Nhập địa chỉ giao hàng để bắt đầu`
  - `Hệ thống sẽ tự chọn cửa hàng gần bạn có đủ hàng. Bạn không cần chọn khu vực.`
- Product section: `Sản phẩm nổi bật`

Do not:

- Add manual store picker.
- Show marketplace/seller language.

### 8.4 Address Resolver

Files:

- `src/components/customer/AddressResolverSheet.tsx`
- `src/components/customer/StoreResolveBanner.tsx`
- `src/store/delivery.store.ts`
- `src/lib/location/index.ts`
- `src/lib/api/location.api.ts`
- `src/lib/api/users.api.ts`

Requirements:

- User can select saved address.
- User can create address.
- User can use GPS.
- If using manual fallback, label it as address fallback, not "chon khu vuc".
- Resolve result must show store as informational.
- If not serviceable, show reason and ask user change address/reduce cart.
- Store context can be cached but must be revalidated at checkout.

Address UX:

- Required fields:
  - recipientName,
  - phone,
  - formatted address / line1,
  - lat/lng if geocoded,
  - deliveryNote optional.
- If GPS permission denied, provide manual address entry.
- Do not block app forever on GPS denial.

### 8.5 Products

Files:

- `app/(customer)/products.tsx`
- `app/(customer)/product/[slug].tsx`
- `src/components/product/ProductCard.tsx`
- `src/lib/api/products.api.ts`

Requirements:

- Products require resolved store context.
- Search with debounce.
- Product card:
  - image,
  - name,
  - unit,
  - price,
  - availability,
  - tap to detail.
- Product detail:
  - image carousel/simple image,
  - name,
  - price/unit,
  - origin/storage if available,
  - variant selector,
  - quantity stepper,
  - add to cart.
- Add to cart uses `cartApi.addItem`.
- If add fails due stock, show API error.

Important:

- `storeId` used in product API is display/browsing context only.
- Checkout backend still resolves source of truth.

### 8.6 Cart

File:

- `app/(customer)/cart.tsx`

Requirements:

- Text co dau.
- On focus, revalidate cart if `store` or `activeAddress`.
- Show warnings/blocking issues.
- Quantity update disabled while mutation pending.
- Remove item.
- Summary:
  - `Tạm tính`
  - note: `Phí giao hàng được tính ở bước thanh toán`
  - button `Tiến hành đặt hàng`
- If not logged in, route to login.
- If blocking issues, disable checkout.

Acceptance:

- Cart does not let user choose store.
- Cart shows if item quantity exceeds availability.

### 8.7 Checkout

Create:

- `app/(customer)/checkout.tsx`

Required sections:

1. Header: `Thanh toán`
2. Address selector:
   - default saved address,
   - change/add address,
   - open `AddressResolverSheet` or route `addresses`.
3. Quote:
   - call `cartApi.checkoutQuote({ addressId, paymentMethod, couponCode })`.
   - show selected store info as read-only.
   - show serviceable / not serviceable.
4. Payment method:
   - COD
   - VNPay
5. Coupon:
   - input coupon code,
   - apply by refetching quote.
6. Order summary:
   - item count,
   - subtotal,
   - shippingFee,
   - discount,
   - grandTotal.
7. Note:
   - delivery note/order note.
8. Submit:
   - Disable while placing.
   - If quote not serviceable, disable.

Submit flow:

```ts
const order = await ordersApi.create({
  addressId,
  paymentMethod,
  couponCode: couponCode || undefined,
  note: note || undefined,
});

if (paymentMethod === 'VNPAY') {
  const pay = await paymentsApi.create(order.id);
  await Linking.openURL(pay.paymentUrl);
  router.replace({ pathname: '/(customer)/order/[id]', params: { id: order.id } });
} else {
  router.replace({ pathname: '/(customer)/order/[id]', params: { id: order.id } });
}
```

Must not send:

```ts
storeId
price
shippingFee
discountTotal
grandTotal
items
```

Risk guards:

- Prevent double submit with `placing`.
- If quote refetching, show loading.
- If coupon invalid, show inline error.
- If address has no lat/lng and backend rejects, tell user choose address suggestion/GPS again.

### 8.8 Orders List

Create:

- `app/(customer)/orders.tsx`

Requirements:

- Fetch `ordersApi.list()`.
- Pull to refresh.
- Empty state: `Bạn chưa có đơn hàng nào`.
- Order card:
  - orderNumber,
  - status label,
  - payment method/status,
  - store name if exists,
  - created date,
  - grandTotal,
  - CTA `Xem chi tiết`.
- Filter optional P2:
  - all,
  - active,
  - completed/cancelled.

### 8.9 Order Detail

Create:

- `app/(customer)/order/[id].tsx`

Requirements:

- Fetch `ordersApi.detail(id)`.
- Sections:
  - status header,
  - payment summary,
  - delivery address,
  - store responsible,
  - items,
  - order timeline,
  - delivery timeline,
  - actions.

Actions:

- If `paymentMethod === 'VNPAY' && paymentStatus !== 'SUCCESS' && status !== 'CANCELLED'`:
  - button `Thanh toán lại`
  - call `paymentsApi.create(order.id)` and open URL.
- If status cancellable:
  - button `Hủy đơn`
  - confirm modal/input reason.
  - call `ordersApi.cancel`.
- If delivered/completed:
  - review/return P2 only if API available.

Payment return mobile:

- Since VNPay opens external browser/app, order detail should have:
  - `Tôi đã thanh toán, kiểm tra lại`
  - refetch order.

### 8.10 Addresses

Create:

- `app/(customer)/addresses.tsx`

Requirements:

- List saved addresses.
- Add/edit/delete address.
- Set default if API supports via update.
- Use geocode/GPS if available.
- No manual store picker.

If full address CRUD is too big, MVP minimum:

- List addresses.
- Add address using existing `AddressResolverSheet`.
- Delete optional.

### 8.11 Account

Create:

- `app/(customer)/account.tsx`

Requirements:

- Show user name/email/roles.
- Buttons:
  - `Địa chỉ giao hàng`
  - `Đơn hàng của tôi`
  - `Đăng xuất`
- If user has both customer and shipper roles:
  - show `Chuyển sang giao hàng`
  - call `useAuthStore.setMode('shipper')`
  - `router.replace('/(shipper)/jobs')`
- If shipper-only somehow reaches account, still allow switch/logout.

---

## 9. Shipper App Requirements

### 9.1 Route Group

Create:

```text
app/(shipper)/_layout.tsx
app/(shipper)/jobs.tsx
app/(shipper)/history.tsx
app/(shipper)/job/[id].tsx
app/(shipper)/account.tsx
```

Layout:

- Use Tabs.
- Tabs:
  - `jobs`: Đang giao
  - `history`: Lịch sử
  - `account`: Tài khoản
- Protect route:
  - if no user -> login
  - if user roles does not include `SHIPPER` -> redirect customer home or show forbidden

### 9.2 Jobs List

Create:

- `app/(shipper)/jobs.tsx`

Data:

```ts
shipperApi.jobs('active')
```

Card fields:

- order number,
- delivery status,
- pickup store name,
- pickup address,
- dropoff customer,
- dropoff phone,
- dropoff address,
- distance,
- COD amount if any,
- item summary if available.

Actions on card:

- `Chi tiết`
- `Chỉ đường`
- `Gọi khách`
- Main next-state action:
  - ASSIGNED -> `Đã lấy hàng`
  - PICKED_FROM_STORE -> `Bắt đầu giao`
  - OUT_FOR_DELIVERY -> `Đã đến nơi` and `Giao thành công`
  - ARRIVED_AT_CUSTOMER -> `Giao thành công`
- `Giao thất bại` only when appropriate.

Touch UX:

- Buttons large.
- COD amount highlighted.
- Address copy wraps cleanly.

### 9.3 Job Detail

Create:

- `app/(shipper)/job/[id].tsx`

Data:

```ts
shipperApi.job(id)
```

Sections:

1. Status header.
2. Pickup:
   - store name,
   - address,
   - phone,
   - map/direct button.
3. Dropoff:
   - customer name,
   - phone,
   - address,
   - map/direct button,
   - call button.
4. Items:
   - product name,
   - quantity,
   - unit.
5. Payment:
   - COD amount,
   - COD collected.
6. Timeline/events if backend returns delivery events.
7. Actions.

### 9.4 Shipper State Actions

Use `src/lib/api/shipper.api.ts`.

State action rules:

| Current status | Primary action | API |
| --- | --- | --- |
| `ASSIGNED` | `Đã lấy hàng` | `pickedFromStore(id)` |
| `PICKED_FROM_STORE` | `Bắt đầu giao` | `outForDelivery(id)` |
| `OUT_FOR_DELIVERY` | `Đã đến nơi` | `arrived(id)` |
| `OUT_FOR_DELIVERY` | `Giao thành công` | `delivered(id, codCollected?)` |
| `ARRIVED_AT_CUSTOMER` | `Giao thành công` | `delivered(id, codCollected?)` |
| `OUT_FOR_DELIVERY` / `ARRIVED_AT_CUSTOMER` | `Giao thất bại` | `failed(id, reason)` |

COD rule:

- If `job.codAmount > 0` or order payment method COD:
  - before calling delivered, open modal:
    - Show amount in large text.
    - Ask `Bạn đã thu đủ tiền COD chưa?`
    - Buttons:
      - `Đã thu đủ tiền`
      - `Chưa thu được tiền`
  - Call `shipperApi.delivered(id, true)` only when collected.
  - If user picks not collected:
    - either call `delivered(id, false)` and show backend error if backend rejects,
    - or route to failed modal depending backend behavior.

Failed rule:

- Modal/sheet must require reason length >= 3.
- Suggested reasons:
  - Khách không nghe máy
  - Sai địa chỉ
  - Khách hẹn giao lại
  - Khách từ chối nhận
  - Không thu được COD

### 9.5 Maps / Navigation

Use existing:

- `src/lib/maps/navigation.ts`
- `openExternalNavigation(lat, lng, label?)`
- `callPhone(phone)`

MVP:

- Do not implement full turn-by-turn in app.
- Do not track background location.
- Do not show Be/Grab-style live route unless simple map preview already easy.
- Use external maps.

If coordinates missing:

- If phone exists, allow call.
- For direction, if current helper requires lat/lng, either:
  - disable direction with message `Đơn chưa có tọa độ giao hàng`, or
  - extend helper to open address query via URL.

### 9.6 History

Create:

- `app/(shipper)/history.tsx`

Data:

```ts
shipperApi.jobs('history')
```

Show:

- delivered/failed deliveries,
- order number,
- final status,
- customer area,
- COD amount,
- failure reason if any,
- deliveredAt if available.

### 9.7 Shipper Account

Create:

- `app/(shipper)/account.tsx`

Requirements:

- Show user name/email.
- Role: Shipper.
- Buttons:
  - `Làm mới phiên đăng nhập` optional.
  - `Chuyển sang mua hàng` if user has customer role.
  - `Đăng xuất`.

Switch customer:

```ts
useAuthStore.getState().setMode('customer')
router.replace('/(customer)/home')
```

---

## 10. Shared Components Nen Tao/Polish

### 10.1 UI Components

Existing:

- `Button`
- `Input`
- `Card`
- `Badge`
- `SheetModal`
- `States`

Enhance if needed:

- `Button` supports disabled/loading/large/variant.
- `Badge` supports order/delivery/payment variants.
- `States` supports loading/empty/error with action.

### 10.2 Customer Components

Suggested:

```text
src/components/customer/AddressCard.tsx
src/components/customer/CheckoutSummary.tsx
src/components/customer/PaymentMethodSelector.tsx
src/components/order/OrderCard.tsx
src/components/order/OrderTimeline.tsx
```

### 10.3 Shipper Components

Suggested:

```text
src/components/shipper/DeliveryJobCard.tsx
src/components/shipper/DeliveryActionPanel.tsx
src/components/shipper/CodConfirmSheet.tsx
src/components/shipper/FailReasonSheet.tsx
src/components/shipper/AddressActionRow.tsx
```

Keep components practical. Do not over-abstract before screens work.

---

## 11. Status And Formatting

Use/extend:

- `src/lib/format/index.ts`
- `src/lib/format/status.ts`

Required labels:

Order status:

```text
PENDING_PAYMENT    Chờ thanh toán
PLACED             Đã đặt hàng
STORE_CONFIRMED    Cửa hàng đã xác nhận
PICKING            Đang soạn hàng
PACKED             Đã đóng gói
READY_FOR_DELIVERY Sẵn sàng giao
OUT_FOR_DELIVERY   Đang giao
DELIVERED          Đã giao
COMPLETED          Hoàn tất
CANCELLED          Đã hủy
DELIVERY_FAILED    Giao thất bại
RETURN_REQUESTED   Đang yêu cầu trả hàng
RETURNED           Đã trả hàng
```

Delivery status:

```text
ASSIGNED            Đã gán
PICKED_FROM_STORE   Đã lấy hàng
OUT_FOR_DELIVERY    Đang giao
ARRIVED_AT_CUSTOMER Đã đến nơi
DELIVERED           Đã giao
FAILED              Giao thất bại
```

Payment status:

```text
INITIATED  Đã khởi tạo
PENDING    Đang chờ
SUCCESS    Đã thanh toán
FAILED     Thất bại
REFUNDED   Đã hoàn tiền
```

Money:

- Always VND.
- Use `formatVnd`.
- Do not show raw `100000` without formatting.

Quantity:

- Use `formatQty`.
- Support decimal quantity for weight products if type allows.

---

## 12. Notifications

Package exists:

- `expo-notifications`

MVP minimum:

- Keep notification setup best-effort.
- Do not block core app if push permission denied.
- Customer may receive order updates later.
- Shipper may receive new job updates later.

If implementing push:

- Ask permission after login, not before.
- Register token endpoint only if backend helper already exists.
- If backend API missing, document gap.

---

## 13. Security / Data Rules

- Tokens stored via SecureStore helper, not AsyncStorage.
- Do not log accessToken/refreshToken.
- Do not log customer phone/address in console.
- Shipper can see phone/address only in assigned jobs from backend.
- Do not bypass backend role checks.
- Do not fake role by local state.
- On refresh failure, clear tokens and route login.
- API errors should show user-friendly message, not raw stack.

---

## 14. Implementation Plan

### Phase 1: Stabilize Existing Mobile

Tasks:

- Fix all missing routes referenced by layouts.
- Fix Vietnamese labels in auth/customer existing screens.
- Ensure `npm run typecheck` passes.
- Ensure `app/index.tsx` can route both customer and shipper.

Files likely touched:

```text
app/index.tsx
app/(auth)/login.tsx
app/(auth)/register.tsx
app/(customer)/_layout.tsx
app/(customer)/home.tsx
app/(customer)/products.tsx
app/(customer)/cart.tsx
src/lib/format/status.ts
```

### Phase 2: Customer Core E2E

Tasks:

- Product detail add to cart polish.
- Cart polish.
- Checkout screen.
- Payment helper.
- Orders list.
- Order detail.
- Account and addresses.

Acceptance:

- Customer can login -> resolve address/store -> browse -> add cart -> checkout COD.
- Customer can create VNPay order and open payment URL.
- Customer can view order detail and retry payment/refetch status.

### Phase 3: Shipper Core E2E

Tasks:

- Create `(shipper)` route group.
- Jobs list active.
- Job detail.
- State action buttons.
- COD confirm sheet.
- Failed reason sheet.
- History.
- Account/mode switch.

Acceptance:

- Shipper can login -> see assigned jobs -> open map -> update statuses -> mark delivered/failed.
- Shipper cannot see offer/bidding UI.

### Phase 4: Polish + Verification

Tasks:

- Loading/empty/error states.
- Pull-to-refresh.
- Disable duplicate submit.
- Consistent spacing/touch targets.
- Typecheck.
- Expo doctor.
- Android/iOS smoke if possible.

---

## 15. Required Commands

Run from `/mobile`:

```bash
npm run typecheck
npm run doctor
npm run lint
```

If environment supports simulator:

```bash
npm run android
npm run ios
```

If cannot run Android/iOS, report clearly why.

---

## 16. Acceptance Checklist

### Customer

- [ ] Login/register text has Vietnamese diacritics.
- [ ] Customer tab routes do not crash.
- [ ] Home auto resolves default address/GPS or asks for address.
- [ ] No manual store/region picker exists.
- [ ] Store banner is informational only.
- [ ] Products list requires resolved store context.
- [ ] Product detail can add to cart.
- [ ] Cart can update/remove items and shows blocking issues.
- [ ] Checkout sends only allowed fields.
- [ ] Checkout disables double submit.
- [ ] COD order can be created.
- [ ] VNPay payment URL can be opened.
- [ ] Orders list works.
- [ ] Order detail works.
- [ ] Payment retry/refetch works.
- [ ] Account logout works.
- [ ] Customer with shipper role can switch to shipper mode.

### Shipper

- [ ] `(shipper)` route group exists.
- [ ] Shipper-only login routes to `/(shipper)/jobs`.
- [ ] Active jobs list loads assigned jobs.
- [ ] Job detail shows pickup/dropoff/COD/items.
- [ ] Direction button opens maps when coordinates available.
- [ ] Call button opens phone dialer when phone available.
- [ ] Status transitions call correct API.
- [ ] COD delivery requires confirmation.
- [ ] Failed delivery requires reason.
- [ ] History list works.
- [ ] Shipper account logout works.
- [ ] Shipper with customer role can switch to customer mode.
- [ ] No accept/reject/offer/bidding UI exists.

### Quality

- [ ] `npm run typecheck` passes.
- [ ] `npm run doctor` checked or failure documented.
- [ ] No raw enum labels in primary UI.
- [ ] No token/PII console logs.
- [ ] Touch targets are usable on mobile.
- [ ] Pull-to-refresh on list screens.
- [ ] Loading/empty/error states exist for async screens.

---

## 17. Output Report Required From AI Implementer

After implementation, respond with:

```markdown
# Mobile Customer + Shipper Report

## Summary
What was implemented.

## Files Changed
Main files changed/created.

## Customer Flow
What works E2E.

## Shipper Flow
What works E2E.

## Commands Run
Commands and pass/fail.

## Remaining Gaps
Only real gaps, especially if backend API or deep link setup is missing.
```

---

## 18. Important Warnings

- Do not work on backend from this `/mobile` IDE context.
- Do not assume parent markdown files are available.
- Do not create admin/manager/POS mobile screens.
- Do not add marketplace/seller concepts.
- Do not add manual store selection.
- Do not fake payment success after opening VNPay.
- Do not fake delivery status without calling shipper API.
- Do not ignore TypeScript errors.
