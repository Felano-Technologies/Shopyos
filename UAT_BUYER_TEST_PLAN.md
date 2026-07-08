# Shopyos — UAT Test Plan: Buyer Role

## 1. Purpose & Scope

This document defines the User Acceptance Test (UAT) cases for the **buyer** role in Shopyos. It covers every buyer-facing capability of the app: browsing, cart, bargaining, checkout, payments, orders, delivery tracking, returns, reviews, notifications, chat (including the Shopyos AI support bot), loyalty points, referrals, snaps, support tickets, and account/settings management.

Out of scope: seller/business dashboard, driver app, parcel-partner console, and admin console — these are covered by separate UAT plans.

## 2. Test Environment & Preconditions

- **Build under test:** _____________ (app version / commit hash)
- **Environment:** Staging / UAT (specify backend URL and DB)
- **Test accounts needed:**
  - At least 2 registered buyer accounts (one new/unverified, one existing/verified) with valid phone/email.
  - At least 1 seller/store with published products, active promotions, and at least one flash sale seeded in the test DB.
  - A Paystack sandbox test card (and a card that triggers a declined transaction) for payment tests.
  - A driver assigned to at least one in-transit test order, for delivery-tracking tests.
- **Devices:** iOS device/simulator, Android device/emulator, and (if supported) web build.

**Proof of testing:** each test case requires a screenshot (or short screen recording) showing the actual result — attach it on the UAT sign-off form, not in this document.

---

## 3. Test Cases by Feature Area

