# Shopyos — UAT Test Plan: Seller Role

## 1. Purpose & Scope

This document defines the User Acceptance Test (UAT) cases for the **seller** (business) role in Shopyos. It covers registration & verification, store profile/settings, the dashboard, product & inventory management, order fulfillment, bargaining, analytics, community (messages & reviews), delivery settings, payouts/earnings/transactions, promotions (ad campaigns), flash sales, snaps, and notifications.

Out of scope: buyer app, driver app, parcel-partner console, and admin console — covered by separate UAT plans.

## 2. Test Environment & Preconditions

- **Build under test:** _____________ (app version / commit hash)
- **Test accounts needed:**
  - One brand-new seller account (no business registered yet).
  - One seller account with a business pending verification.
  - One seller account with a **verified** business, with published products, at least one order in each status (paid, confirmed, ready for pickup, delivered), at least one pending bargain offer, and some sales history for analytics/earnings.
  - A buyer account to place test orders, send chat messages, leave reviews, and make bargain offers against the seller's products.
- **Devices:** iOS device/simulator, Android device/emulator, and (if supported) web build.

**Proof of testing:** each test case requires a screenshot (or short screen recording) showing the actual result — attach it on the UAT sign-off form, not in this document.

---

## 3. Test Cases by Feature Area

### 3.1 Business Registration & Verification

| # | Scenario | Expected Result |
|---|---|---|
| 1 | As a brand-new seller (no business yet), open the app | You're prompted/guided to register your business |
| 2 | Fill out the business registration form (brand name, category, contact/location, payout method, accept the Seller Commission Agreement) and submit | Business created; you land on the dashboard or verification status screen |
| 3 | Submit registration with a required field missing | Blocked with a clear validation message |
| 4 | As an unverified seller, open Settings | A notice explains that only "Edit Profile" and "Log Out" are available until verification completes; other menu rows are disabled |
| 5 | Open the verification status screen | Current status shown (Awaiting Approval / Rejected / Verified), with a progress-steps list |
| 6 | On the verification status screen, tap "Update Application"/"Resubmit Details" | Opens the document-submission form (owner name, registration number, tax ID, business type, address, category, description, logo, and at least one of Business Certificate/License, plus optional Proof of Bank) |
| 7 | Submit the verification documents | Confirmation shown; redirected back to the status screen |
| 8 | On the status screen, tap "Tap to check status" | App re-checks with the server and shows a "Synchronizing" state, then either a congratulations message or "still under review" |
| 9 | As a seller whose application was rejected, open the app | You're redirected to the verification status screen automatically, with the rejection reason shown |
| 10 | Try to reach Settings → "Update Registration Details" while still unverified | Row is disabled and shows a restricted message — this row is intentionally locked until verified |
| 11 | On the registration form's location picker, type an address in the search box | The map moves to that real address, not a random nearby point |
| 12 | On the location picker, search for an address that doesn't exist/can't be found | A clear "No Results" message shown, map doesn't move |
| 13 | Confirm a pinned location on the map | Location saved to your registration details |

### 3.2 Store Profile & Settings

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Go to Settings | Business logo/name, email, and verification status pill shown |
| 2 | On Settings, tap "Edit" on the profile card | Opens the store profile editor (name, description, category, address/city/state/country, phone, website, Instagram, Facebook, logo, cover image) |
| 3 | Edit and save your store profile | Changes saved and reflected on your storefront |
| 4 | As a verified seller, go to Settings → Delivery Settings | Can set a base delivery fee, a per-kilometer fee, and either a maximum delivery distance or "No limit" |
| 5 | Save delivery settings with new values | Values persist and are used for future delivery fee quotes |
| 6 | Go to Settings → Payout Methods | Shows current payout method (bank/mobile money); if none is set, directs you to set one up |
| 7 | Go to Settings → Transaction History | A searchable, filterable (All/Sales/Payouts) list of your ledger entries |
| 8 | Tap Settings → "Security & Privacy" | Opens the security/privacy screen (2FA, sessions, data preferences) |
| 9 | Toggle Settings → "Push Notifications" | Preference saves and persists after closing and reopening the app |
| 10 | Go to Settings → Raise a Report / My Reports / Help Center / Contact Support | Each opens correctly and works as expected |
| 11 | Go to Settings → Earnings | Opens a Week/Month/Quarter sales chart with Orders/Payouts/Refunds breakdown |
| 12 | Go to Settings → Inventory | Opens the stock/low-stock management screen |
| 13 | Go to Settings → "Shop as Buyer" | Switches your active mode to buyer and takes you to the buyer Home screen |
| 14 | Go to Settings → Log Out, confirm | Logged out and returned to the login screen |

