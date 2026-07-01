const fs = require("fs");

const logo = "assets/images/icondark.png";

const baseCss = `
  body { margin:0; padding:0; background:#f1f3f4; color:#202124; font-family:Arial, Helvetica, sans-serif; -webkit-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; display:block; }
  a { color:#1a73e8; text-decoration:none; }
  .page { width:100%; background:#f1f3f4; padding:32px 12px; }
  .container { width:100%; max-width:640px; margin:0 auto; }
  .preheader { display:none!important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; mso-hide:all; }
  .brand { padding:0 0 18px; text-align:left; }
  .brand img { width:164px; height:auto; }
  .card { background:#ffffff; border:1px solid #dadce0; border-radius:8px; overflow:hidden; }
  .mast { padding:32px 40px 22px; border-bottom:1px solid #e8eaed; }
  .eyebrow { margin:0 0 12px; color:#5f6368; font-size:13px; line-height:20px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
  h1 { margin:0; color:#202124; font-size:28px; line-height:36px; font-weight:400; letter-spacing:0; }
  .summary { margin:14px 0 0; color:#5f6368; font-size:16px; line-height:24px; }
  .content { padding:30px 40px 36px; }
  p { margin:0 0 16px; color:#3c4043; font-size:15px; line-height:24px; }
  .button-wrap { padding:10px 0 24px; }
  .button { display:inline-block; background:#1a73e8; color:#ffffff!important; border-radius:4px; font-size:14px; line-height:20px; font-weight:700; padding:12px 24px; }
  .button.green { background:#7ed348; color:#0b1f46!important; }
  .note { background:#f8fafd; border:1px solid #e8eaed; border-radius:8px; padding:16px 18px; margin:8px 0 22px; }
  .note p { margin:0; color:#5f6368; font-size:14px; line-height:22px; }
  .code { background:#f8fafd; border:1px solid #dadce0; border-radius:8px; color:#0b1f46; font-size:36px; line-height:44px; font-weight:700; letter-spacing:8px; text-align:center; padding:22px 10px; margin:8px 0 20px; }
  .details { width:100%; margin:6px 0 22px; border:1px solid #e8eaed; border-radius:8px; overflow:hidden; }
  .details td { padding:12px 16px; border-bottom:1px solid #e8eaed; font-size:14px; line-height:20px; }
  .details tr:last-child td { border-bottom:0; }
  .label { color:#5f6368; width:44%; }
  .value { color:#202124; font-weight:700; text-align:right; }
  .item { width:100%; border-bottom:1px solid #e8eaed; }
  .item td { padding:14px 0; vertical-align:top; }
  .thumb { width:44px; height:44px; border-radius:8px; background:#eef3ff; color:#24418f; font-size:20px; text-align:center; line-height:44px; }
  .item-title { color:#202124; font-size:14px; line-height:20px; font-weight:700; }
  .item-meta { color:#5f6368; font-size:13px; line-height:20px; }
  .price { color:#202124; font-size:14px; line-height:20px; font-weight:700; text-align:right; white-space:nowrap; }
  .total td { padding:8px 0; color:#3c4043; font-size:14px; line-height:20px; }
  .total .final td { padding-top:14px; border-top:1px solid #dadce0; color:#202124; font-size:16px; font-weight:700; }
  .steps { width:100%; margin:8px 0 24px; }
  .steps td { color:#5f6368; font-size:12px; line-height:18px; text-align:center; }
  .dot { width:22px; height:22px; border-radius:50%; background:#7ed348; color:#0b1f46; font-weight:700; line-height:22px; margin:0 auto 8px; }
  .dot.muted { background:#e8eaed; color:#5f6368; }
  .products { width:100%; margin:8px 0 22px; }
  .products td { width:50%; padding:8px; vertical-align:top; }
  .product { border:1px solid #e8eaed; border-radius:8px; padding:16px; text-align:center; }
  .product-name { color:#202124; font-size:14px; line-height:20px; font-weight:700; }
  .product-price { color:#0b1f46; font-size:16px; line-height:24px; font-weight:700; }
  .pill { display:inline-block; margin-top:8px; background:#e6f4ea; color:#137333; border-radius:999px; padding:4px 10px; font-size:12px; line-height:16px; font-weight:700; }
  .footer { padding:22px 8px 0; text-align:center; color:#5f6368; font-size:12px; line-height:20px; }
  .footer a { color:#5f6368; text-decoration:underline; }
  @media only screen and (max-width:520px) {
    .page { padding:20px 8px!important; }
    .mast, .content { padding-left:22px!important; padding-right:22px!important; }
    h1 { font-size:24px!important; line-height:31px!important; }
    .products td { display:block!important; width:100%!important; padding:8px 0!important; }
    .brand img { width:144px!important; }
  }`;