### 3.1 Registration & Login

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Register account | Account created, OTP sent, user routed to OTP screen |
| 2 | Register account with a referral code | Account created; referral recorded against the referrer; new user gets their own referral code |
| 3 | Register account with an invalid referral code | Registration still succeeds; the bad code is simply ignored |
| 4 | Login with invalid credentials | Clear error shown, no login |
| 5 | Login via Google | Logged in / new account created from Google profile |
| 6 | Forgot password | Password reset succeeds; can log in with new password |
| 7 | Forced password reset | User must set a new password before they can use the app (ignore if your account wasn't created by admin) |
| 8 | View & revoke active sessions | Session list shown; revoked session is logged out immediately |
| 9 | Logout from all devices | All sessions logged out at once |

### 3.2 Profile & Account Settings

| # | Scenario | Expected Result |
|---|---|---|
| 1 | View profile | Correct name, phone/email, avatar, role shown |
| 2 | Edit profile details | Changes saved and reflected across the app |
| 3 | Update delivery location | New location saved and used for delivery quotes |
| 4 | Change password | Password updated; can log in with new password |
| 5 | Onboarding shown only once | Onboarding screens not shown again after completion |
| 6 | Accept a legal disclaimer | Disclaimer recorded; not shown again |
| 7 | Turn on two-factor authentication | Next login requires the second factor |
| 8 | Turn on biometric login | Face/Touch ID unlocks the app |
| 9 | Turn on login alerts | Notified when logging in from a new device |
| 10 | Toggle privacy preferences (activity tracking, personalized ads, data sharing, location) | Each preference saves and persists after restart |
| 11 | Toggle marketing emails | No marketing emails once disabled |
| 12 | Toggle push notifications from Settings home | Notification preference updates immediately |
| 13 | View shopping stats | Buyer's own spend/order stats load correctly |

### 3.3 Home, Browse & Search

| # | Scenario | Expected Result |
|---|---|---|
| 1 | View home feed | Featured products, promotions, categories load without error |
| 2 | Browse by category | Products in that category listed correctly |
| 3 | Search for a product | Relevant results returned |
| 4 | Search with no results | Friendly "no results" message, no crash |
| 5 | Apply filters (price, category, sort) | Results update to match filters |
| 6 | Clear filters | List returns to unfiltered state |
| 7 | View recently viewed products | Matches actual browsing history, most recent first |
| 8 | Scroll a long list (pagination) | Next page loads with no duplicates or crash |

### 3.4 Product Details & Recommendations

| # | Scenario | Expected Result |
|---|---|---|
| 1 | View product details | Images, price, description, store info, stock status all shown |
| 2 | View similar products | Relevant related items shown; tapping opens their page |
| 3 | View an out-of-stock product | Out-of-stock label shown; Add-to-Cart disabled |
| 4 | View personalized recommendations ("For You") | Reflects the buyer's past purchases/browsing |
| 5 | View "For You" as a brand-new buyer | Falls back to trending products, no crash |

### 3.5 Stores/Sellers Browsing

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Browse all stores | List of stores with name, rating, distance |
| 2 | View store details | Store profile, products, and reviews shown |
| 3 | Search stores | Matching stores returned |
| 4 | View stores on a map | Store pins shown at correct locations; tapping one highlights it |
| 5 | Filter stores on the map by radius | Only stores within the chosen radius shown |
| 6 | Filter stores on the map by category | Only stores in that category shown |
| 7 | Search stores on the map | Pins filter to matching store names |

### 3.6 Favorites / Wishlist

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Add product to favorites | Product added; heart icon updates immediately |
| 2 | Remove product from favorites | Removed everywhere it's shown |
| 3 | View favorites list | All favorited products listed correctly |
| 4 | Favorites persist across sessions | Still favorited after logging out and back in |
| 5 | Verify notification: price drops on a favorited product | Buyer gets a "Price dropped on your wishlist!" notification |

### 3.7 Shopping Cart

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Add item to cart | Item appears in cart; cart badge updates |
| 2 | Update item quantity | Line total and cart total recalculate correctly |
| 3 | Remove item from cart | Item removed, totals update |
| 4 | Clear entire cart | Cart emptied |
| 5 | Try to add more than available stock | Blocked or capped with a clear message |
| 6 | Cart persists across sessions | Cart contents preserved after logging back in |
| 7 | Add items from two different stores | App handles the multi-store cart correctly at checkout |

### 3.8 Bargaining (Make an Offer)

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Make a bargain offer | Offer sent to seller, appears in "My Offers" as pending |
| 2 | View offer negotiation history | Full back-and-forth timeline shown |
| 3 | Respond to a seller's counter-offer | Accepted offer becomes actionable |
| 4 | Withdraw a pending offer | Offer marked withdrawn |
| 5 | Add an agreed bargain item to cart | Added at the bargained price |
| 6 | Verify notification: seller accepts offer | Buyer gets "Bargain offer accepted!" notification |
| 7 | Verify notification: seller rejects offer | Buyer gets "Bargain offer rejected" notification |
| 8 | Verify notification: seller counters | Buyer gets a "New counter-offer received" notification |

### 3.9 Checkout, Payment Methods & Promo Codes

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Checkout happy path | Order created, payment succeeds, receipt shown |
| 2 | Verify notification: order placed | Buyer gets "Order Placed Successfully" notification |
| 3 | Checkout with an empty cart | Checkout blocked with a clear message |
| 4 | Apply a valid promo code | Discount applied, total recalculated |
| 5 | Apply an invalid/expired promo code | Clear rejection message, no discount applied |
| 6 | See the delivery fee quote at checkout | Fee shown and included in the total |
| 7 | Add a new payment method | Card saved and selectable at checkout |
| 8 | Delete a saved payment method | Card removed, no longer selectable |
| 9 | Pay with a saved card | Payment completes without re-entering card details |
| 10 | Payment fails/declines | Order not confirmed; clear failure message; cart preserved to retry |
| 11 | Payment verification after checkout | Order status updates to paid/confirmed without a manual refresh |
| 12 | Verify notification: payment confirmed | Buyer gets "Payment Confirmed" notification |
| 13 | View receipt after purchase | Itemized receipt matches the order |
| 14 | Pay via Mobile Money (MoMo) | Payment completes, order confirmed |
| 15 | Redeem loyalty points at checkout | Points discount applied; loyalty balance decreases after order |
| 16 | Checkout with items from 2+ stores | Delivery fee shown per store and summed correctly |
| 17 | Checkout with a store outside the buyer's region | Parcel transit fee and estimated transit days shown separately |
| 18 | Deliver to an address the store doesn't reach | Clear "out of range" message; checkout blocked or fee adjusted |
| 19 | Inter-regional order — choose free hub pickup | No last-mile fee added to the total |
| 20 | Inter-regional order — choose paid home delivery | Last-mile fee added and itemized in the total |
| 21 | Checkout with items from 2+ out-of-region stores | Transit fee summed correctly per store |

### 3.10 Flash Sales & Deals

| # | Scenario | Expected Result |
|---|---|---|
| 1 | View an active flash sale | Sale items, discounted prices, and countdown shown |
| 2 | View Deals when no sale is running | Friendly empty state, no crash |
| 3 | Buy a flash-sale item | Discounted price honored through checkout |

### 3.11 Order Placement, History & Cancellation

| # | Scenario | Expected Result |
|---|---|---|
| 1 | View order history | All past/current orders listed, most recent first |
| 2 | View order details | Items, status, timeline, delivery info, totals all accurate |
| 3 | Look up an order by order number | Correct order retrieved |
| 4 | Cancel an eligible order | Order cancelled; refund initiated if applicable |
| 5 | Try to cancel a non-cancellable order | Cancel option disabled/rejected with an explanation |
| 6 | Confirm delivery received | Order marked complete |

### 3.12 Delivery Tracking (Local & Inter-Regional)

| # | Scenario | Expected Result |
|---|---|---|
| 1 | View delivery status | Correct stage shown (assigned/picked up/in transit/delivered) |
| 2 | Live tracking on map | Driver, pickup, and drop-off markers shown with a route line; driver marker updates live |
| 3 | Map auto-fits markers when a driver is assigned | Camera zooms/pans to show all markers |
| 4 | Message the driver from the tracking screen | Opens a chat with the driver |
| 5 | Confirm delivery PIN | PIN verification completes the delivery |
| 6 | See the delivery fee quote before ordering | Fee matches distance/rules and the final charge |
| 7 | Track an inter-regional order's hub routing | Origin/destination hub names and tracking number shown |
| 8 | Follow an inter-regional order through all its stages | Status label updates correctly at each stage |
| 9 | See the estimated hub arrival date | Shown before the parcel reaches the destination hub |
| 10 | Request home delivery after arriving at the hub | Fee shown; request succeeds |
| 11 | Try to request home delivery without accepting the terms | Blocked until the terms are accepted |
| 12 | Pick up parcel at the hub instead of requesting delivery | Free in-person pickup available, no fee charged |
| 13 | View the hub-to-hub status history | Each stage shows a timestamp and hub name |
| 14 | Verify notification: driver assigned | Buyer notified when a driver is assigned |
| 15 | Verify notification: order picked up | Buyer gets "Order Picked Up" notification with the delivery PIN |
| 16 | Verify notification: order in transit | Buyer notified when the order is in transit |
| 17 | Verify notification: order delivered | Buyer notified when the order is delivered |
| 18 | Verify notification: delivery failed or cancelled | Buyer notified and advised to contact support |

### 3.13 Returns & Refunds

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Submit a return request | Request created, shown as pending in "My Returns" |
| 2 | View return status | Status shown accurately |
| 3 | Respond to the seller on a return | Response recorded, status updates |
| 4 | Try to return an ineligible/expired-window item | Blocked with an explanation |
| 5 | Verify notification: return approved | Buyer notified the return was approved |
| 6 | Verify notification: return declined | Buyer notified with the seller's reason |
| 7 | Verify notification: refund issued | Buyer notified with the refunded amount |

### 3.14 Reviews & Ratings

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Leave a product review | Review saved and visible on the product page |
| 2 | Leave a store review | Review saved and visible on the store page |
| 3 | Leave a driver review | Review saved |
| 4 | Edit own review | Update reflected everywhere it's shown |
| 5 | Delete own review | Removed from the product/store page |
| 6 | View own review history | All of the buyer's reviews listed |
| 7 | Try to review a product not yet delivered | Blocked — only delivered items are reviewable |
| 8 | Like and comment on a review | Like count increments; comment appears |
| 9 | Verify notification: seller replies to your review | Buyer notified of the seller's reply |

### 3.15 Notifications

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Receive an order-status push notification | Push notification received on device |
| 2 | View notifications list | All notifications shown with correct read/unread state |
| 3 | Mark notification(s) as read | Unread badge updates accordingly |
| 4 | Delete notification(s) | Removed from the list |
| 5 | Update notification preferences | Disabled categories stop sending pushes |
| 6 | Push token registers on first login | Pushes actually arrive on that device |
| 7 | Filter notifications by type | Only that category shown |

**Quick-reference: every action below should be checked for a notification (push + in-app):**

| Action | Notification | Tested In |
|---|---|---|
| Order placed | "Order Placed Successfully" | Checkout |
| Payment confirmed | "Payment Confirmed" | Checkout |
| Driver assigned | Status update | Delivery Tracking |
| Order picked up | "Order Picked Up" (with PIN) | Delivery Tracking |
| Order in transit | Status update | Delivery Tracking |
| Order delivered | Status update | Delivery Tracking |
| Delivery failed/cancelled | "Delivery Failed/Cancelled" | Delivery Tracking |
| Return approved | Approval notice | Returns & Refunds |
| Return declined | Decline notice + reason | Returns & Refunds |
| Refund issued | "Refund issued" + amount | Returns & Refunds |
| Seller accepts your offer | "Bargain offer accepted!" | Bargaining |
| Seller rejects your offer | "Bargain offer rejected" | Bargaining |
| Seller counters your offer | "New counter-offer received" | Bargaining |
| New chat message (app backgrounded) | "New message from [Name]" | Chat |
| Seller replies to your review | Reply notice | Reviews |
| Price drop on a favorited product | "Price dropped on your wishlist!" | Favorites |
| Referred friend places first order | Referral bonus points credited | Referral Program |
| Monthly shopping summary | "Your Month in Shopping is ready!" | Loyalty Points |
| Login from a new device (Login Alerts on) | New-device login alert | Profile & Account Settings |
| Registration / forgot-password OTP | SMS or email code | Registration & Login |

### 3.16 Chat / Messaging

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Start a conversation with a seller | New conversation opens |
| 2 | Send/receive text messages | Delivered in real time |
| 3 | Send an image | Uploads and displays in the thread |
| 4 | Send a video | Uploads and plays in the thread |
| 5 | Record and send a voice note | Uploads with a playable voice bubble |
| 6 | Cancel a voice recording mid-record | Discarded, nothing sent |
| 7 | Send a sticker | Sent as its own message bubble |
| 8 | Create and send a custom sticker | Added to the buyer's custom pack, usable going forward |
| 9 | Open custom sticker pack with none created yet | Friendly empty state, no crash |
| 10 | Search messages | Matching messages found |
| 11 | Delete a message / a conversation | Removed as expected |
| 12 | Unread badge and online presence | Badge updates; presence reflects actual status |
| 13 | Block a user from chat | Blocked and added to the blocked list |
| 14 | Message delivery/read receipts | Status icon progresses correctly |
| 15 | Message a driver during an active delivery | Driver appears under "Active Deliveries" and can be messaged |
| 16 | Driver disappears from contacts after delivery completes | No longer listed, but history remains |
| 17 | Try to message a driver before pickup | Driver not shown yet |
| 18 | Message any seller anytime | All active stores listed, message pre-purchase |
| 19 | Contact seller from an order's details page | Opens/creates a conversation with that store |
| 20 | Verify notification: new message while app backgrounded | Push received with a preview |
| 21 | Shopyos Bot pinned at the top of chats | Always shown first with a default greeting |
| 22 | Start a conversation with Shopyos Bot | Conversation opens and is ready to use |
| 23 | Ask Shopyos Bot a question | Bot replies automatically |
| 24 | Bot escalates to a human agent | Buyer informed a human will take over |
| 25 | Bot service unavailable | Graceful fallback message, not an error |

### 3.17 Loyalty Points

| # | Scenario | Expected Result |
|---|---|---|
| 1 | View loyalty points balance | Correct current balance shown |
| 2 | View loyalty transaction history | Matches actual order history |
| 3 | Earn points after a purchase | Balance increases as expected |
| 4 | Verify notification: monthly shopping wrap | Buyer gets "Your Month in Shopping is ready!" |

### 3.18 Referral Program

| # | Scenario | Expected Result |
|---|---|---|
| 1 | View own referral code | Unique code displayed |
| 2 | Copy referral code | Copied to clipboard with confirmation |
| 3 | Share referral code | Native share sheet opens with the code |
| 4 | A friend signs up using your referral code | Referral recorded against you |
| 5 | Referred friend places their first order | You receive referral bonus points |
| 6 | Referred friend places a second order | No extra bonus is granted |
| 7 | Try to use your own referral code | Rejected or ignored — no self-bonus |

### 3.19 Snaps (Short Video/Photo Stories)

Snaps are **not** a separate tab — they appear as a horizontal, story-style row of circular store avatars near the top of the **Home** screen. Tapping a circle opens a full-screen story viewer. Buyers can only view/react to snaps — creating them is a seller-only feature.

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Snaps row appears on Home | Row of store circles shown when stores have active snaps |
| 2 | Snaps row hidden when no snaps exist | Row doesn't render |
| 3 | Open a store's story from Home | Full-screen viewer opens at that store's first snap |
| 4 | Let a snap play to the end | Auto-advances to the next snap |
| 5 | Tap left/right edges of the screen | Skips back/forward through the story |
| 6 | Pause a snap | Playback pauses and resumes correctly |
| 7 | Finish the last snap of a store's story | Auto-advances into the next store's story |
| 8 | Close the story viewer | Returns to Home |
| 9 | Tap "View Product" on a tagged snap | Opens that product's page |
| 10 | Watch a snap | View is recorded, no errors |

### 3.20 Support, Help Center & Disclaimers

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Browse Help Center/FAQs | Articles load and are readable |
| 2 | Contact support | Inquiry submitted with confirmation |
| 3 | Raise a report | Ticket created, redirected to "My Reports" |
| 4 | View report categories as a buyer | Only buyer-relevant categories shown |
| 5 | Submit a report with too short a description | Blocked with a validation message |
| 6 | View my submitted reports | List shown with status |
| 7 | Report a user or store | Report submitted with confirmation |

### 3.21 Transactions History

| # | Scenario | Expected Result |
|---|---|---|
| 1 | View transactions list | All payment transactions listed correctly |
| 2 | Compare a transaction to its order | Amounts and status match |

### 3.22 Blocking & Reporting

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Block a user/store | Added to blocked list; content/messages hidden |
| 2 | Unblock from the blocked list | Removed from the list, interactions re-enabled |

---

## 4. Cross-Cutting / Non-Functional Checks

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Pull-to-refresh on list screens | Refreshes without duplicates or crashing |
| 2 | Scroll long lists (pagination) | Loads more without skipping/duplicating |
| 3 | Poor or lost network | Graceful error/retry, no data loss |
| 4 | Role boundary enforcement | Buyer cannot access seller/driver/admin/parcel-partner screens |
| 5 | Session expires mid-use | Silently refreshes or prompts a clean re-login |
| 6 | Cross-platform check (iOS/Android/web) | Behaves consistently on every shipped platform |

---

## 5. Sign-off

| Field | Value |
|---|---|
| Tester name | |
| Date | |
| Build/version tested | |
| Environment | |
| Total cases executed / passed / failed | |
| Overall result (Approve / Reject / Approve with defects) | |
| Open defects (IDs/links) | |
| Reviewer sign-off | |