### 3.3 Dashboard

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Open the Home tab (dashboard) | Balance, Orders, In Escrow, and Products stats shown |
| 2 | On the dashboard, switch the revenue chart between Weekly/Monthly/Yearly | Chart updates to match the selected range |
| 3 | On the dashboard, tap the store name/logo row | A "Switch Profile" bottom sheet opens, letting you switch businesses or register another store |
| 4 | On the dashboard, tap the notification bell | Opens Notifications |
| 5 | On the dashboard, tap the settings gear | Opens Settings |
| 6 | On the dashboard, tap each quick action: Add Item, My Snaps, Orders, Promote, Analytics, Flash Sales | Each opens the correct screen |
| 7 | On the dashboard, view "Recent Orders" and tap a row | Flag as a defect if tapping a recent-order row does nothing — only "View All" is currently expected to navigate |
| 8 | On the dashboard, tap "View All" under Recent Orders | Opens the Orders tab |

### 3.4 Products

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Open the Products tab | Total Items and Portfolio Value cards shown, plus Total/Active/Inactive counts |
| 2 | On Products, use the search bar | Matching products found |
| 3 | On Products, tap a filter chip (All/Active/Inactive) | List filters accordingly |
| 4 | On Products, tap "Add Product" | Opens the product form (title, image, status, description, category, price, compare-at price, stock, category-specific fields like color/size/material/connectivity, brand) |
| 5 | Fill out and submit a new product | Product created and appears in your list |
| 6 | Submit a new product without a required field (e.g. no image, or missing category) | Blocked with a clear validation message |
| 7 | On Products, tap the Edit icon on an existing product | Opens the same form pre-filled with that product's data, including a Bargaining Enabled/Disabled toggle (only shown when editing, not at creation) |
| 8 | Edit a product's price/stock/status and save | Changes reflected in the list and on the buyer-facing product page |
| 9 | On Products, tap the Delete icon on a product, confirm | Product removed from your list |
| 10 | Try to toggle a product active/inactive directly from the list (without opening Edit) | Flag as a defect if there's no such shortcut — currently this can only be done via Edit |
| 11 | As an unverified seller, try to add/edit a product | Blocked with a message that product management is locked until verification |
| 12 | On Products, tap the "Incoming Bargains" shortcut | Opens the Bargains screen |

### 3.5 Bargaining (Incoming Offers)

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Open Bargains from the Products screen | "Pending Review" and "Bargain History" tabs shown |
| 2 | On Pending Review, tap "Reject" on an offer | Offer marked rejected and moves to History |
| 3 | On Pending Review, tap "Accept Bid" on an offer | Offer accepted; buyer can now check out at that price |
| 4 | On Pending Review, tap "Counter" on an offer, enter a price lower than the original price, submit | Counter-offer sent to the buyer; round counter increments (e.g. "Counter (1/3)") |
| 5 | Try to submit a counter price equal to or higher than the original price | Blocked with a validation message |
| 6 | Reach the maximum number of counter rounds on an offer | The "Counter" option is no longer available for that offer |
| 7 | Open "Bargain History" | Shows all resolved offers (accepted/rejected/checked out/withdrawn/expired) |

