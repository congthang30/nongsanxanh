# Risk Analysis Report

> Phân tích MVP web (chain-store) — không sửa code. Mọi đánh giá có dẫn nguồn file:line.

## Executive Summary

Hệ thống đã **đúng kiến trúc** cho mô hình chain-store nội bộ:
- Order/POS đều **không tin client** với `storeId`, `price`, `total` (giá tính lại từ `StoreInventory.salePrice` ở [orders.service.ts:122](file:///home/congthang/Desktop/TMDT/backend/src/modules/orders/orders.service.ts#L120-L155); POS dùng `barcodes.lookup` ở [pos-sale.service.ts:148](file:///home/congthang/Desktop/TMDT/backend/src/modules/pos/pos-sale.service.ts#L144-L196)).
- **Atomic reserve + commit inventory** với `SELECT ... FOR UPDATE` ở 2 hot path: order reserve ([inventory.service.ts:157-198](file:///home/congthang/Desktop/TMDT/backend/src/modules/inventory/inventory.service.ts#L146-L199)) và POS sale commit ([inventory.service.ts:535-548](file:///home/congthang/Desktop/TMDT/backend/src/modules/inventory/inventory.service.ts#L527-L584)).
- **VNPay verify signature** ở callback và idempotency theo `providerTransactionId` ([payment.service.ts:59-95](file:///home/congthang/Desktop/TMDT/backend/src/modules/payment/payment.service.ts#L58-L95)).
- **Shipper ownership** check chặt ([shipper.service.ts:350-371](file:///home/congthang/Desktop/TMDT/backend/src/modules/shipping/shipper.service.ts#L350-L371)); COD chưa thu tiền KHÔNG chuyển COMPLETED ([shipper.service.ts:190-206](file:///home/congthang/Desktop/TMDT/backend/src/modules/shipping/shipper.service.ts#L190-L206)).

**Top 3 lỗ hổng nghiêm trọng còn lại:**
1. **VNPay callback không verify `vnp_Amount`** — chữ ký đúng nhưng amount mismatch không bị từ chối ([payment.service.ts:67-116](file:///home/congthang/Desktop/TMDT/backend/src/modules/payment/payment.service.ts#L67-L128)).
2. **Order create không idempotent** — double-click có thể tạo 2 đơn từ cùng cart trước khi `cart.deleteMany()` chạy.
3. **Reserve stock không TTL** — VNPay pending bị bỏ giữa chừng, kho bị giữ vĩnh viễn cho tới khi cancel thủ công.

Các path còn lại (COD, POS pay/void, return, shipper, RBAC) đã ở mức chấp nhận cho MVP nội bộ.

---

## P0 Critical Risks

| ID | Scenario | Impact | Likelihood | Current evidence | Root cause | Recommended fix | Test case |
|---|---|---|---|---|---|---|---|
| P0-01 | VNPay IPN có chữ ký đúng nhưng `vnp_Amount` ≠ `order.grandTotal` | Mark đơn paid với số tiền sai → mất tiền hoặc đối soát lệch | Medium (lỗi cấu hình hoặc cố tình replay đơn cũ) | [payment.service.ts:67-95](file:///home/congthang/Desktop/TMDT/backend/src/modules/payment/payment.service.ts#L67-L95) chỉ kiểm tra `vnp_ResponseCode` và `providerTransactionId` unique. Không so `Number(query['vnp_Amount']) === order.grandTotal * 100`. | Thiếu validation amount sau khi verify chữ ký. | Trong `handleVnpayCallback` so `vnp_Amount/100 !== order.grandTotal` → log AMOUNT_MISMATCH, không markPaid. | Gọi IPN với amount sai → expect order vẫn `INITIATED`, có audit log AMOUNT_MISMATCH. |
| P0-02 | Customer double-click "Đặt hàng" | Tạo 2 order cùng cart, trừ reserve 2 lần | High (UX phổ biến) | [orders.service.ts:51-302](file:///home/congthang/Desktop/TMDT/backend/src/modules/orders/orders.service.ts#L51-L302) không có idempotency key. Cart chỉ clear ở line 296 trong cùng transaction nhưng request thứ 2 đọc cart trước khi tx 1 commit → cả 2 cùng pass `getCart`. | Không có unique constraint hoặc idempotency lock theo userId+cart hash. | Thêm distributed lock theo `userId` (Redis `SETNX` 10s) hoặc `cartId` unique nullable trên `Order` (set ngay khi mở tx). FE thêm debounce + disable button. | Gửi 2 POST `/orders` song song với cùng cartId → expect 1 thành công + 1 IDEMPOTENT_REJECTED. |
| P0-03 | VNPay pending không bao giờ hoàn tất (user đóng tab) | Stock bị reserve vĩnh viễn → giảm khả năng phục vụ | High (UX rất thường) | [orders.service.ts:206-212](file:///home/congthang/Desktop/TMDT/backend/src/modules/orders/orders.service.ts#L205-L212) reserve khi tạo order. Không có cron / TTL nào release. `markPaymentFailed` chỉ chạy khi VNPay gọi IPN với code != 00. | Thiếu cron expire `PENDING_PAYMENT` quá `n` phút. | Cron mỗi 5 phút: order `status=PENDING_PAYMENT` + `createdAt < now-30m` → gọi `markPaymentFailed` (đã có sẵn). | Tạo order VNPay, không trả tiền, sau 30' check order `CANCELLED` + reserved giảm. |
| P0-04 | Coupon over-redeem race condition | Quá `usageLimit` toàn cục | Medium (chỉ ảnh hưởng coupon hot) | [promotion.service.ts:71-76](file:///home/congthang/Desktop/TMDT/backend/src/modules/promotion/promotion.service.ts#L71-L76) read `usageCount`, [orders.service.ts:215-228](file:///home/congthang/Desktop/TMDT/backend/src/modules/orders/orders.service.ts#L215-L228) increment ở tx riêng — read-then-write race. | Không lock coupon row, không dùng atomic conditional update. | Trong order tx: `UPDATE coupon SET usageCount = usageCount+1 WHERE id=? AND (usageLimit IS NULL OR usageCount < usageLimit)` rồi check `count==1`. | 2 đơn dùng coupon `usageLimit=1` song song → expect 1 thành công + 1 COUPON_EXHAUSTED. |
| P0-05 | POS pay double-click | Trừ kho 2 lần, ghi 2 payment, expectedCash gấp đôi | Medium (cashier nóng vội) | [pos-sale.service.ts:329-467](file:///home/congthang/Desktop/TMDT/backend/src/modules/pos/pos-sale.service.ts#L329-L467) chỉ check status `DRAFT|HELD` đầu tx. 2 request đồng thời cùng đọc DRAFT trước khi tx commit. | Không lock `POSSale` row khi vào pay. | `SELECT ... FOR UPDATE` `POSSale` tại đầu tx, hoặc unique constraint `paymentId per saleId` + check transition atomic. | Race 2 POST `/pos/sales/:id/pay` → expect 1 SUCCESS + 1 SALE_NOT_PAYABLE. |
| P0-06 | POS return tạo nhiều lần cho cùng sale → trả >100% qty | Refund vượt số tiền sale, kho âm | Medium | [pos-return.service.ts:51-66](file:///home/congthang/Desktop/TMDT/backend/src/modules/pos/pos-return.service.ts#L51-L66) chỉ so quantity request với `item.quantity` của sale gốc, KHÔNG trừ những POSReturnItem trước đó cho cùng saleItemId. | Thiếu accumulation check. | Trong validate, `SELECT SUM(quantity) FROM pOSReturnItem WHERE saleItemId=? AND return.status IN (APPROVED, COMPLETED)` rồi cộng lượng mới phải `<= sale.quantity`. | Sale 5 cái, return 3 (APPROVED) → request return thêm 3 expect INVALID_RETURN_QTY. |
| P0-07 | VNPay IPN tạo `paymentTransaction` không có `idempotencyKey` cho callback chậm | Race khi return URL + IPN cùng đến → 2 transaction record, có thể double markPaid | Low–Medium | [payment.service.ts:100-107](file:///home/congthang/Desktop/TMDT/backend/src/modules/payment/payment.service.ts#L100-L116) chỉ rely `providerTransactionId @unique`. Nhưng giữa "check exists" (line 84) và "create" (line 100) có window race. | Window between check and insert. | Đặt `idempotencyKey` từ `${orderNumber}-${responseCode}-${transactionId}`, set @unique, dùng `prisma.$transaction` để insert + nếu unique error → tra trạng thái cũ. | Gửi cùng query string IPN 2 lần đồng thời → expect 1 record duy nhất. |

---

## P1 High Risks

| ID | Scenario | Impact | Likelihood | Current evidence | Root cause | Recommended fix | Test case |
|---|---|---|---|---|---|---|---|
| P1-01 | `markPaid` không re-validate canTransition strict | Đơn đã CANCELLED do user hủy lại bị mark PLACED nếu callback đến muộn | Low–Medium | [orders.service.ts:395-415](file:///home/congthang/Desktop/TMDT/backend/src/modules/orders/orders.service.ts#L395-L415) chỉ check `canTransition(order.status, PLACED)`. Nếu CANCELLED → state machine từ chối. Tuy nhiên `paymentStatus` vẫn được set SUCCESS line 401-402 → đơn đã hủy nhưng tiền đã thu. | Không có refund auto. | Nếu order đã CANCELLED khi callback success → tạo Refund pending + audit, KHÔNG set paymentStatus SUCCESS. | Hủy đơn xong để VNPay callback success đến sau → expect Refund record + paymentStatus stays. |
| P1-02 | `releaseForOrder` không lock row | Concurrent cancel + delivery_failed → giảm reserved 2 lần | Low | [inventory.service.ts:202-240](file:///home/congthang/Desktop/TMDT/backend/src/modules/inventory/inventory.service.ts#L201-L240) dùng findUnique + update không lock. `Math.max(0, ...)` chỉ chống âm chứ không chống mất reserve thật. | Không `FOR UPDATE`. | Lock row trước khi giảm reserved như `reserveForOrder` đã làm. | Cancel + failed cùng order trong cùng ms → expect chỉ 1 lần release ghi InventoryTransaction. |
| P1-03 | `commitForOrder` race với POS sale cùng variant | Cùng store, online order delivered + POS pay đồng thời → tổng trừ vượt qty thực tế | Low | [inventory.service.ts:243-282](file:///home/congthang/Desktop/TMDT/backend/src/modules/inventory/inventory.service.ts#L243-L282) không lock. POS có lock. | Không `FOR UPDATE` ở commit online. | Add `SELECT ... FOR UPDATE` như POS. | 2 stress request commit + POS sale cùng variant → snap inventory consistent. |
| P1-04 | Customer đổi địa chỉ sau khi cart resolve store, store mới có giá khác | Giá hiển thị khác giá order khi POST | Medium | Cart `revalidate` ([cart.service.ts:186-236](file:///home/congthang/Desktop/TMDT/backend/src/modules/cart/cart.service.ts#L186-L236)) update `cart.storeId`. Khi POST `/orders`, `createOrder` resolve lại store theo address. Đã đúng nhưng FE chưa hiển thị diff giá rõ ràng (đã add F-09 hint). | OK ở backend, edge case UX. | Trả `priceChanges[]` trong checkout/quote response, FE bắt buộc xác nhận. | Đổi address → check quote phản ánh giá mới. |
| P1-05 | `createVnpayPayment` tạo Payment row mới mỗi lần gọi | Mỗi lần FE retry pay button → DB có nhiều Payment PENDING với cùng order | Medium | [payment.service.ts:35-43](file:///home/congthang/Desktop/TMDT/backend/src/modules/payment/payment.service.ts#L35-L43) `prisma.payment.create` không check tồn tại. | Thiếu upsert. | Reuse Payment PENDING gần nhất nếu chưa expire (vd <30 phút). | Click pay 3 lần → 1 Payment row VNPay. |
| P1-06 | `ensurePayment` tạo Payment với amount = `order.grandTotal` không update SUCCESS | Khi callback success không match payment cũ → tạo Payment PENDING mới rồi không cập nhật → Payment báo PENDING nhưng order paymentStatus SUCCESS | Low | [payment.service.ts:100-116](file:///home/congthang/Desktop/TMDT/backend/src/modules/payment/payment.service.ts#L100-L116). Khi `payment` không tồn tại, tạo mới ID nhưng nhánh success line 109-115 chỉ update `if (payment)` nên payment mới giữ PENDING. | Logic nhánh không match. | Sau `ensurePayment`, dùng id vừa tạo update SUCCESS. | Tạo VNPay không có Payment record → IPN success → check Payment record SUCCESS. |
| P1-07 | Quote response chứa `subtotal/grandTotal` → FE chỉ hiển thị, server vẫn tính lại nhưng client vẫn gửi `paymentMethod` | Người dùng đổi method giữa quote và create → không có lỗi nhưng total có thể đổi (VNPay vs COD fee?) | Low | [orders.service.ts:156-157](file:///home/congthang/Desktop/TMDT/backend/src/modules/orders/orders.service.ts#L155-L157). Hiện grandTotal không phụ thuộc method, nên ổn. | Không thực sự lỗ hổng, chỉ flag để giữ chặt. | Khi thêm phụ phí method → tính lại trong tx. | N/A. |
| P1-08 | COD đã giao nhưng chưa thu tiền: KHÔNG có UI cho manager đánh dấu thu sau | Đối soát COD đọng | High (tự nhiên xảy ra) | [shipper.service.ts:190-206](file:///home/congthang/Desktop/TMDT/backend/src/modules/shipping/shipper.service.ts#L190-L206) audit log. Không endpoint `markCodCollected`. | Thiếu endpoint manager. | `POST /store-manager/orders/:id/mark-cod-collected` → set Payment SUCCESS + order COMPLETED. | Tạo order COD, deliver với codCollected=false → manager mark thu → expect COMPLETED. |
| P1-09 | Customer cancel order sau khi VNPay tạo URL nhưng chưa pay | Nếu user vẫn pay → tiền vào nhưng đơn CANCELLED (P1-01) | Medium | Không có lock giữa cancel và payment URL. | Khi cancel → invalidate payment URL (set Payment.status=CANCELLED), check ở callback. | Refer P1-01. |
| P1-10 | POS QR chuyển khoản: amount != grandTotal | POS đánh dấu PAID dù số tiền thật chưa khớp | High (manual workflow) | [pos-sale.service.ts:329-467](file:///home/congthang/Desktop/TMDT/backend/src/modules/pos/pos-sale.service.ts#L329-L467) cashier tự nhập amount, không có IPN từ ngân hàng. | Đây là flow QR tĩnh — không có cách verify ở MVP. | UI yêu cầu cashier confirm 2 bước cho QR (đã có thật, kiểm tra). | Manual QA. |
| P1-11 | POS void sau khi đã void (status race) | Double restock | Low | [pos-sale.service.ts:475-547](file:///home/congthang/Desktop/TMDT/backend/src/modules/pos/pos-sale.service.ts#L475-L547) check `status===VOIDED` đầu fn nhưng không lock. | Thiếu `SELECT ... FOR UPDATE` ở sale. | Lock sale row trước khi vào tx. | Race 2 void → 1 SUCCESS + 1 ALREADY_VOIDED. |
| P1-12 | POSReturn không gọi VNPay refund API | Hoàn tiền online: chỉ ghi sổ, không gửi cổng thanh toán | High (cho đơn online) | [pos-return.service.ts](file:///home/congthang/Desktop/TMDT/backend/src/modules/pos/pos-return.service.ts) chỉ update DB. POS chỉ áp cho sale tại quầy. Online order return cũng chỉ tạo `ReturnRequest` ở [orders.service.ts:442-496](file:///home/congthang/Desktop/TMDT/backend/src/modules/orders/orders.service.ts#L442-L496) — không gọi refund. | MVP không tích hợp refund API. | Tạo `Refund` record + manager xử lý thủ công qua VNPay merchant portal, đánh dấu `Refund.status=PROCESSED`. | Audit có ghi rõ refund pending. |
| P1-13 | Shipping fee `Math.haversine * 1.3 * fixedRate` không có rule theo quận | Khoảng cách lệch thực tế | Low | [geo.service.ts:98-115](file:///home/congthang/Desktop/TMDT/backend/src/modules/shipping/geo.service.ts#L98-L115) Haversine x 1.3. | Đã chấp nhận MVP. | Tăng độ chính xác bằng OSRM khi có ngân sách. | N/A. |
| P1-14 | Shipper báo failed nhưng store đã commit hàng (nếu race) | Kho âm | Low | [shipper.service.ts:233-283](file:///home/congthang/Desktop/TMDT/backend/src/modules/shipping/shipper.service.ts#L233-L283) chỉ release. Nếu shipper báo delivered rồi nhanh báo failed → state machine chặn. | Đã có guard. | OK. | Verify state machine rejects DELIVERED→FAILED. |
| P1-15 | `Order.assignmentDistanceKm` chỉ snapshot tại tạo đơn | Manager reassign sang shipper khác cũng không cập nhật distance | Low | [store-manager.service.ts](file:///home/congthang/Desktop/TMDT/backend/src/modules/store-manager) reassign chỉ đổi shipperId. | Acceptable. | Cập nhật `delivery.shipperId` đủ. | N/A. |

---

## P2 Medium Risks

| ID | Scenario | Impact | Evidence | Recommended fix |
|---|---|---|---|---|
| P2-01 | `couponRedemption.create` bên trong tx nhưng `couponRedemption` không có unique trên `(couponId,userId,orderId)` | Possible double redemption | schema: model `CouponRedemption` không khai báo unique. | Add `@@unique([couponId, userId, orderId])`. |
| P2-02 | Cart không có TTL | Người dùng cũ giữ cart cũ với giá cũ | [cart.service.ts](file:///home/congthang/Desktop/TMDT/backend/src/modules/cart/cart.service.ts) | Cron expire cart `ACTIVE` không động sau 30 ngày. |
| P2-03 | Customer `cancelOrder` không kiểm tra payment đã thu | Hủy đơn đã thu COD chưa giao | [orders.service.ts:352-390](file:///home/congthang/Desktop/TMDT/backend/src/modules/orders/orders.service.ts#L352-L390) chỉ check status. | CUSTOMER_CANCELLABLE hiện chỉ gồm PENDING_PAYMENT/PLACED → ổn cho COD chưa thu. Tăng test case. |
| P2-04 | Shipper xem `dropoffPhone` trong job — log có thể ghi PII | PII leak qua log | [shipper.service.ts:54-74](file:///home/congthang/Desktop/TMDT/backend/src/modules/shipping/shipper.service.ts#L54-L74) include order.items. | Mask SĐT trong log/audit metadata. |
| P2-05 | Audit log không index theo `targetType+targetId` | Truy vết chậm khi nhiều log | schema [AuditLog](file:///home/congthang/Desktop/TMDT/backend/prisma/schema.prisma#L1024) chỉ có 1 index. | `@@index([targetType, targetId])`. |
| P2-06 | Không có audit `ORDER_PRICE_RECALCULATED` khi quote → create lệch | Khó truy giá lệch | N/A | Log diff. |
| P2-07 | POS allowNegative chỉ check role chứ không log đặc biệt | Manager bán âm tồn không truy được | [pos-sale.service.ts:383-387](file:///home/congthang/Desktop/TMDT/backend/src/modules/pos/pos-sale.service.ts#L383-L387) | Audit `POS_NEGATIVE_STOCK_OVERRIDE`. |
| P2-08 | Webhook IPN không trả response chuẩn VNPay (`{RspCode, Message}`) | VNPay retry liên tục | [payment.controller.ts:46-48](file:///home/congthang/Desktop/TMDT/backend/src/modules/payment/payment.controller.ts#L44-L48) trả `{code, success}`. | Trả đúng format VNPay yêu cầu. |
| P2-09 | Reverse geocode fail thì address không có province | Resolve store không match service area | [geo.service.ts:154-181](file:///home/congthang/Desktop/TMDT/backend/src/modules/shipping/geo.service.ts#L154-L181) trả null. | Block submit nếu rev null. |
| P2-10 | `createOrder` nếu store hết primaryShipper → block | Đơn không tạo được khi shipper offline | [orders.service.ts:113-118](file:///home/congthang/Desktop/TMDT/backend/src/modules/orders/orders.service.ts#L113-L118). | Cho phép tạo đơn không gán shipper, manager assign sau (đã có endpoint reassign). |
| P2-11 | Cart không kiểm tra cùng store ở `addItem` nhưng `revalidate` xử lý sau | UX gây nhầm "thêm thành công" rồi mất khi đổi địa chỉ | [cart.service.ts:87-131](file:///home/congthang/Desktop/TMDT/backend/src/modules/cart/cart.service.ts#L87-L131) dùng aggregate stock. | OK trong MVP, hint UI khi resolve. |
| P2-12 | `paymentTransaction.callbackPayload` lưu raw JSON gồm `vnp_SecureHash` | Lộ chữ ký nếu DB bị đọc | [payment.service.ts:101-107](file:///home/congthang/Desktop/TMDT/backend/src/modules/payment/payment.service.ts#L100-L107). | Strip secret fields trước khi lưu. |

---

## P3 Low Risks

| ID | Scenario | Evidence | Fix |
|---|---|---|---|
| P3-01 | Rounding `Math.floor` cho coupon vs `Math.round` cho subtotal | [promotion.service.ts:91](file:///home/congthang/Desktop/TMDT/backend/src/modules/promotion/promotion.service.ts#L91) vs [orders.service.ts:135](file:///home/congthang/Desktop/TMDT/backend/src/modules/orders/orders.service.ts#L135) | Document policy: VND luôn integer, dùng `Math.round`. |
| P3-02 | Không có rate limit ở `/geo/autocomplete` | OSM Nominatim ToS yêu cầu UA + 1req/s | [geo.controller.ts](file:///home/congthang/Desktop/TMDT/backend/src/modules/shipping/geo.controller.ts) + [geo.service.ts:45](file:///home/congthang/Desktop/TMDT/backend/src/modules/shipping/geo.service.ts#L45) đã có UA. | Throttle/cache 5 phút. |
| P3-03 | POS receipt không số điện thoại khách | UX | [pos-sale.service.ts:583](file:///home/congthang/Desktop/TMDT/backend/src/modules/pos/pos-sale.service.ts#L583) đã có `customerPhoneSnapshot`. | OK. |
| P3-04 | Stock report theo store không check thời gian | Báo cáo không filter date range | admin.service [revenueReport](file:///home/congthang/Desktop/TMDT/backend/src/modules/admin/admin.service.ts#L447). | Add filter. |
| P3-05 | Không có cron đối soát doanh thu cuối ngày | Manual | N/A | Cron daily reconcile. |
| P3-06 | FE nhiều `confirm()` browser native | UX | Đã thay 1 phần ở Shipper. | Replace remaining. |

---

## Payment Risk Deep Dive

### Online (VNPay)
**Đã làm tốt:**
- Verify HMAC-SHA512 ([vnpay.service.ts:55-68](file:///home/congthang/Desktop/TMDT/backend/src/modules/payment/vnpay.service.ts#L55-L68)).
- Idempotency theo `providerTransactionId` unique ([schema.prisma:672](file:///home/congthang/Desktop/TMDT/backend/prisma/schema.prisma#L672) + [payment.service.ts:83-94](file:///home/congthang/Desktop/TMDT/backend/src/modules/payment/payment.service.ts#L83-L94)).
- Có cả return URL và IPN cùng handler ([payment.controller.ts:38-48](file:///home/congthang/Desktop/TMDT/backend/src/modules/payment/payment.controller.ts#L38-L48)).

**Lỗ hổng:**
- **P0-01**: KHÔNG verify `vnp_Amount`.
- **P0-07**: Race window khi check existence rồi insert.
- **P1-01**: Order CANCELLED nhưng callback success vẫn set `paymentStatus=SUCCESS`.
- **P1-05/06**: Tạo nhiều Payment PENDING; nhánh `ensurePayment` không update SUCCESS.
- **P2-08**: Response IPN không đúng format VNPay → retry storm.
- **P2-12**: Lưu raw `vnp_SecureHash` trong DB.

**Kế hoạch fix:**
1. So sánh `Number(query['vnp_Amount']) / 100 === order.grandTotal` ngay sau verify signature.
2. Đặt `idempotencyKey = sha1("${orderNumber}|${transactionId}")` unique trên `PaymentTransaction`.
3. Đổi handler trả `{RspCode: '00', Message: 'Confirm Success'}` theo chuẩn VNPay.
4. Nếu order đã CANCELLED → tạo `Refund` PENDING + audit, không markPaid.

### COD
**Đã tốt:** Shipper bị từ chối COMPLETED nếu chưa thu tiền, audit log `COD_NOT_COLLECTED`.

**Còn thiếu:**
- **P1-08**: Không có endpoint manager mark đã thu sau.
- Không reset codAmount khi reassign.
- Không có báo cáo COD đọng (đối soát ngày).

### POS Payment (CASH/QR)
**Đã tốt:** Atomic + lock inventory ở `commitPosSale`.

**Lỗ hổng:**
- **P0-05**: Double-click → P0.
- **P1-10**: QR tĩnh không IPN → cashier tự confirm.
- **P1-11**: Void race.

**Fix:** lock POSSale row + thêm UI 2-step xác nhận QR.

### Refund
- VNPay refund: hoàn toàn manual (P1-12). Tạo `Refund` PENDING + admin xử lý ngoài hệ thống.
- POSReturn: cần check tổng quantity đã trả (P0-06).

### Reconciliation
- Hiện chỉ có `payment.controller` ghi `PaymentTransaction`. Không có cron đối soát doanh thu Order vs Payment vs POS.
- **Nên có:** daily job so `Order.grandTotal sum` vs `Payment.amount sum` vs `POSPayment sum` group by store.

### Webhook/Idempotency
- Verify signature ✅
- Unique txn id ✅
- Format response ❌ (P2-08)
- Replay window protection: dựa vào `providerTransactionId` unique (đủ).
- Rate limit: chưa có.

---

## Order + Inventory Consistency

### State machine
- Order: [order-state.machine.ts](file:///home/congthang/Desktop/TMDT/backend/src/modules/orders/order-state.machine.ts) — guard mọi transition trong tx.
- Delivery: [delivery-state.machine.ts](file:///home/congthang/Desktop/TMDT/backend/src/modules/orders/delivery-state.machine.ts) — guard trong shipper service.
- Sync order ↔ delivery: shipper service ném `ORDER_DELIVERY_DESYNC` nếu lệch ([shipper.service.ts:336-343](file:///home/congthang/Desktop/TMDT/backend/src/modules/shipping/shipper.service.ts#L336-L343)) — tốt.

### Reserve / Commit / Release
| Op | Lock | Status |
|---|---|---|
| `reserveForOrder` | `SELECT ... FOR UPDATE` | ✅ |
| `commitPosSale` | `SELECT ... FOR UPDATE` | ✅ |
| `commitForOrder` (online) | findUnique + update | ❌ P1-03 |
| `releaseForOrder` | findUnique + update | ❌ P1-02 |
| `exportStock` | ❓ | ✅ trong tx, nhưng không lock |

### Race scenarios
1. **2 user mua món cuối cùng**: được xử lý qua `FOR UPDATE` trong reserve → 1 thắng, 1 INSUFFICIENT_STOCK ✅.
2. **Online order delivered + POS bán cùng variant**: P1-03 — có thể sai vì commit online không lock.
3. **Cancel + Delivery failed cùng order**: P1-02 — release double.
4. **Reserved stale**: P0-03 — không TTL.
5. **Coupon over-redeem**: P0-04.

### Recommended pattern
- Toàn bộ inventory mutation đi qua một helper `lockInventoryRow(tx, storeId, variantId)` rồi mới update — đặt trong `inventory.service.ts`.

---

## Security/RBAC/IDOR Risks

| Endpoint | Guard | Status |
|---|---|---|
| `GET /orders/:id` | `getOrderForUser` check `userId !== ownerId` | ✅ |
| `GET /pos/sales/:id` | `getSaleInScope` check store match | ✅ |
| `POST /shipper/jobs/:id/*` | `loadOwnedDelivery` check shipperId | ✅ |
| `GET /admin/users` | `Roles.ADMIN` | ✅ |
| `POST /payments/vnpay/return` | `@Public()` + verify signature | ✅ |
| `POST /payments/vnpay/ipn` | `@Public()` + verify signature | ✅ |
| `POST /store-manager/orders/:id/reassign-delivery` | manager only | ✅ |
| `POST /warehouse/inventory/export` | warehouse role + scope service | ✅ |
| `GET /admin/audit-logs` | admin only | ✅ |
| `POST /admin/stores` | admin | ✅ |

**Phát hiện:**
- **PII**: Customer phone xuất hiện trong shipper job + audit log metadata. Cân nhắc mask trong log.
- **JWT trong log**: chưa thấy bằng chứng leak nhưng nên tắt verbose logging mặc định.
- **`/geo/*` Public**: OK (proxy OSM).
- **Webhook public**: bảo vệ bởi chữ ký. Nên thêm rate limit.

---

## Real-World Failure Scenarios

> Mỗi kịch bản có 4 phần: trigger, hệ thống có thể lỗi ở đâu, hậu quả, cách fix, cách test.

### S-01 Khách double click "Đặt hàng" trên 4G chậm
- Trigger: 2 POST /orders trong 200ms.
- Lỗi: P0-02. 2 đơn cùng cart, reserve 2 lần, cart clear chỉ chạy 1 lần.
- Hậu quả: 2 hóa đơn, kho giữ 2x.
- Fix: idempotency key + FE disable button.
- Test: integration test chạy 2 promise.all create order.

### S-02 Khách đóng tab khi đang ở VNPay
- Trigger: redirect VNPay → user đóng tab.
- Lỗi: P0-03. Order PENDING_PAYMENT, kho reserved.
- Hậu quả: stock đứng vĩnh viễn.
- Fix: cron expire 30 phút.
- Test: tạo order, sleep 31', check order CANCELLED.

### S-03 VNPay callback amount sai (man-in-the-middle hoặc lỗi config)
- Trigger: callback có chữ ký đúng nhưng amount khác.
- Lỗi: P0-01.
- Hậu quả: đơn paid với số tiền sai → đối soát lệch.
- Fix: validate vnp_Amount = grandTotal*100.
- Test: mock callback amount=1, expect AMOUNT_MISMATCH.

### S-04 VNPay callback đến 2 lần (return + IPN)
- Trigger: VNPay gửi cả hai cùng providerTransactionId.
- Lỗi: P0-07 race window.
- Hậu quả: 2 PaymentTransaction, có thể 2 markPaid.
- Fix: idempotencyKey unique + try/catch unique violation.
- Test: parallel 2 request cùng query.

### S-05 Customer hủy đơn xong VNPay callback success
- Trigger: cancel sau khi tạo URL VNPay, người dùng vẫn bấm pay.
- Lỗi: P1-01.
- Hậu quả: đơn CANCELLED nhưng paymentStatus=SUCCESS, tiền vào không được trả.
- Fix: tạo Refund pending + audit, không set SUCCESS.
- Test: cancel → callback success → assert Refund record.

### S-06 Coupon `usageLimit=10` được 11 user dùng đồng thời
- Trigger: marketing flash sale.
- Lỗi: P0-04.
- Hậu quả: coupon vượt limit, nhà bán bù lỗ.
- Fix: atomic increment với conditional WHERE.
- Test: stress 20 đơn cùng coupon limit=10.

### S-07 Cashier double-click "Thanh toán" tại POS
- Trigger: cashier nóng vội.
- Lỗi: P0-05.
- Hậu quả: trừ kho 2 lần, expectedCash gấp đôi.
- Fix: lock sale row.
- Test: parallel POST pay.

### S-08 Khách trả 5 cái → tạo 2 yêu cầu tra hàng đều 5 cái
- Trigger: cashier sai thao tác.
- Lỗi: P0-06.
- Hậu quả: refund 2x, kho cộng 2x.
- Fix: tổng quantity returned <= sale qty.
- Test: tạo 2 return, 1 đã APPROVED, request 2 expect failed.

### S-09 Manager cấp ALLOW_NEGATIVE_STOCK rồi quên hủy
- Trigger: bán âm liên tục.
- Lỗi: P2-07.
- Hậu quả: kho âm không phát hiện.
- Fix: audit + alert khi >5 lần/ca.
- Test: bán âm → expect audit POS_NEGATIVE_STOCK_OVERRIDE.

### S-10 Shipper báo failed nhưng customer thực ra đã nhận
- Trigger: shipper sai.
- Lỗi: state machine cho phép DELIVERED→FAILED? — KHÔNG, đã chặn.
- Hậu quả: nhỏ.
- Fix: thêm UI manager đảo trạng thái có audit.
- Test: kiểm tra delivery-state.machine.

### S-11 Address không có lat/lng (Nominatim fail)
- Trigger: địa chỉ rare.
- Lỗi: P2-09. Resolve store fail.
- Hậu quả: blocked checkout — đúng.
- Test: gửi address text bậy → expect ADDRESS_NOT_VERIFIED.

### S-12 Store hết primaryShipper (nhân viên nghỉ)
- Trigger: assignShipper xóa.
- Lỗi: P2-10. Order create fail.
- Hậu quả: blocked toàn store cho tới khi gán.
- Fix: cho phép tạo không shipper, manager assign sau.
- Test: tạo store không shipper → POST order → expect 400 hoặc graceful.

### S-13 Khách thanh toán COD, shipper giao xong nhưng quên thu tiền
- Trigger: shipper bấm DELIVERED + codCollected=false.
- Lỗi: P1-08. Không UI cho manager xử lý sau.
- Hậu quả: đơn đứng DELIVERED không COMPLETED, doanh thu lệch.
- Fix: endpoint mark-cod-collected + báo cáo COD đọng.
- Test: deliver false → manager mark → expect COMPLETED.

### S-14 Stock thực tế hư hỏng nhưng warehouse staff không export
- Trigger: bao bì rách.
- Lỗi: P2-XX. Có endpoint exportStock LOSS rồi.
- Hậu quả: kho lệch nếu staff lười.
- Fix: cron weekly stock count.
- Test: exportStock kind=LOSS → expect record POS_LOSS.

### S-15 Customer đổi địa chỉ giữa quote và checkout
- Trigger: cart đã có store A, đổi sang địa chỉ store B.
- Lỗi: backend resolve lại OK. FE đã có hint F-09.
- Hậu quả: nhỏ.
- Fix: ensure quote re-trigger.
- Test: revalidateCart sau đổi address.

### S-16 Race: 2 cashier mở cùng sale (HELD) rồi cùng pay
- Trigger: cashier handover ca.
- Lỗi: hiện assertDraft check status — sale chỉ thuộc 1 cashier (sale.cashierId), nhưng `getSaleInScope` chỉ check storeId. Cashier khác cùng store có thể pay.
- Hậu quả: shift accounting sai.
- Fix: assert `sale.cashierId === user.id` OR manager.
- Test: cashier B mở sale của cashier A → expect 403.

### S-17 Refund VNPay nhưng admin chưa xử lý ngoài hệ thống
- Trigger: customer return online.
- Lỗi: P1-12. Refund PENDING vô tận.
- Hậu quả: customer chờ.
- Fix: dashboard hiển thị Refund pending + buộc workflow.

### S-18 Stale price khi sale lớn
- Trigger: Promotion flash sale.
- Lỗi: cart hiển thị giá cũ.
- Hậu quả: subtotal trên FE khác BE.
- Fix: BE đã tính lại ✅. Hint F-09 ✅.

### S-19 Shipper đổi mật khẩu và relogin → đơn ASSIGNED chưa hủy
- Trigger: nhân sự thay đổi.
- Lỗi: delivery.shipperId vẫn cũ.
- Hậu quả: đơn không được giao.
- Fix: manager reassign-delivery (đã có).

### S-20 Webhook IPN đến trước khi DB commit Order
- Trigger: VNPay nhanh, DB chậm.
- Lỗi: order chưa tồn tại → NotFoundException.
- Hậu quả: VNPay retry.
- Fix: trả mã RspCode tạm để VNPay retry hợp lệ.

### S-21 InventoryTransaction không có `userId` trong vài chỗ system
- Trigger: payment IPN markPaid → release qua `'system'`.
- Lỗi: createdBy chứa string `'system'` nhưng schema có thể required FK?
- Evidence: [orders.service.ts:422](file:///home/congthang/Desktop/TMDT/backend/src/modules/orders/orders.service.ts#L422) truyền `'system'`. [inventory schema](file:///home/congthang/Desktop/TMDT/backend/prisma/schema.prisma#L460) chấp nhận string optional.
- Fix: confirm schema, có thể null.

### S-22 POS shift không close → expectedCash âm vô tận
- Trigger: cashier quên close ca.
- Lỗi: shift accounting sai.
- Fix: cron auto-close ca hết hạn.

### S-23 Customer đặt nhiều variant trong cart, chỉ 1 variant out-of-stock tại store đó
- Trigger: cart phong phú.
- Lỗi: resolver thử store kế tiếp ([store-resolver.service.ts](file:///home/congthang/Desktop/TMDT/backend/src/modules/store/store-resolver.service.ts)) — đã đúng MVP.
- Test: cart 3 variants, store gần thiếu 1 → expect store xa được chọn.

### S-24 Frontend gửi `couponCode` nhưng backend không validate scope STORE
- Lỗi: đã validate ✅ ([promotion.service.ts:51-63](file:///home/congthang/Desktop/TMDT/backend/src/modules/promotion/promotion.service.ts#L51-L63)).

### S-25 Audit log lưu `metadata` không strip JWT
- Lỗi: `audit.log({metadata: req.body})` chỉ có thể leak nếu service truyền raw body. Hiện tại chỉ truyền field cụ thể → OK.

---

## Fix Roadmap

### 1. Must fix BEFORE deploy (P0 + critical P1)
| Order | Item | ID |
|---|---|---|
| 1 | Verify `vnp_Amount` trong IPN | P0-01 |
| 2 | Idempotency cho create order (cartId + userId lock) | P0-02 |
| 3 | Cron expire VNPay pending 30 phút | P0-03 |
| 4 | Atomic coupon increment | P0-04 |
| 5 | Lock POSSale row khi pay/void | P0-05, P1-11 |
| 6 | Cộng dồn POSReturnItem qty | P0-06 |
| 7 | `idempotencyKey` cho PaymentTransaction | P0-07 |
| 8 | Refund auto khi VNPay success vào order CANCELLED | P1-01 |
| 9 | Lock row trong release/commit online | P1-02, P1-03 |
| 10 | Endpoint `mark-cod-collected` cho manager | P1-08 |
| 11 | Reuse Payment PENDING + fix `ensurePayment` update | P1-05, P1-06 |
| 12 | Trả response IPN đúng format VNPay | P2-08 |

### 2. Should fix for MVP launch (P1 + P2)
- Refund tracking + admin dashboard (P1-12)
- Audit log index, mask PII trong log (P2-04, P2-05)
- Cron đối soát doanh thu Order vs Payment vs POS daily (P3-05)
- Cho tạo order khi store thiếu shipper (P2-10)
- Strip secret trong callbackPayload (P2-12)
- Cashier scope cho POSSale (S-16)

### 3. Can fix AFTER MVP
- OSRM thay Haversine (P1-13)
- Auto-close shift (S-22)
- Stock count cron (S-14)
- Rate-limit geo/webhook (P3-02)

---

## Test Plan

### Unit tests
- `promotion.service.spec.ts`: 
  - Coupon hết hạn, scope STORE mismatch, perUserLimit, atomic increment.
- `inventory.service.spec.ts`:
  - reserveForOrder INSUFFICIENT_STOCK.
  - releaseForOrder không ghi reserved âm.
  - commitPosSale với allowNegative.
- `vnpay.service.spec.ts`:
  - createPaymentUrl ra format đúng.
  - verifySignature true/false.
- `pos-return.service.spec.ts`:
  - validate cộng dồn quantity.

### Integration tests
- `orders.e2e.spec.ts`:
  - tạo order COD → PLACED + reserve
  - tạo order VNPay → PENDING_PAYMENT
  - VNPay IPN success → PLACED + paymentStatus=SUCCESS
  - VNPay IPN fail → CANCELLED + release
  - VNPay IPN amount mismatch → reject (cần fix P0-01 trước)
  - cancel → release đúng số lượng
  - delivery delivered COD collected → COMPLETED
  - delivery delivered COD not collected → DELIVERED (no COMPLETED)
- `pos.e2e.spec.ts`:
  - flow create → scan → pay → receipt
  - return APPROVED → COMPLETED → restock
  - cộng dồn return qty (P0-06)
- `concurrent.spec.ts`:
  - 20 đơn cùng coupon limit=10 → đúng 10 thành công
  - 5 đơn cùng variant tồn=3 → đúng 3 thành công
  - 2 POST /orders cùng cart → 1 thành công (P0-02)

### E2E tests (Playwright)
- Customer happy path: home → cart → checkout (COD) → order detail
- Customer happy path VNPay: tới redirect VNPay sandbox → return → success
- Cashier flow: open shift → scan barcode → pay → print receipt
- Manager flow: SM dashboard → DELIVERY_FAILED → reassign
- Warehouse: pick → pack → mark ready

### Manual QA checklist
- [ ] Double-click "Đặt hàng" → chỉ 1 order
- [ ] Đóng tab giữa VNPay → 30 phút sau order CANCELLED, kho release
- [ ] VNPay sandbox amount=0 → reject AMOUNT_MISMATCH
- [ ] Coupon flash sale 10 user race
- [ ] Cashier double-click pay
- [ ] Return 50% rồi return tiếp 60%
- [ ] Shipper báo COD chưa thu → manager mark thu sau → COMPLETED
- [ ] Shipper báo failed → kho release
- [ ] Đổi địa chỉ giữa quote và create
- [ ] Tạo store mới qua AddressSearchInput → đủ field
- [ ] Audit log đầy đủ cho mọi mutation tiền/kho

---

> Đánh giá tổng: **MVP đạt 75% mức sẵn sàng**. Sau khi đóng 7 P0 + 4 P1 quan trọng (~5–7 ngày dev), có thể launch nội bộ với 1 store pilot. Mở rộng nhiều store cần thêm cron đối soát + stock count tuần.
