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
| 1 | Create a new account | Account is created successfully |
| 2 | Create an account using a friend's referral code | Account is created; your friend gets notified and only gets rewarded after your first order; you receive your own referral code |
| 3 | Create an account using an incorrect referral code | You are prompted to use a valid code or leave the space empty |
| 4 | Try to log in with the wrong password or email | A clear error message appears and you are not logged in |
| 5 | Log in using your Google account | You are logged in, or a new account is created using your Google details |
| 6 | Use "Forgot password" | You can successfully reset your password and log in with the new one |
| 7 | Log in to an account that was set up by an administrator | You are required to set a new password before you can continue (skip this check if your account was not created by an administrator) |
| 8 | Go to Settings → Privacy & Security → Security, and sign out one of your active sessions | The list of active sessions is shown, and the one you sign out is logged out right away |
| 9 | Go to Settings → Logout from all devices | All sessions logged out at once |

### 3.2 Profile & Account Settings

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Go to Settings → tap your profile picture/name (Personal Information) | Correct name, phone/email, avatar, role shown |
| 2 | On Settings → Personal Information, edit your details and save | Changes saved and reflected across the app |
| 3 | On Settings → Personal Information, update your delivery location | New location saved and used for delivery quotes |
| 4 | Go to Settings → Change Password | Password updated; can log in with new password |
| 5 | Complete the first-time onboarding walkthrough, then relaunch the app | Onboarding screens not shown again |
| 6 | Trigger a legal disclaimer prompt (e.g. first bargain) and accept it | Disclaimer recorded; not shown again |
| 7 | Go to Settings → Privacy & Security | A Security Score banner is shown at the top, with a strength label ("Strong"/"Fair"/"Needs attention") and a tip for improving it |
| 8 | On Privacy & Security → Security tab, turn on Two-Factor Authentication | Toggle turns on; your Security Score increases; next login requires the second factor |
| 9 | On Privacy & Security → Security tab, turn on Biometric Login | Toggle turns on; your Security Score increases; Face ID/fingerprint unlocks the app |
| 10 | On Privacy & Security → Security tab, turn on Login Alerts | Toggle turns on; your Security Score increases slightly; you're notified when a new device signs in |
| 11 | On Privacy & Security → Security tab, open "Active Sessions" (see Registration & Login #8 for the full sign-out flow) | Opens a screen listing your logged-in devices |
| 12 | On Privacy & Security → Privacy tab, toggle Activity Tracking, Personalised Ads, and Partner Data Sharing | Each preference saves and persists after restart |
| 13 | On Privacy & Security → Privacy tab, toggle Location Access and Marketing Emails | Each preference saves and persists after restart |
| 14 | On Privacy & Security → Privacy tab, open "Privacy Policy" | Full privacy terms are shown |
| 15 | On Privacy & Security → Data tab, tap "Download My Data" | Confirmation shown that a download link will be emailed within 24 hours |
| 16 | On Privacy & Security → Data tab, tap "Delete My Account" | A warning confirmation dialog appears before anything is deleted |
| 17 | On the delete-account confirmation dialog, tap Cancel | Dialog closes, account is untouched |
| 18 | On the delete-account confirmation dialog, confirm the deletion | Confirmation that the request was received and will be processed within 30 days |
| 19 | On the main Settings screen, toggle "Push Notifications" | Notification preference updates immediately |
| 20 | Go to Settings → Shopping Stats | Buyer's own spend/order stats load correctly |

### 3.3 Home, Browse & Search

There is no separate "Categories" tab. The bottom navigation only has **Home, Search, Stores, Orders, Settings**. Category browsing lives inside the **Search** tab, not Home.

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Open the Home tab | Snaps row, banner, quick actions (Deals/For You/New In), and product sections all load without error |
| 2 | On Home, tap the cart icon in the header | Opens the Cart screen; badge count matches the number of items in your cart |
| 3 | On Home, tap the bell/notifications icon in the header | Opens Notifications; badge count matches your unread notifications |
| 4 | On Home, tap "Deals" in the quick actions row | Opens the Deals screen |
| 5 | On Home, tap "For You" in the quick actions row | Opens your personalized recommendations |
| 6 | On Home, tap "New In" in the quick actions row | Opens the Recent/newly-added products screen |
| 7 | On Home, tap "See All" on any product section (Flash Sale, Deals for You, Explore) | Opens the matching Deals or Search results screen |
| 8 | On Home, scroll the Explore section to the bottom | Next page of products loads (infinite scroll), no duplicates or crash |
| 9 | On Home, tap the floating chat button | Opens your Chat list |
| 10 | Open the Search tab | Search bar and a "Browse categories" grid are shown |
| 11 | On the Search tab, tap a category | Products in that category listed correctly |
| 12 | On the Search tab, search for a product by keyword | Relevant results returned |
| 13 | On the Search tab, search for a nonsense keyword | Friendly "no results" message, no crash |
| 14 | On Search results, open the Filter screen and apply price/sort filters | Results update to match filters |
| 15 | On the Filter screen, clear the applied filters | List returns to unfiltered state |

### 3.4 Product Details & Recommendations

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Tap any product to open its details page | Images, price, description, store info, stock status all shown |
| 2 | On a product's details page, tap the heart icon in the header | Product is favorited/unfavorited immediately (see Favorites section) |
| 3 | On a product's details page, scroll to "Similar products" | Relevant related items shown; tapping opens their page |
| 4 | Open a product that has 0 stock | Out-of-stock label shown; Add-to-Cart disabled |
| 5 | On a product's details page, tap "Chat with seller" | Opens a conversation with that store (see Chat section) |
| 6 | Open the "For You" screen (Home → quick action) as a buyer with order history | Reflects the buyer's past purchases/browsing |
| 7 | Open the "For You" screen as a brand-new buyer | Falls back to trending products, no crash |

### 3.5 Stores/Sellers Browsing

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Open the Stores tab | List of stores with name, rating, distance |
| 2 | On Stores, tap the bell/notifications icon in the header | Opens Notifications |
| 3 | On Stores, search for a store by name | Matching stores returned |
| 4 | On Stores, tap a category filter chip | Only stores in that category shown |
| 5 | On Stores, open the sort/verified filter and apply it | Store list updates accordingly |
| 6 | On Stores, tap a store | Store profile, products, and reviews shown |
| 7 | On Stores, switch to Map view | Store pins shown at correct locations; tapping one highlights it |
| 8 | On the Stores map, change the radius (1/2/5/10 km) | Only stores within the chosen radius shown |
| 9 | On the Stores map, select a category chip | Only stores in that category shown |
| 10 | On the Stores map, use the search box | Pins filter to matching store names |

### 3.6 Favorites / Wishlist

| # | Scenario | Expected Result |
|---|---|---|
| 1 | On a product's page or a product list, tap the heart/favorite icon | Product added; heart icon updates immediately |
| 2 | From the Favorites screen (or a product's page), unfavorite an item | Removed everywhere it's shown |
| 3 | Go to Settings → My Favorites | All favorited products listed correctly |
| 4 | Favorite an item, log out, then log back in | Still favorited after logging out and back in |
| 5 | Favorite a product, then have its price reduced | Buyer gets a "Price dropped on your wishlist!" notification |

### 3.7 Shopping Cart

| # | Scenario | Expected Result |
|---|---|---|
| 1 | On a product's page, choose a quantity/variant and tap Add to Cart | Item appears in cart; cart badge updates |
| 2 | Open the Cart screen and change an item's quantity | Line total and cart total recalculate correctly |
| 3 | On the Cart screen, remove an item | Item removed, totals update |
| 4 | On the Cart screen, tap "Clear cart" | Cart emptied |
| 5 | On the Cart screen, try to set a quantity above available stock | Blocked or capped with a clear message |
| 6 | Add items to the cart, log out, then log back in | Cart contents preserved after logging back in |
| 7 | Add items from two different stores to the cart | App handles the multi-store cart correctly at checkout |

### 3.8 Bargaining (Make an Offer)

| # | Scenario | Expected Result |
|---|---|---|
| 1 | On an eligible product's page, tap "Make Offer" and submit a price | Offer sent to seller, appears in "My Offers" as pending |
| 2 | Go to Settings → My Bargains, open an offer's history | Full back-and-forth timeline shown |
| 3 | On Settings → My Bargains, respond to a seller's counter-offer | Accepted offer becomes actionable |
| 4 | On Settings → My Bargains, withdraw a pending offer | Offer marked withdrawn |
| 5 | On an accepted offer in My Bargains, tap Add to Cart | Added at the bargained price |
| 6 | Have a seller accept your offer | Buyer gets "Bargain offer accepted!" notification |
| 7 | Have a seller reject your offer | Buyer gets "Bargain offer rejected" notification |
| 8 | Have a seller send a counter-offer | Buyer gets a "New counter-offer received" notification |

### 3.9 Checkout, Payment Methods & Promo Codes

| # | Scenario | Expected Result |
|---|---|---|
| 1 | From the Cart, tap Checkout, confirm address and payment, then place the order | Order created, payment succeeds, receipt shown |
| 2 | Immediately after placing an order | Buyer gets "Order Placed Successfully" notification |
| 3 | Try to reach Checkout with an empty cart | Checkout blocked with a clear message |
| 4 | At Checkout, enter a valid promo code | Discount applied, total recalculated |
| 5 | At Checkout, enter an invalid/expired promo code | Clear rejection message, no discount applied |
| 6 | At Checkout, review the delivery fee quote | Fee shown and included in the total |
| 7 | Go to Settings → Payment Methods, and add a new card | Card saved and selectable at checkout |
| 8 | On Settings → Payment Methods, delete a saved card | Card removed, no longer selectable |
| 9 | At Checkout, pay using a previously saved card | Payment completes without re-entering card details |
| 10 | At Checkout, pay with a test card that declines | Order not confirmed; clear failure message; cart preserved to retry |
| 11 | After paying, check the order's status a few seconds later | Order status updates to paid/confirmed without a manual refresh |
| 12 | After a payment is confirmed | Buyer gets "Payment Confirmed" notification |
| 13 | After a successful order, open the Receipt screen | Itemized receipt matches the order |
| 14 | At Checkout, pay using Mobile Money (MoMo) | Payment completes, order confirmed |
| 15 | At Checkout, apply available loyalty points | Points discount applied; loyalty balance decreases after order |
| 16 | Check out with items from 2+ stores in the cart | Delivery fee shown per store and summed correctly |
| 17 | Check out with a store located outside your region | Parcel transit fee and estimated transit days shown separately |
| 18 | At Checkout, set a delivery address the store doesn't reach | Clear "out of range" message; checkout blocked or fee adjusted |
| 19 | On an inter-regional order at Checkout, choose the free hub-pickup option | No last-mile fee added to the total |
| 20 | On an inter-regional order at Checkout, choose paid home delivery | Last-mile fee added and itemized in the total |
| 21 | Check out with items from 2+ out-of-region stores | Transit fee summed correctly per store |

### 3.10 Flash Sales & Deals

| # | Scenario | Expected Result |
|---|---|---|
| 1 | From Home, open Deals while a flash sale is active | Sale items, discounted prices, and countdown shown |
| 2 | From Home, open Deals when no sale is running | Friendly empty state, no crash |
| 3 | Buy a flash-sale item from Deals | Discounted price honored through checkout |

### 3.11 Order Placement, History & Cancellation

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Open the Orders tab | All past/current orders listed, most recent first |
| 2 | On Orders, use the search field | Matching orders found by order number/keyword |
| 3 | On Orders, tap a status filter chip (e.g. All/Processing/Delivered) | List filters to that status |
| 4 | On Orders, tap an order to view its details | Items, status, timeline, delivery info, totals all accurate |
| 5 | On an order's details page, tap Cancel (before it's dispatched) | Order cancelled; refund initiated if applicable |
| 6 | Try to cancel an order that's already in transit or delivered | Cancel option disabled/rejected with an explanation |
| 7 | On a delivered order's details page, tap "Confirm Delivery" | Order marked complete |

### 3.12 Delivery Tracking (Local & Inter-Regional)

| # | Scenario | Expected Result |
|---|---|---|
| 1 | On an order's details page, open Tracking | Correct stage shown (assigned/picked up/in transit/delivered) |
| 2 | On the Tracking screen for an in-transit order | Driver, pickup, and drop-off markers shown with a route line; driver marker updates live |
| 3 | Open Tracking right after a driver is assigned | Camera zooms/pans to show all markers |
| 4 | On the Tracking screen, tap to message the driver | Opens a chat with the driver |
| 5 | On the Tracking screen, confirm the delivery PIN with the driver | PIN verification completes the delivery |
| 6 | At Cart/Checkout, review the delivery fee quote before ordering | Fee matches distance/rules and the final charge |
| 7 | On an inter-regional order, open the Transit Tracker screen | Origin/destination hub names and tracking number shown |
| 8 | Follow an inter-regional order's Transit Tracker through all its stages | Status label updates correctly at each stage |
| 9 | On the Transit Tracker, check the estimated hub arrival date | Shown before the parcel reaches the destination hub |
| 10 | On the Transit Tracker, once the parcel reaches the hub, request home delivery | Fee shown; request succeeds |
| 11 | On the Transit Tracker, try to request home delivery without accepting the terms checkbox | Blocked until the terms are accepted |
| 12 | On the Transit Tracker, choose not to request home delivery | Free in-person pickup available at the hub, no fee charged |
| 13 | On the Transit Tracker, scroll to the status history | Each stage shows a timestamp and hub name |
| 14 | Have a driver get assigned to your delivery | Buyer notified when a driver is assigned |
| 15 | Have your order marked picked up by the driver | Buyer gets "Order Picked Up" notification with the delivery PIN |
| 16 | Have your order marked in transit | Buyer notified when the order is in transit |
| 17 | Have your order marked delivered | Buyer notified when the order is delivered |
| 18 | Have a delivery fail or get cancelled mid-transit | Buyer notified and advised to contact support |

### 3.13 Returns & Refunds

| # | Scenario | Expected Result |
|---|---|---|
| 1 | On a delivered order's details page, tap Return, pick a reason/items, and submit | Request created, shown as pending in "My Returns" |
| 2 | Go to Settings → My Returns | Status shown accurately (pending/approved/rejected/completed) |
| 3 | On My Returns, respond to the seller's follow-up on a return | Response recorded, status updates |
| 4 | Try to return an ineligible or expired-window item | Blocked with an explanation |
| 5 | Have a seller approve your return | Buyer notified the return was approved |
| 6 | Have a seller decline your return | Buyer notified with the seller's reason |
| 7 | Have a refund be processed for an approved return | Buyer notified with the refunded amount |

### 3.14 Reviews & Ratings

| # | Scenario | Expected Result |
|---|---|---|
| 1 | On a product's details page, tap "Write a Review" | Review saved and visible on the product page |
| 2 | On a delivered order's details page, tap "Leave a Review" | Opens a review form covering the order (store and/or driver) |
| 3 | On a completed delivery's review form, rate the driver | Review saved |
| 4 | Go to Settings → My Reviews, switch between Products/Stores/Drivers tabs | Each tab lists only your reviews of that type |
| 5 | On Settings → My Reviews (Products tab), edit one of your reviews | Update reflected everywhere it's shown |
| 6 | On Settings → My Reviews, delete one of your reviews (any type) | Removed from the list and from the product/store page |
| 7 | Try to review a product that hasn't been delivered yet | Blocked — only delivered items are reviewable |
| 8 | On a product's reviews list, like a review and add a comment | Like count increments; comment appears |
| 9 | Have a seller reply to one of your reviews | Buyer notified of the seller's reply |

### 3.15 Notifications

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Trigger any order-status change | Push notification received on device |
| 2 | From Home or Stores, tap the bell icon | Opens Notifications; all notifications shown with correct read/unread state |
| 3 | On Notifications, tap one / tap "Mark all as read" | Unread badge updates accordingly |
| 4 | On Notifications, delete one / tap "Delete all" | Removed from the list |
| 5 | Go to Settings → Push Notifications, and toggle categories | Disabled categories stop sending pushes |
| 6 | Log in on a device for the first time | Pushes actually arrive on that device |
| 7 | On Notifications, filter by a category (orders, chat, promotions) | Only that category shown |

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

There is no "Chat" tab. The chat list is reached via the floating chat button on Home. Individual conversations can also be started directly from a product's details page ("Chat with seller"), a store's details page ("Chat with store"), or an order's details page (separate chat icons for the seller and the driver).

| # | Scenario | Expected Result |
|---|---|---|
| 1 | On a product's details page, tap "Chat with seller" | New conversation opens |
| 2 | On a store's details page, tap "Chat with store" | New conversation opens |
| 3 | On an order's details page, tap the seller chat icon, then separately the driver chat icon | Each opens the correct conversation with that person |
| 4 | In an open conversation, send/receive text messages | Delivered in real time |
| 5 | In a conversation, attach and send an image | Uploads and displays in the thread |
| 6 | In a conversation, attach and send a video | Uploads and plays in the thread |
| 7 | In a conversation, record and send a voice note | Uploads with a playable voice bubble |
| 8 | In a conversation, start recording a voice note then cancel it | Discarded, nothing sent |
| 9 | In a conversation, tap the sticker icon and send a sticker | Sent as its own message bubble |
| 10 | In the sticker picker's "Custom" tab, upload a photo as a custom sticker | Added to the buyer's custom pack, usable going forward |
| 11 | Open the sticker picker's "Custom" tab with none created yet | Friendly empty state, no crash |
| 12 | From Home, tap the floating chat button, then use the search feature | Matching messages found |
| 13 | Delete a single message, then delete an entire conversation | Removed as expected |
| 14 | Receive a message while the app is backgrounded; check a contact's status | Badge updates; presence reflects actual status |
| 15 | In a conversation, open the "•••" more-options menu and tap "Block User", then confirm | Blocked and added to the blocked list |
| 16 | Send a message and watch its status icon | Status icon progresses correctly |
| 17 | From Home, tap the floating chat button while a delivery is picked up/in transit | Driver appears under "Active Deliveries" and can be messaged |
| 18 | Open the chat list again after that delivery completes | No longer listed, but history remains |
| 19 | Open the chat list before the delivery is picked up | Driver not shown yet |
| 20 | Open the chat list | All active stores listed, message pre-purchase |
| 21 | Background the app, then have someone message you | Push received with a preview |
| 22 | From Home, tap the floating chat button | "Shopyos Bot" always shown pinned first with a default greeting |
| 23 | Tap the pinned Shopyos Bot entry | Conversation opens and is ready to use |
| 24 | Send Shopyos Bot a question (e.g. "Where is my order?") | Bot replies automatically |
| 25 | Send Shopyos Bot a message it can't resolve / ask for a human | Buyer informed a human will take over |
| 26 | Message Shopyos Bot while the AI service is unavailable (test env) | Graceful fallback message, not an error |

### 3.17 Loyalty Points

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Go to Settings → Loyalty Points | Correct current balance shown |
| 2 | On Settings → Loyalty Points, scroll through the transaction history | Matches actual order history |
| 3 | Complete an order that earns points, then recheck your balance | Balance increases as expected |
| 4 | Wait for/trigger the monthly wrap job | Buyer gets "Your Month in Shopping is ready!" |

### 3.18 Referral Program

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Go to Settings → Personal Information | Your unique referral code is displayed near the top, under your name |
| 2 | On Personal Information, tap the referral code | Copied to clipboard with confirmation |
| 3 | On Personal Information, tap the share icon next to the referral code | Native share sheet opens with the code |
| 4 | Have a friend register using your referral code | Referral recorded against you |
| 5 | Have that referred friend place their first order | You receive referral bonus points |
| 6 | Have that referred friend place a second order | No extra bonus is granted |
| 7 | Try registering a new account using your own referral code | Rejected or ignored — no self-bonus |

### 3.19 Snaps (Short Video/Photo Stories)

Snaps are **not** a separate tab — they appear as a horizontal, story-style row of circular store avatars near the top of the **Home** screen. Tapping a circle opens a full-screen story viewer. Buyers can only view/react to snaps — creating them is a seller-only feature.

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Open the Home screen (with stores that have active snaps) | Row of store circles shown near the top of Home |
| 2 | Open the Home screen when no store has posted a snap | Row doesn't render |
| 3 | On Home, tap a store's circle in the Snaps row | Full-screen viewer opens at that store's first snap |
| 4 | In the story viewer, let a snap play to the end | Auto-advances to the next snap |
| 5 | In the story viewer, tap the left/right edges of the screen | Skips back/forward through the story |
| 6 | In the story viewer, tap-and-hold a playing snap | Playback pauses and resumes correctly |
| 7 | In the story viewer, let the last snap of a store's story finish | Auto-advances into the next store's story |
| 8 | In the story viewer, tap the close/X control | Returns to Home |
| 9 | In the story viewer, tap "View Product" on a tagged snap | Opens that product's page |
| 10 | Watch a snap in the story viewer | View is recorded, no errors |

### 3.20 Support, Help Center & Disclaimers

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Go to Settings → Help Center | Articles load and are readable |
| 2 | On Help Center, tap "Contact Us" and submit an inquiry | Inquiry submitted with confirmation |
| 3 | Go to Settings → Raise a Report, fill it out, and submit | Ticket created, redirected to "My Reports" |
| 4 | On Raise a Report, open the category picker | Only buyer-relevant categories shown |
| 5 | On Raise a Report, submit with a description under 20 characters | Blocked with a validation message |
| 6 | Go to Settings → My Reports | List shown with status |
| 7 | From a chat/store/profile page, use the Report action | Report submitted with confirmation |

### 3.21 Transactions History

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Go to Settings → Transaction History | All payment transactions listed correctly |
| 2 | Compare a transaction entry to its related order/receipt | Amounts and status match |

### 3.22 Blocking & Reporting

| # | Scenario | Expected Result |
|---|---|---|
| 1 | In a chat conversation, open the "•••" more-options menu, tap "Block User", and confirm | The other user is blocked; content/messages hidden |
| 2 | Go to Settings → Blocked Users | The blocked user appears in the list |
| 3 | On Settings → Blocked Users, tap "Unblock" on someone | Removed from the list; they can message you again |

---

## 4. Cross-Cutting / Non-Functional Checks

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Pull down to refresh on list screens (Home, Orders, Notifications, Chat) | Refreshes without duplicates or crashing |
| 2 | Scroll to the bottom of long lists | Loads more without skipping/duplicating |
| 3 | Use the app with a poor or lost network connection | Graceful error/retry, no data loss |
| 4 | While logged in as a buyer, try to open seller/driver/admin/parcel-partner screens directly | Access blocked |
| 5 | Leave the app idle until the session expires, then perform an action | Silently refreshes or prompts a clean re-login |
| 6 | Repeat the high-priority cases above on iOS, Android, and web | Behaves consistently on every shipped platform |

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