### 3.6 Orders

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Open the Orders tab | Earned/In Escrow cards and Awaiting/Processing/Delivered/Cancelled counts shown |
| 2 | On Orders, tap a status filter chip | List filters to that status |
| 3 | On Orders, tap an order | Opens that order's details |
| 4 | On a paid order's details, tap "Confirm", then confirm the prompt | Status moves to Confirmed |
| 5 | On a confirmed order's details, tap "Mark Ready", then confirm | Status moves to Ready for Pickup, with a note that you're now waiting for a driver to accept it |
| 6 | On an order not yet delivered/cancelled, tap "Cancel", then confirm | Order cancelled |
| 7 | On an order's details, tap the customer's Chat icon | Opens a conversation with the buyer |
| 8 | On an order's details, tap the customer's Call icon | Opens the phone dialer with the buyer's number |
| 9 | On an order's details (once a driver is assigned), tap the driver's Chat/Call icons | Opens a conversation / dialer for the driver |
| 10 | On an order's details, tap "Track on Map" | Opens the delivery tracking map |
| 11 | Review an order's billing summary (subtotal, buyer protection fee, delivery fee, discount, total, payment method) | Matches the actual order |

### 3.7 Inventory

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Go to Settings → Inventory (or tap a low-stock/back-in-stock notification) | Opens the Inventory screen |
| 2 | On Inventory, review the stat cards (Items, Stock, Low Stock, Value) | Numbers match your actual catalog |
| 3 | On Inventory, use the search bar and category chips | Results filter correctly |
| 4 | On Inventory, sort by Name/Stock/Price | List reorders correctly |
| 5 | On Inventory, a product with under 10 units | Flagged as "Low Stock" |
| 6 | On Inventory, tap a product row | Opens that product's edit form, pre-filled (same edit screen used from the Products tab) |

### 3.8 Analytics

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Open the Stats tab | Revenue trend chart and stat cards (Revenue, In Escrow, Orders, Repeat Customers %) shown |
| 2 | Switch between Weekly/Monthly/Yearly | Chart and stats update accordingly |
| 3 | Select "Custom" range, type a valid start/end date (YYYY-MM-DD, start ≤ end), apply | Chart and stats update to that range |
| 4 | Enter an invalid or malformed custom date (bad format, or start after end) | Blocked with a clear "Invalid Date Range" message |
| 5 | View the Category Breakdown pie chart | Only shown when there's category sales data; otherwise hidden cleanly |
| 6 | View Top Products | Ranked list with units sold and revenue per product |
| 7 | View the "Customer Loyalty" banner | Shows your real repeat-customer percentage, matching the "Repeat Customers" stat card above it |

### 3.9 Community — Messages

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Open the Community tab | Messages and Reviews sub-tabs shown, with "Shopyos Bot" always pinned first in Messages |
| 2 | On Messages, use the search box and filter chips (All/Unread/Read) | Conversation list filters correctly |
| 3 | Tap a conversation | Opens the chat; marks it as read |
| 4 | Send/receive a message with a buyer | Delivered in real time |

### 3.10 Community — Reviews

| # | Scenario | Expected Result |
|---|---|---|
| 1 | On Community → Reviews, use the search box and filter chips (All/5 Stars/4 Stars/Below 4) | List filters correctly |
| 2 | On a review with no reply yet, tap "Reply" and submit a response | Reply saved and shown inline under that review |
| 3 | On a review that already has your reply | Reply shown inline instead of a Reply button (no edit-reply option — confirm this is expected) |

### 3.11 Payouts, Earnings & Transactions

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Go to Settings → Payout Methods | Available balance and locked balance (funds still in the return window) shown |
| 2 | Tap "Request Early Payout", enter an amount, accept the Payout Terms, submit | Payout request submitted |
| 3 | Try to request a payout larger than your available balance | Blocked with a clear message |
| 4 | View "Locked Earnings" | Expandable list of funds still held in the return window |
| 5 | View your payout method, tap "Edit" | Takes you to the business registration form to update it |
| 6 | Go to Settings → Earnings (or tap an earnings/payment notification) | Opens the Earnings screen with a Week/Month/Quarter chart and Orders/Payouts/Refunds breakdown |
| 7 | Go to Settings → Transaction History | Searchable/filterable (All/Sales/Payouts) ledger list, consistent with the Earnings screen's numbers |

