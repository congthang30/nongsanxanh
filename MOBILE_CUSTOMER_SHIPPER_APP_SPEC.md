# NongSan Xanh Mobile App Spec - Customer & Shipper

Ngay tao: 2026-05-31

## 0. Muc dich

File nay dinh nghia pham vi mobile app Android/iOS cho giai doan hien tai.

Source of truth lien quan:

- `BACH_HOA_XANH_STORE_MVP_SPEC.md`: mo hinh chuoi cua hang theo khu vuc.
- `STORE_POS_CHECKOUT_SPEC.md`: POS tai quay, chi de tham chieu. Mobile phase nay khong lam POS.

Quyet dinh pham vi:

```text
Mobile app giai doan nay chi code cho:
1. Customer - nguoi mua hang
2. Shipper - nguoi giao hang cua cua hang
```

Khong code mobile cho cac role sau trong phase nay:

- Admin
- Store Manager
- Store Staff
- Warehouse Staff
- Cashier/POS
- Support

Ly do:

- Customer can app de mua hang nhanh, nhan thong bao, theo doi don.
- Shipper can app tren dien thoai de xem dia chi, goi khach, xem ban do, cap nhat trang thai giao hang.
- Admin/manager/staff/warehouse/POS phu hop web dashboard hoac app rieng sau.

## 1. Ket luan san pham

App mobile can co 2 che do chinh:

```text
Customer mode:
  Khach mua hang, he thong tu tinh cua hang gan nhat co du hang dua tren dia chi/GPS.

Shipper mode:
  Shipper xem job duoc gan truc tiep, lay hang tai cua hang, dung ban do/chi duong de giao cho khach.
```

Quan trong:

- Customer khong chon khu vuc/cua hang thu cong.
- Backend la source of truth cho store assignment.
- Store gan nhat khong du hang thi backend/resolver phai thu store gan tiep theo.
- Shipper khong co offer/accept/reject.
- Shipper chi thay delivery/job da gan cho minh.
- Shipper can trai nghiem ban do/chi duong gan giong Be/Grab o muc MVP.

## 2. Tech stack khuyen nghi

### 2.1 Lua chon mac dinh

Dung:

- React Native + Expo
- TypeScript
- Expo Router hoac React Navigation
- TanStack Query cho server state
- Zustand cho local app state neu can
- Axios/fetch API client rieng
- Expo SecureStore cho token
- Expo Location cho GPS
- Expo Notifications cho push
- React Native Maps cho map preview
- Linking API de mo Google Maps/Apple Maps

Ly do:

- Du an frontend hien tai dung React/TypeScript, de tai su dung skill va patterns.
- Expo giup chay Android/iOS nhanh hon.
- Shipper can GPS/camera/push/map, Expo ho tro kha tot.

### 2.2 Ban do va chi duong

MVP khuyen nghi:

```text
In-app:
  Hien map preview, marker cua hang, marker khach, route polyline neu backend/map API co.

Navigation:
  Mo Google Maps tren Android.
  Mo Apple Maps hoac Google Maps tren iOS.
```

Khong nen tu code turn-by-turn navigation day du trong MVP vi:

- Can Directions API/Mapbox/Google billing.
- Can xu ly reroute, background GPS, battery, voice guidance.
- De phat sinh phuc tap lon.

Phase sau co the lam:

- In-app live route nhu Be/Grab.
- Background location tracking.
- Customer xem shipper di chuyen realtime.
- ETA realtime.
- Route optimization.

## 3. Platform requirements

### 3.1 Android

Can cau hinh:

- Package name, vi du: `com.nongsanxanh.mobile`
- Location permission:
  - foreground location
  - background location neu phase sau co tracking realtime
- Notification permission Android 13+
- Internet permission
- Maps API key neu dung Google Maps SDK

### 3.2 iOS

Can cau hinh:

- Bundle identifier, vi du: `com.nongsanxanh.mobile`
- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription` chi neu dung background tracking
- `NSUserNotificationUsageDescription`
- Maps config neu dung Google Maps SDK

### 3.3 Moi truong

Can co:

```text
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_MAP_PROVIDER=google|apple|mapbox
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

Khong hardcode API URL trong component.

## 4. App architecture

Folder de xuat:

```text
mobile/
  app/
    (auth)/
    (customer)/
    (shipper)/
    _layout.tsx
  src/
    components/
      ui/
      maps/
      order/
      product/
    features/
      auth/
      customer/
      shipper/
      location/
      orders/
      products/
      cart/
    lib/
      api/
      auth/
      location/
      maps/
      format/
      permissions/
    store/
    theme/
    types/
```