function layout({ title, preheader, eyebrow, heading, summary, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>${baseCss}</style>
</head>
<body>
<span class="preheader">${preheader}</span>
<table role="presentation" class="page" width="100%">
  <tr>
    <td align="center">
      <table role="presentation" class="container" width="100%">
        <tr><td class="brand"><img src="${logo}" alt="Shopyos" width="164"></td></tr>
        <tr>
          <td class="card">
            <table role="presentation" width="100%">
              <tr><td class="mast">
                <p class="eyebrow">${eyebrow}</p>
                <h1>${heading}</h1>
                <p class="summary">${summary}</p>
              </td></tr>
              <tr><td class="content">${body}</td></tr>
            </table>
          </td>
        </tr>
        <tr><td class="footer">
          <p>Shopyos, Kumasi, Ghana<br>Need help? <a href="#">Visit Help Center</a> or reply to this email.</p>
          <p><a href="#">Privacy Policy</a> &nbsp;|&nbsp; <a href="#">Terms</a> &nbsp;|&nbsp; <a href="#">Unsubscribe</a></p>
          <p>&copy; 2026 Shopyos. The future of local commerce.</p>
        </td></tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`;
}

const details = rows => `<table role="presentation" class="details" width="100%">${rows.map(([a,b]) => `<tr><td class="label">${a}</td><td class="value">${b}</td></tr>`).join("")}</table>`;
const button = (label, cls = "") => `<div class="button-wrap"><a href="#" class="button ${cls}">${label}</a></div>`;
const item = (icon, name, meta, price) => `<table role="presentation" class="item" width="100%"><tr><td width="58"><div class="thumb">${icon}</div></td><td><div class="item-title">${name}</div><div class="item-meta">${meta}</div></td><td class="price">${price}</td></tr></table>`;

const pages = {
  "01-welcome.html": layout({
    title: "Shopyos - Welcome",
    preheader: "Your Shopyos account is ready.",
    eyebrow: "Welcome",
    heading: "Welcome to Shopyos",
    summary: "Your account is ready. Start shopping from local stores, discover sellers nearby, and track orders in one place.",
    body: `<p>Hi <strong>Kwame</strong>,</p><p>Thanks for joining Shopyos. We built Shopyos to make local commerce feel simple, trusted, and close to home.</p>${button("Start shopping", "green")}<div class="note"><p><strong>Your account is protected.</strong> We use secure sign-in, encrypted payments, and order updates to help keep your shopping experience safe.</p></div><p>Questions? Reply to this email and our support team will help.</p>`
  }),
  "02-verify-account.html": layout({
    title: "Shopyos - Verify Account",
    preheader: "Use this code to verify your Shopyos account.",
    eyebrow: "Account verification",
    heading: "Verify your email address",
    summary: "Enter this code in Shopyos to finish setting up your account.",
    body: `<p>Hi <strong>Kwame</strong>,</p><p>Use the verification code below to complete your Shopyos account setup.</p><div class="code">482913</div><div class="note"><p>This code expires in 10 minutes. Shopyos will never ask you to share this code by phone, text, or email.</p></div><p>If you did not create a Shopyos account, you can safely ignore this email.</p>`
  }),
  "03-password-reset.html": layout({
    title: "Shopyos - Password Reset",
    preheader: "Reset your Shopyos password securely.",
    eyebrow: "Security",
    heading: "Reset your password",
    summary: "We received a request to reset the password for kofi@example.com.",
    body: `<p>Hi <strong>Kofi</strong>,</p><p>Click the button below to choose a new password. This link expires in 30 minutes for your security.</p>${button("Reset password")}<div class="note"><p>If you did not request this, no action is needed. Your password will stay the same.</p></div>`
  }),
  "04-order-confirmed.html": layout({
    title: "Shopyos - Order Confirmed",
    preheader: "Your Shopyos order #SHP-20847 has been confirmed.",
    eyebrow: "Order confirmed",
    heading: "We received your order",
    summary: "Order #SHP-20847 is confirmed. The seller has been notified and will prepare it shortly.",
    body: `<p>Hi <strong>Abena</strong>,</p><p>Thanks for shopping on Shopyos. Here is your order summary.</p>${item("F", "Fresh Tilapia (1kg)", "Qty: 2 - Kumasi Fish Market", "GHâ‚µ 48.00")}${item("J", "Jollof Rice + Chicken", "Qty: 1 - Mama's Kitchen", "GHâ‚µ 35.00")}<table role="presentation" class="total" width="100%"><tr><td>Subtotal</td><td class="price">GHâ‚µ 83.00</td></tr><tr><td>Delivery</td><td class="price">GHâ‚µ 8.00</td></tr><tr><td>Discount</td><td class="price">-GHâ‚µ 5.00</td></tr><tr class="final"><td>Total paid</td><td class="price">GHâ‚µ 86.00</td></tr></table>${details([["Delivery address", "Asokwa, Kumasi"], ["Estimated delivery", "Today, 2-4 PM"], ["Payment", "Mobile Money ****4821"], ["Order ID", "#SHP-20847"]])}${button("Track order", "green")}`
  }),
  "05-order-shipped.html": layout({
    title: "Shopyos - Order Shipped",
    preheader: "Your Shopyos order is on the way.",
    eyebrow: "Out for delivery",
    heading: "Your order is on the way",
    summary: "Order #SHP-20847 has left the seller and is heading to your delivery address.",
    body: `<p>Hi <strong>Abena</strong>,</p><p>Your rider is on the way. You can track the delivery status in real time.</p><table role="presentation" class="steps"><tr><td><div class="dot">1</div>Confirmed</td><td><div class="dot">2</div>Prepared</td><td><div class="dot">3</div>On the way</td><td><div class="dot muted">4</div>Delivered</td></tr></table>${details([["Order ID", "#SHP-20847"], ["Rider", "Yaw Mensah"], ["ETA", "25-35 minutes"], ["Delivery address", "Asokwa, Kumasi"]])}${button("Track live delivery", "green")}`
  }),
  "06-order-delivered.html": layout({
    title: "Shopyos - Order Delivered",
    preheader: "Your Shopyos order has been delivered.",
    eyebrow: "Delivered",
    heading: "Your order has arrived",
    summary: "Order #SHP-20847 was delivered successfully. We hope everything looks good.",
    body: `<p>Hi <strong>Abena</strong>,</p><p>Your order has been marked as delivered. Thanks for supporting local businesses through Shopyos.</p>${details([["Delivered to", "Asokwa, Kumasi"], ["Delivered at", "3:18 PM"], ["Order ID", "#SHP-20847"], ["Total paid", "GHâ‚µ 86.00"]])}${button("Rate your order", "green")}<div class="note"><p>Your feedback helps sellers improve and helps other shoppers choose with confidence.</p></div>`
  }),
  "07-abandoned-cart.html": layout({
    title: "Shopyos - Items In Your Cart",
    preheader: "You left a few items in your Shopyos cart.",
    eyebrow: "Cart reminder",
    heading: "Still thinking it over?",
    summary: "Your cart is saved. Complete checkout before these local items sell out.",
    body: `<p>Hi <strong>Akosua</strong>,</p><p>You left these items in your cart. We saved them so you can pick up where you left off.</p>${item("B", "Blue Ankara Tote", "Qty: 1 - Adinkra Studio", "GHâ‚µ 72.00")}${item("S", "Shea Butter Set", "Qty: 2 - Northern Naturals", "GHâ‚µ 54.00")}${button("Return to cart", "green")}<div class="note"><p>Popular local items can sell quickly, and seller availability may change.</p></div>`
  }),
  "08-weekly-deals.html": layout({
    title: "Shopyos - Weekly Deals",
    preheader: "Fresh deals from Shopyos sellers near you.",
    eyebrow: "Weekly deals",
    heading: "Fresh local deals this week",
    summary: "Handpicked offers from Shopyos sellers near you.",
    body: `<p>Hi <strong>Kwame</strong>,</p><p>Here are a few deals worth checking out this week.</p><table role="presentation" class="products"><tr><td><div class="product"><div class="product-name">Fresh Tilapia Pack</div><div class="product-price">GHâ‚µ 42.00</div><span class="pill">15% off</span></div></td><td><div class="product"><div class="product-name">Ankara Tote Bag</div><div class="product-price">GHâ‚µ 61.00</div><span class="pill">New deal</span></div></td></tr><tr><td><div class="product"><div class="product-name">Shea Butter Set</div><div class="product-price">GHâ‚µ 45.00</div><span class="pill">Bundle</span></div></td><td><div class="product"><div class="product-name">Jollof Lunch Box</div><div class="product-price">GHâ‚µ 28.00</div><span class="pill">Today only</span></div></td></tr></table>${button("Shop weekly deals", "green")}`
  })
};

for (const [file, html] of Object.entries(pages)) {
  fs.writeFileSync(file, html, "utf8");
}