### 3.12 Promotions (Ad Campaigns)

There is no classic "discount/promo code" creator here — this screen manages **paid banner ad campaigns** for your store or products.

| # | Scenario | Expected Result |
|---|---|---|
| 1 | From the dashboard, tap "Promote" | Opens Promotions with "My Campaigns" and "Create New Ad" tabs |
| 2 | On "Create New Ad", choose Store Ad or Product Ad, set a name, pick a duration tier (1 day/₵1, 1 week/₵10, 1 month/₵50), upload a banner, accept the Advertising Terms, submit | Campaign submitted for admin approval (not immediately live) |
| 3 | On "My Campaigns", find a campaign with status "Approved" | A "Pay Now" button is available |
| 4 | Tap "Pay Now" and complete payment | Payment processed (Paystack); campaign becomes Active once verified |
| 5 | Check the Paystack receipt/confirmation email after paying | Sent to your own account email — not a generic shared address |
| 6 | View a campaign's clicks and spend | Numbers shown and update over time |

### 3.13 Flash Sales

| # | Scenario | Expected Result |
|---|---|---|
| 1 | From the dashboard, tap "Flash Sales" | "My Campaigns" and "Available Slots" tabs shown |
| 2 | On "Available Slots", tap "Submit Products" on an open slot | Opens the flash-sale submission form |
| 3 | Select products, set a flash price below the original price and a reserved stock limit, accept the Flash Sale Terms, submit | Submission sent for admin review — confirm it does **not** go live immediately |
| 4 | Try to set a flash price equal to or above the original price | Blocked with a validation message |
| 5 | On "My Campaigns", view a submission's status (Pending Approval/Approved/Live/Rejected/Ended) | Status and any admin feedback notes shown accurately |
| 6 | On a pending or approved flash sale, tap "Cancel Flash Sale" | Submission cancelled |

### 3.14 Snaps

| # | Scenario | Expected Result |
|---|---|---|
| 1 | From the dashboard, tap "My Snaps" | Opens your snaps list (empty state with a create prompt if none yet) |
| 2 | Tap "Create" | Opens the snap creation screen |
| 3 | Pick a photo, or record/pick a video (up to 60 seconds, up to 100MB) | Media selected and previewed |
| 4 | Add a caption (up to 100 characters), accept the Content Policy, post | Snap goes live; confirmation states it will be visible for 24 hours |
| 5 | While posting, watch the upload progress bar (especially on a slow connection) | Percentage reflects actual upload progress, not a fixed animation unrelated to network speed |
| 6 | Try to upload a video longer than 60 seconds or larger than 100MB | Blocked with a clear message |
| 7 | Check that your posted snap appears in the buyer app's Home story row | Visible to buyers under your store's circle |

### 3.15 Notifications

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Tap the bell icon from any main seller screen (Dashboard, Products, Orders, Analytics, Community) | Opens Notifications |
| 2 | View notifications grouped by Today/Yesterday/Earlier | Correctly grouped and read/unread state shown |
| 3 | Mark a notification as read / mark all as read | Unread badge updates accordingly |
| 4 | Tap a new-order notification | Opens that order's details |
| 5 | Tap a low-stock notification | Opens Inventory |
| 6 | Tap a payment/earnings notification | Opens Earnings |
| 7 | Receive a push notification while the app is backgrounded | Push arrives on device |

---

## 4. Cross-Cutting / Non-Functional Checks

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Pull down to refresh on list screens (Products, Orders, Notifications) | Refreshes without duplicates or crashing |
| 2 | Use the app with a poor or lost network connection | Graceful error/retry, no data loss |
| 3 | While logged in as a seller, try to open buyer/driver/admin/parcel-partner screens directly | Access blocked |
| 4 | Switch between multiple businesses (if you own more than one) via the profile switcher | Correct business's data loads throughout the app |
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