Layering:

- Screen chi render va dieu phoi.
- API call nam trong `src/lib/api` hoac feature service.
- Business logic store resolver client-side chi la request backend, khong tu quyet store.
- Token/session nam trong auth layer.
- Permission/GPS logic nam trong location layer.
- Map/navigation deep link nam trong maps layer.

## 5. Authentication va role routing

### 5.1 Login

App can:

- Login bang email/phone + password.
- Luu access token/refresh token trong SecureStore.
- Load profile khi app open.
- Xu ly 401:
  - refresh token neu co
  - neu fail thi logout

### 5.2 Role routing

Sau login:

```text
if user has SHIPPER:
  route -> shipper home
else:
  route -> customer home
```

Neu user co ca CUSTOMER va SHIPPER:

- Hien switch mode trong account.
- Mac dinh vao role gan day nhat.

Khong route vao admin/manager/staff/warehouse/POS trong app phase nay.

### 5.3 Guest customer

Cho phep guest:

- Xem home/catalog.
- Dung GPS/nhap dia chi de resolve store.
- Them gio neu backend ho tro session cart.

Bat login khi:

- Checkout.
- Xem don.
- Luu dia chi.

## 6. Customer mobile scope

### 6.1 Customer screens

Bat buoc:

- Splash/session loading.
- Login/register.
- Home.
- Product list.
- Product detail.
- Cart.
- Checkout.
- Address form/select.
- Orders list.
- Order detail/tracking.
- Account/profile.
- Notification list neu API co.

Khong bat buoc phase nay:

- POS.
- Admin dashboard.
- Store manager dashboard.
- Warehouse dashboard.

### 6.2 Customer location flow

Nguyen tac:

- Khong bat customer chon khu vuc/cua hang.
- Khach chi cung cap dia chi/GPS.
- Backend tu tinh `autoAssignedStore`.

Flow:

```text
App open
  -> load session
  -> if logged in and has default address:
       call POST /stores/resolve with addressId
  -> else:
       ask foreground location permission
       if granted:
          get lat/lng
          call POST /stores/resolve with lat/lng
       else:
          show manual address input CTA
```

Manual fallback:

```text
Customer nhap dia chi
  -> geocode neu backend ho tro
  -> POST /stores/resolve
  -> save temporary delivery context
```

Checkout:

```text
Customer confirms final delivery address
  -> app calls POST /cart/checkout/quote
  -> backend re-runs resolver
  -> backend returns autoAssignedStore + candidates/rejectedCandidates
  -> app shows fulfillment result
  -> customer places order
```

Client khong duoc:

- Tu gan storeId cho order.
- Cho customer ep chon store.
- Tin GPS la dia chi checkout neu customer chon dia chi khac.

### 6.3 Customer store messaging

UI nen noi:

```text
Giao tu cua hang gan nhat co du hang
```

Khong nen noi:

```text
Chon khu vuc
Chon cua hang
```

Neu store gan nhat thieu hang nhung store gan tiep theo du hang:

```text
Mot so san pham khong du tai cua hang gan nhat.
He thong se xu ly don tu cua hang gan tiep theo co du hang.
```

Neu khong co store nao du hang:

```text
Hien tai chua co cua hang nao du hang cho gio nay.
Ban co the giam so luong hoac xoa san pham het hang.
```

### 6.4 Product browsing

Product list request can kem delivery context:

```text
GET /products?lat=&lng=
GET /products?addressId=
GET /products?storeId=autoAssignedStore.id
```

Khuyen nghi:

- App goi `/stores/resolve` truoc.
- Sau do goi product list theo `autoAssignedStore.id`.
- StoreId o product list chi la context hien thi, checkout van phai resolve lai.

Product card:

- Ten san pham.
- Anh.
- Gia.
- Don vi.
- Trang thai con hang theo fulfillment store.
- Badge "Co the giao".

Product detail:

- Gia theo store.
- Ton kha dung.
- Variant.
- So luong.
- Add to cart.
- Neu het hang tai toan bo candidate stores thi disable add.

### 6.5 Cart

Cart one-store theo backend assignment.

App can:

- Hien item.
- Sua quantity.
- Xoa item.
- Revalidate khi:
  - doi dia chi
  - app resume sau thoi gian dai
  - truoc checkout

Neu revalidate doi fulfillment store:

```text
Dia chi/gio hang hien tai se duoc xu ly boi cua hang khac co du hang.
```

Neu item khong fulfill duoc:

- Hien item loi.
- Goi y giam so luong.
- Goi y xoa item.

### 6.6 Checkout

Checkout screens:

- Address confirmation.
- Fulfillment store info.
- Delivery fee/ETA.
- Payment method.
- Order summary.
- Place order.

Payment MVP:

- COD.
- VNPay/online neu backend co.

Rules:

- Always call quote before place order.
- Place order payload chi gui address/payment/note/coupon.
- Khong gui storeId nhu source of truth.

### 6.7 Order tracking for customer

Order detail can show:

- Order status.
- Fulfillment store name.
- Delivery status.
- Shipper status, neu da gan.
- ETA neu co.
- Timeline.
- Call store/hotline.
- Call shipper khi order dang giao, neu policy cho phep.
- Map preview optional khi shipper out for delivery.

Privacy:

- Customer chi xem shipper location khi delivery status tu `OUT_FOR_DELIVERY` den `DELIVERED/FAILED`.
- Khong hien location shipper ngoai active delivery.

## 7. Shipper mobile scope

### 7.1 Shipper screens

Bat buoc:

- Shipper home/jobs list.
- Job detail.
- Pickup step.
- Delivery step.
- Map/navigation screen.
- Failed delivery reason modal.
- COD confirmation.
- Delivery history.
- Account/status.

Khong co:

- Offer list.
- Accept offer.
- Reject offer.
- Bid/auction.
- Chon don tu do.

### 7.2 Shipper job model

Shipper job = delivery da gan truc tiep.

API can return:

```text
DeliveryJob
- id
- orderId
- orderNumber
- status
- storeId
- storeName
- pickupAddress
- pickupLat
- pickupLng
- pickupPhone
- customerName
- customerPhone
- dropoffAddress
- dropoffLat
- dropoffLng
- paymentMethod
- codAmount
- distanceKm
- etaText
- itemsSummary
```

### 7.3 Shipper status flow

Delivery statuses:

```text
ASSIGNED
PICKED_FROM_STORE
OUT_FOR_DELIVERY
ARRIVED_AT_CUSTOMER
DELIVERED
FAILED
```

Screen actions:

```text
ASSIGNED:
  - Xem don moi
  - Mo ban do den cua hang
  - Button: Da lay hang tu cua hang

PICKED_FROM_STORE:
  - Mo ban do den khach
  - Button: Bat dau giao

OUT_FOR_DELIVERY:
  - Mo navigation
  - Button: Da den noi
  - Button: Giao that bai

ARRIVED_AT_CUSTOMER:
  - Xac nhan COD neu co
  - Button: Giao thanh cong
  - Button: Giao that bai

DELIVERED/FAILED:
  - Read-only
```

### 7.4 Map/navigation UX kieu Be/Grab

MVP screen can gom:

- Full map.
- Pickup/dropoff markers.
- Current shipper location marker.
- Bottom sheet hien:
  - order number
  - customer name
  - address
  - phone button
  - COD amount
  - next action button
- Button "Mo Google Maps" / "Mo Apple Maps".
- Button refresh location.

MVP navigation behavior:

```text
Shipper taps "Chi duong"
  -> Android: open Google Maps with destination lat/lng
  -> iOS:
      if Google Maps installed: open Google Maps
      else open Apple Maps
```

Deep link examples:

```text
Google Maps:
https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=driving

Apple Maps:
http://maps.apple.com/?daddr={lat},{lng}&dirflg=d
```

In-app route polyline:

- Optional in MVP.
- Neu backend co directions API, draw route polyline.
- Neu khong co, show straight line hoac chi markers + external navigation.

### 7.5 Shipper live location

MVP:

- Lay foreground location khi shipper mo job/map.
- Gui location len backend khi:
  - shipper bam action status
  - shipper mo map va app foreground, interval 15-30 giay neu permission cho phep
- Khong bat buoc background tracking.

Phase sau:

- Background location tracking trong active delivery.
- Customer xem shipper di chuyen realtime.
- ETA update realtime.
- Geofence den cua hang/den khach.

API de xuat:

```text
POST /shipper/location
body: { deliveryId, lat, lng, accuracy, heading, speed, recordedAt }
```

Privacy:

- Chi track khi shipper co active delivery.
- Hien indicator "Dang chia se vi tri cho don giao".
- Dung khi delivery delivered/failed.
- Khong track shipper ca ngay neu khong co job.

Battery:

- Foreground interval 15-30s.
- Background phase sau can adaptive interval.
- Stop watcher khi roi man hinh job neu khong can tracking.

### 7.6 COD flow

Neu paymentMethod = COD:

- Job card hien codAmount ro.
- Khi `ARRIVED_AT_CUSTOMER`, truoc `DELIVERED` phai confirm:
  - "Da thu COD?"
  - amount collected
- Neu amount collected khac codAmount:
  - can reason
  - can manager/admin review sau

Neu da thanh toan online:

- Hien "Da thanh toan online".
- Khong hien thu COD.

### 7.7 Failed delivery

Button "Giao that bai" mo modal:

Required:

- Reason dropdown:
  - Khach khong nghe may
  - Khach hen giao lai
  - Sai dia chi
  - Khach tu choi nhan
  - Khong thu du COD
  - Hang bi su co
  - Khac
- Note text.
- Optional photo proof phase sau.

No browser/native prompt.

After submit:

- Delivery status = FAILED.
- Order status = DELIVERY_FAILED.
- Notify customer/store manager/admin if needed.

## 8. Permissions

### 8.1 Customer

Location:

- Ask only when needed.
- If denied, manual address input remains.
- Do not block browsing catalog, but block checkout until final address confirmed.

Notifications:

- Ask after login or after first order, not immediately on first launch.

### 8.2 Shipper

Location:

- Required for map/navigation helper.
- If denied:
  - still allow open external navigation to destination
  - warn that live location/ETA cannot update

Notifications:

- Required for new assigned jobs/status updates.

Phone:

- Use `tel:` link to call customer/store.

## 9. API contracts de xuat

### 9.1 Customer APIs

```text
POST /stores/resolve
body:
{
  addressId?: string,
  lat?: number,
  lng?: number,
  province?: string,
  district?: string,
  ward?: string,
  cartItems?: [{ variantId: string, quantity: number }]
}
return:
{
  autoAssignedStore: Store | null,
  candidates: StoreCandidate[],
  rejectedCandidates: RejectedCandidate[],
  reason: string,
  serviceable: boolean,
  inventoryWarnings: InventoryWarning[]
}

POST /cart/revalidate
body: { addressId?: string, lat?: number, lng?: number }
return: { autoAssignedStore, cart, warnings, blockingIssues }

POST /cart/checkout/quote
body: { addressId: string, paymentMethod: string, couponCode?: string }
return: { autoAssignedStore, shippingFee, etaText, totals, warnings }

POST /orders
body: { addressId: string, paymentMethod: string, note?: string, couponCode?: string }
return: { order }
```

### 9.2 Shipper APIs

```text
GET /shipper/jobs?status=active
GET /shipper/jobs/:id
POST /shipper/jobs/:id/picked-from-store
POST /shipper/jobs/:id/out-for-delivery
POST /shipper/jobs/:id/arrived
POST /shipper/jobs/:id/delivered
body optional: { codCollectedAmount?: number, note?: string }
POST /shipper/jobs/:id/failed
body: { reason: string, note?: string }
POST /shipper/location
body: { deliveryId: string, lat: number, lng: number, accuracy?: number, heading?: number, speed?: number, recordedAt: string }
```

## 10. Navigation structure

### 10.1 Customer tabs

```text
Home
Search/Products
Cart
Orders
Account
```

### 10.2 Shipper tabs

```text
Jobs
Map/Active
History
Account
```

Neu shipper co active job, app nen hien quick access:

```text
Active delivery bottom bar:
  Order #...
  Next stop
  Open map
  Next action
```

## 11. UI design requirements

General:

- Mobile-first.
- Safe area.
- Large touch targets.
- Text khong tran.
- Loading/empty/error states.
- Pull to refresh cho list.
- Retry khi network error.
- Confirm modal cho dangerous actions.

Customer:

- Dia chi/GPS la dau vao, khong co dropdown chon khu vuc.
- Store fulfillment hien nhu thong tin he thong tu tinh.
- Product card ro gia, don vi, availability.
- Checkout ro store, ETA, shipping fee.

Shipper:

- Mot man hinh job detail phai doc duoc khi dang di duong.
- Button call/map/action lon.
- COD amount noi bat.
- Failed delivery modal ro ly do.
- Map bottom sheet khong che het route.

## 12. Data va state trong app

Can luu local:

```text
auth session
last role/mode
last resolved delivery context
cart summary cache
shipper active job cache
```

Khong luu local:

- Store assignment lam source of truth checkout.
- Payment status.
- Delivery status.

Backend luon la source of truth.

## 13. Push notifications

Customer:

- Order confirmed.
- Packed/ready.
- Out for delivery.
- Delivered.
- Delivery failed.

Shipper:

- New assigned job.
- Job changed/cancelled.
- Customer/order note updated.

Deep link:

```text
nongsanxanh://orders/:id
nongsanxanh://shipper/jobs/:id
```

## 14. Security va privacy

- Token luu SecureStore, khong AsyncStorage plain.
- API client handle 401.
- Shipper job detail phai check backend ownership.
- Customer order detail phai check owner.
- Shipper location chi gui khi co active job.
- Khong expose customer phone neu delivery chua assigned cho shipper.
- Call button dung phone masking neu backend co.
- Logs khong in token/PII.

## 15. Build va test

Commands de xuat:

```text
npm install
npx expo start
npx expo start --android
npx expo start --ios
npx expo-doctor
npx tsc --noEmit
```

Neu dung EAS:

```text
eas build -p android --profile preview
eas build -p ios --profile preview
```

Smoke test Customer:

```text
Open app
Login customer
Resolve store via default address/GPS/manual
View products
Add cart
Checkout quote
Place order
Open order tracking
```

Smoke test Shipper:

```text
Login shipper
Open assigned jobs
Open job detail
Open map/navigation
Mark picked from store
Mark out for delivery
Mark arrived
Confirm COD if needed
Mark delivered
```

Map smoke:

```text
GPS permission granted -> current location marker appears
Open Google/Apple Maps -> destination opens correctly
GPS denied -> manual/external navigation fallback works
```

## 16. MVP acceptance criteria

Mobile MVP dung khi:

- App chay duoc Android va iOS.
- Customer login duoc.
- Customer co the resolve store bang default address/GPS/manual address.
- Customer khong bi bat chon khu vuc/cua hang thu cong.
- Product list/cart/checkout dung autoAssignedStore tu backend.
- Checkout resolve lai tu final address.
- Customer tao order duoc.
- Customer xem tracking don duoc.
- Shipper login duoc.
- Shipper chi xem job cua minh.
- Shipper xem dia chi cua hang va dia chi khach tren dien thoai.
- Shipper mo duoc Google Maps/Apple Maps de chi duong.
- Shipper cap nhat duoc delivery statuses.
- Shipper giao that bai phai nhap ly do.
- COD flow co confirm tien thu.
- Push notification co setup hoac co TODO ro neu backend chua san sang.
- Khong co UI seller/manager/staff/warehouse/POS trong app phase nay.

## 17. Non-goals mobile phase nay

Khong lam:

- Admin mobile dashboard.
- Store manager mobile dashboard.
- Store staff mobile.
- Warehouse staff mobile.
- POS/cashier mobile.
- In-app turn-by-turn navigation day du.
- Background GPS bat buoc.
- Customer realtime map shipper neu backend chua co live location.
- Chat realtime.

## 18. Phase 2 mobile

Sau MVP co the them:

- Customer live tracking shipper realtime.
- Shipper background location.
- Route polyline/ETA realtime.
- In-app turn-by-turn voi Mapbox/Google Navigation SDK.
- Proof of delivery photo.
- Signature/OTP delivery confirmation.
- Store staff/warehouse mobile mini app.
- POS barcode mobile neu can.

## 19. Prompt cho AI/coding agent

```text
@MOBILE_CUSTOMER_SHIPPER_APP_SPEC.md
@BACH_HOA_XANH_STORE_MVP_SPEC.md

Code mobile app Android/iOS chi cho Customer va Shipper.
Khong code mobile cho admin/store manager/store staff/warehouse/POS trong phase nay.
Dung React Native + Expo + TypeScript tru khi co ly do ky thuat ro rang.
Customer khong duoc chon khu vuc/store thu cong; app chi lay default address/GPS/manual address va backend tu resolve autoAssignedStore.
Neu store gan nhat thieu hang, backend resolver thu store gan tiep theo; mobile chi hien ket qua/warning.
Shipper khong co offer/accept/reject; shipper chi thay assigned jobs.
Shipper app phai co map preview, current location, pickup/dropoff, call buttons, COD, failed reason modal, va nut mo Google Maps/Apple Maps de chi duong nhu MVP Be/Grab.
Build/test Android va iOS, smoke test customer order va shipper delivery truoc khi ket luan.
```
