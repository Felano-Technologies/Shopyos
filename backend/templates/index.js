// templates/index.js
// Centralized templates for Email and SMS notifications

const safe = (v, fallback = '') => (v === undefined || v === null ? fallback : String(v));

// ─── Shared email CSS (Shopyos design system) ──────────────────────────────────
// Palette sourced from frontend/components/admin/adminTheme.ts (adminColors) —
// the app's canonical brand tokens.
const baseCss = `
  body { margin:0; padding:0; background:#F5F7FA; color:#0F172A; font-family:Arial, Helvetica, sans-serif; -webkit-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  a { color:#3B82F6; text-decoration:none; }
  .page { width:100%; background:#F5F7FA; padding:32px 12px; }
  .container { width:100%; max-width:600px; margin:0 auto; }
  .brand { padding:0 0 18px; text-align:left; }
  .brand img { height:32px; width:auto; }
  .card { background:#FFFFFF; border:1px solid #E8EEF8; border-radius:8px; overflow:hidden; }
  .mast { padding:32px 40px 22px; border-bottom:1px solid #E2E8F0; }
  h1 { margin:0; color:#0C1559; font-size:26px; line-height:34px; font-weight:700; letter-spacing:-0.3px; }
  .content { padding:30px 40px 36px; font-size:15px; line-height:1.7; color:#0F172A; }
  .content p { margin:0 0 16px; }
  .button-wrap { padding:10px 0 8px; text-align:center; }
  .button { display:inline-block; background-color:#0C1559; background-image:linear-gradient(135deg,#0C1559,#1e3a8a); color:#ffffff!important; border-radius:50px; font-size:14px; font-weight:700; padding:14px 36px; }
  .note { background:#F5F7FA; border:1px solid #E2E8F0; border-radius:8px; padding:16px 18px; margin:8px 0 22px; }
  .note p { margin:0; color:#64748B; font-size:14px; line-height:22px; }
  .footer { padding:22px 8px 0; text-align:center; color:#94A3B8; font-size:12px; line-height:20px; }
  @media only screen and (max-width:520px) {
    .page { padding:20px 8px!important; }
    .mast, .content { padding-left:22px!important; padding-right:22px!important; }
    h1 { font-size:22px!important; line-height:29px!important; }
  }`;

// ─── Shared HTML shell ────────────────────────────────────────────────────────
const wrapHtml = (title, bodyHtml, ctaHref = null, ctaLabel = null) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>${baseCss}</style>
</head>
<body>
  <table role="presentation" class="page" width="100%">
    <tr>
      <td align="center">
        <table role="presentation" class="container" width="100%">

          <!-- Brand -->
          <tr><td class="brand"><img src="cid:shopyos-logo" alt="Shopyos" /></td></tr>

          <!-- Card -->
          <tr>
            <td class="card">
              <table role="presentation" width="100%">
                <tr><td class="mast"><h1>${title}</h1></td></tr>
                <tr>
                  <td class="content">
                    ${bodyHtml}
                    ${ctaHref && ctaLabel ? `<div class="button-wrap"><a href="${ctaHref}" class="button">${ctaLabel}</a></div>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Shopyos. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ─── Divider helper ───────────────────────────────────────────────────────────
const divider = `<hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;" />`;

// ─── Info row helper (label + value) ─────────────────────────────────────────
const infoRow = (label, value) => `
  <tr>
    <td style="padding:12px 0;border-bottom:1px solid #E2E8F0;font-size:14px;color:#64748B;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:12px 0;border-bottom:1px solid #E2E8F0;font-size:14px;color:#0F172A;font-weight:700;">${value}</td>
  </tr>
`;

// ─── Highlight badge ──────────────────────────────────────────────────────────
const badge = (text, color = '#3B82F6') =>
  `<span class="pill" style="display:inline-block;background:${color}15;color:${color};font-size:12px;font-weight:700;padding:4px 12px;border-radius:50px;letter-spacing:0.5px;text-transform:uppercase;">${text}</span>`;


// ─────────────────────────────────────────────────────────────────────────────
//  WELCOME
// ─────────────────────────────────────────────────────────────────────────────
const getWelcomeTemplates = (role, name, _phone) => {
    const displayName = safe(name, 'there');
    const commonSms = `Welcome to Shopyos, ${displayName}! Your account is ready.`;

    const roleConfigs = {
        seller: {
            subject: 'Welcome to Shopyos — Start Selling!',
            headline: `Welcome aboard, ${displayName}!`,
            badge: badge('Seller Account', '#8B5CF6'),
            body: `
              <p>Your <strong>Seller account</strong> is all set and ready to go.</p>
              <p>You can now create your store, list your products, and start reaching thousands of customers across Ghana.</p>
              ${divider}
              <p style="font-size:14px;color:#64748b;">Head over to the Shopyos app to set up your store profile and publish your first listing.</p>
            `,
            cta: { href: '#', label: 'Open Seller Dashboard' },
            sms: `${commonSms} You can now start listing products.`
        },
        driver: {
            subject: 'Welcome to Shopyos Drivers!',
            headline: `Welcome, ${displayName}!`,
            badge: badge('Driver Account', '#22C55E'),
            body: `
              <p>Your <strong>Driver account</strong> is now active and ready for deliveries.</p>
              <p>Log in to the Shopyos Driver app to go online and start picking up orders near you.</p>
              ${divider}
              <p style="font-size:14px;color:#64748b;">Make sure your vehicle details and availability settings are up to date before going online.</p>
            `,
            cta: { href: '#', label: 'Open Driver App' },
            sms: `${commonSms} Log in to start picking up deliveries.`
        },
        admin: {
            subject: 'Shopyos Admin Access Granted',
            headline: `Welcome, Admin ${displayName}`,
            badge: badge('Admin Access', '#EF4444'),
            body: `
              <p>Your <strong>Admin access</strong> has been granted.</p>
              <p>You can now manage users, approve verifications, and oversee platform activity from the admin dashboard.</p>
            `,
            cta: { href: '#', label: 'Go to Admin Dashboard' },
            sms: `${commonSms} Administrator dashboard access granted.`
        },
        default: {
            subject: 'Welcome to Shopyos! 🎉',
            headline: `Welcome, ${displayName}!`,
            badge: badge('New Account'),
            body: `
              <p>We're thrilled to have you on <strong>Shopyos</strong> — Ghana's smart shopping platform.</p>
              <p>Browse thousands of products, track your orders in real time, and enjoy a seamless shopping experience right from your phone.</p>
              ${divider}
              <p style="font-size:14px;color:#64748b;">Download the Shopyos app and start exploring today.</p>
            `,
            cta: { href: '#', label: 'Start Shopping' },
            sms: `${commonSms} Enjoy your shopping experience!`
        }
    };

    const cfg = roleConfigs[role] || roleConfigs.default;

    return {
        email: {
            subject: cfg.subject,
            html: wrapHtml(
                cfg.headline,
                `${cfg.badge}<br/><br/>${cfg.body}`,
                cfg.cta.href,
                cfg.cta.label
            )
        },
        sms: cfg.sms
    };
};


// ─────────────────────────────────────────────────────────────────────────────
//  ROLE SELECTED
// ─────────────────────────────────────────────────────────────────────────────
const getRoleSelectedTemplates = (role, name) => {
    const nonSellerRoleLabel = role === 'admin' ? 'Admin' : 'Buyer';
    const innerRoleLabel = role === 'driver' ? 'Driver' : nonSellerRoleLabel;
    const roleLabel = role === 'seller' ? 'Seller' : innerRoleLabel;
    const displayName = safe(name, 'there');

    return {
        email: {
            subject: `Your Shopyos ${roleLabel} role is now active`,
            html: wrapHtml(
                'Role Activated',
                `
                  <p>Hi <strong>${displayName}</strong>,</p>
                  <p>Your <strong>${roleLabel}</strong> role has been activated successfully on Shopyos.</p>
                  ${divider}
                  <p style="font-size:14px;color:#64748b;">You now have access to all features associated with this role. Open the app to get started.</p>
                `,
                '#',
                'Open Shopyos App'
            )
        },
        sms: `Shopyos: Your ${roleLabel} role is now active. Open the app to continue.`
    };
};


// ─────────────────────────────────────────────────────────────────────────────
//  ORDER CREATED
// ─────────────────────────────────────────────────────────────────────────────
const getOrderCreatedTemplates = (role, data) => {
    const { orderId, amount, customerName, itemsCount } = data;
    const displayName = safe(customerName, 'there');

    if (role === 'buyer') {
        return {
            email: {
                subject: `Order Confirmed — #${orderId}`,
                html: wrapHtml(
                    'Order Confirmed!',
                    `
                      <p>Hi <strong>${displayName}</strong>,</p>
                      <p>Your order has been placed successfully. Here's a summary:</p>
                      ${divider}
                      <table cellpadding="0" cellspacing="0" style="width:100%;">
                        ${infoRow('Order ID', `#${safe(orderId)}`)}
                        ${infoRow('Items', safe(itemsCount))}
                        ${infoRow('Total', `₵${safe(amount)}`)}
                        ${infoRow('Status', badge('Confirmed', '#22C55E'))}
                      </table>
                      ${divider}
                      <p style="font-size:14px;color:#64748b;">We'll notify you as soon as your order is on its way. Thank you for shopping with Shopyos!</p>
                    `,
                    '#',
                    'Track My Order'
                )
            },
            sms: `Shopyos: Your order #${orderId} for ₵${amount} is confirmed! We'll update you on delivery.`
        };
    }

    if (role === 'seller') {
        return {
            email: {
                subject: `New Order Received — #${orderId}`,
                html: wrapHtml(
                    'New Order Received',
                    `
                      <p>You have a new order to fulfill:</p>
                      ${divider}
                      <table cellpadding="0" cellspacing="0" style="width:100%;">
                        ${infoRow('Order ID', `#${safe(orderId)}`)}
                        ${infoRow('Value', `₵${safe(amount)}`)}
                        ${infoRow('Status', badge('Awaiting Fulfilment', '#F59E0B'))}
                      </table>
                      ${divider}
                      <p style="font-size:14px;color:#64748b;">Please prepare and ship the items as soon as possible. Open your seller dashboard for details.</p>
                    `,
                    '#',
                    'View Order Details'
                )
            },
            sms: `Shopyos Stores: New order #${orderId} received for ₵${amount}. Please prepare for fulfilment.`
        };
    }

    return null;
};


// ─────────────────────────────────────────────────────────────────────────────
//  BUSINESS VERIFICATION SUBMITTED
// ─────────────────────────────────────────────────────────────────────────────
const getBusinessVerificationSubmittedTemplates = (data = {}) => {
    const businessName = safe(data.businessName, 'your business');
    const audience = safe(data.audience, 'owner');

    if (audience === 'admin') {
        return {
            email: {
                subject: `Review required: ${businessName} verification`,
                html: wrapHtml(
                    'New Verification Request',
                    `
                      <p>A seller has submitted documents for business verification.</p>
                      ${divider}
                      <table cellpadding="0" cellspacing="0" style="width:100%;">
                        ${infoRow('Business', businessName)}
                        ${infoRow('Action required', badge('Pending Review', '#F59E0B'))}
                      </table>
                      ${divider}
                      <p style="font-size:14px;color:#64748b;">Please log in to the admin dashboard to review and approve or reject this request.</p>
                    `,
                    '#',
                    'Review in Dashboard'
                )
            }
        };
    }

    return {
        email: {
            subject: `Verification submitted — ${businessName}`,
            html: wrapHtml(
                'Verification Submitted',
                `
                  <p>Hi <strong>${safe(data.ownerName, 'there')}</strong>,</p>
                  <p>We've received your verification documents for <strong>${businessName}</strong>.</p>
                  ${divider}
                  <p>Our team will carefully review your submission and notify you of the outcome within <strong>2–3 business days</strong>.</p>
                  <p style="font-size:14px;color:#64748b;">If you have questions, please contact our support team.</p>
                `
            )
        }
    };
};


// ─────────────────────────────────────────────────────────────────────────────
//  BUSINESS VERIFICATION RESULT
// ─────────────────────────────────────────────────────────────────────────────
const getBusinessVerificationResultTemplates = (data = {}) => {
    const businessName = safe(data.businessName, 'your business');
    const status = safe(data.status, '').toLowerCase();
    const approved = status === 'verified' || status === 'approved';
    const reason = safe(data.reason, '');
    const reasonHtml = reason ? `<p><strong>Reason:</strong> ${reason}</p>` : '';

    return {
        email: {
            subject: approved
                ? `🎉 ${businessName} — Verification Approved`
                : `${businessName} — Verification Update`,
            html: wrapHtml(
                approved ? 'Business Approved!' : 'Verification Update',
                approved
                    ? `
                        <p>${badge('Approved', '#22C55E')}</p><br/>
                        <p>Great news! <strong>${businessName}</strong> has been verified and approved on Shopyos.</p>
                        <p>You can now access all verified seller features, including increased visibility and trusted badges.</p>
                        ${divider}
                        <p style="font-size:14px;color:#64748b;">Open your seller dashboard to continue growing your business.</p>
                      `
                    : `
                        <p>${badge('Not Approved', '#EF4444')}</p><br/>
                        <p>Unfortunately, your verification request for <strong>${businessName}</strong> was not approved at this time.</p>
                        ${reasonHtml}
                        ${divider}
                        <p style="font-size:14px;color:#64748b;">Please review the feedback above, update your documents, and resubmit. Contact support if you need help.</p>
                      `,
                approved ? '#' : null,
                approved ? 'Open Seller Dashboard' : null
            )
        }
    };
};


// ─────────────────────────────────────────────────────────────────────────────
//  DRIVER VERIFICATION SUBMITTED
// ─────────────────────────────────────────────────────────────────────────────
const getDriverVerificationSubmittedTemplates = (data = {}) => {
    const driverName = safe(data.driverName, 'Driver');
    const audience = safe(data.audience, 'driver');

    if (audience === 'admin') {
        return {
            email: {
                subject: `Review required: Driver verification — ${driverName}`,
                html: wrapHtml(
                    'New Driver Verification',
                    `
                      <p>A driver has submitted verification documents.</p>
                      ${divider}
                      <table cellpadding="0" cellspacing="0" style="width:100%;">
                        ${infoRow('Driver', driverName)}
                        ${infoRow('Action required', badge('Pending Review', '#F59E0B'))}
                      </table>
                      ${divider}
                      <p style="font-size:14px;color:#64748b;">Please log in to the admin dashboard to review this request.</p>
                    `,
                    '#',
                    'Review in Dashboard'
                )
            }
        };
    }

    return {
        email: {
            subject: 'Your driver verification has been submitted',
            html: wrapHtml(
                'Verification Submitted',
                `
                  <p>Hi <strong>${driverName}</strong>,</p>
                  <p>Your driver verification documents have been submitted successfully.</p>
                  ${divider}
                  <p>Our team will review your submission and notify you of the outcome within <strong>1–2 business days</strong>.</p>
                  <p style="font-size:14px;color:#64748b;">Make sure your vehicle details and licence information are correct while we review.</p>
                `
            )
        }
    };
};


// ─────────────────────────────────────────────────────────────────────────────
//  DRIVER VERIFICATION RESULT
// ─────────────────────────────────────────────────────────────────────────────
const getDriverVerificationResultTemplates = (data = {}) => {
    const driverName = safe(data.driverName, 'there');
    const status = safe(data.status, '').toLowerCase();
    const approved = status === 'verified' || status === 'approved';
    const reason = safe(data.reason, '');
    const driverReasonHtml = reason ? `<p><strong>Reason:</strong> ${reason}</p>` : '';

    return {
        email: {
            subject: approved ? '🎉 Driver Verification Approved' : 'Driver Verification Update',
            html: wrapHtml(
                approved ? 'You\'re Approved!' : 'Verification Update',
                approved
                    ? `
                        <p>${badge('Approved', '#22C55E')}</p><br/>
                        <p>Hi <strong>${driverName}</strong>,</p>
                        <p>Your driver verification has been approved! You're now cleared to start accepting and completing deliveries on Shopyos.</p>
                        ${divider}
                        <p style="font-size:14px;color:#64748b;">Open the Shopyos Driver app, go online, and start earning.</p>
                      `
                    : `
                        <p>${badge('Not Approved', '#EF4444')}</p><br/>
                        <p>Hi <strong>${driverName}</strong>,</p>
                        <p>Unfortunately, your driver verification was not approved at this time.</p>
                        ${driverReasonHtml}
                        ${divider}
                        <p style="font-size:14px;color:#64748b;">Please review the feedback, update any required documents, and resubmit your verification.</p>
                      `,
                approved ? '#' : null,
                approved ? 'Open Driver App' : null
            )
        }
    };
};


// ─────────────────────────────────────────────────────────────────────────────
//  ORDER DELIVERED
// ─────────────────────────────────────────────────────────────────────────────
const getOrderDeliveredTemplates = (data = {}) => {
    const orderId = safe(data.orderId, '');
    const amount = safe(data.amount, '');

    return {
        email: {
            subject: `Your order #${orderId} has been delivered!`,
            html: wrapHtml(
                'Order Delivered!',
                `
                  <p>Your order has arrived — we hope you love it! 🎉</p>
                  ${divider}
                  <table cellpadding="0" cellspacing="0" style="width:100%;">
                    ${infoRow('Order ID', `#${orderId}`)}
                    ${amount ? infoRow('Total Paid', `₵${amount}`) : ''}
                    ${infoRow('Status', badge('Delivered', '#22C55E'))}
                  </table>
                  ${divider}
                  <p style="font-size:14px;color:#64748b;">Enjoying your order? Leave a review to help other shoppers and reward great sellers.</p>
                `,
                '#',
                'Leave a Review'
            )
        },
        sms: `Shopyos: Your order #${orderId} has been delivered. Thank you for shopping with us!`
    };
};


// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN BROADCAST (manual scheduled) & HOLIDAY CELEBRATION
// ─────────────────────────────────────────────────────────────────────────────
const getOrderPickedUpTemplates = (data = {}) => {
    const orderNumber = safe(data.orderNumber, '');
    const verificationPin = safe(data.verificationPin, '');

    return {
        email: {
            subject: `Your order #${orderNumber} is on its way!`,
            html: wrapHtml(
                'Order On The Way!',
                `
                  <p>Your order #${orderNumber} has been picked up by the driver and is on its way to you! 🎉</p>
                  ${divider}
                  <p style="font-size:16px;">Give this security PIN to the driver upon delivery to confirm you received your order:</p>
                  <div style="font-size:32px;font-weight:700;color:#0C1559;letter-spacing:4px;text-align:center;padding:20px;background:#f8fafc;border-radius:12px;margin:20px 0;">
                    ${verificationPin}
                  </div>
                  ${divider}
                  <p style="font-size:14px;color:#64748b;">Please do not share this PIN with anyone until the driver has physically delivered your order.</p>
                `,
                '#',
                'Track My Order'
            )
        },
        sms: `Shopyos: Your order #${orderNumber} is on its way! Give this PIN to the driver upon delivery: ${verificationPin}`
    };
};

const getAdminBroadcastTemplate = (data = {}) => {
    const subject = safe(data.subject, 'A message from Shopyos');
    const html    = safe(data.html, `<p>${safe(data.textMsg, '')}</p>`);
    const text    = safe(data.textMsg, subject);

    return {
        email: {
            subject,
            html: wrapHtml(subject, html)
        },
        sms: text
    };
};

const getHolidayCelebrationTemplate = (data = {}) => {
    const subject  = safe(data.subject, 'Happy Holidays from Shopyos! 🎉');
    const bodyHtml = safe(data.html,
        `<p style="font-size:18px;text-align:center;">${safe(data.textMsg, subject)}</p>`);
    const text     = safe(data.textMsg, subject);

    return {
        email: {
            subject,
            html: wrapHtml(subject, bodyHtml)
        },
        sms: text
    };
};


// ─────────────────────────────────────────────────────────────────────────────
//  ROUTER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
const getEmailTemplateByEvent = (eventType, role, templateData = {}) => {
    switch (eventType) {
        case 'WELCOME_EMAIL':
            return getWelcomeTemplates(role, templateData.name, templateData.phone).email;
        case 'ROLE_SELECTED_EMAIL':
            return getRoleSelectedTemplates(role, templateData.name).email;
        case 'ORDER_CREATED':
            return getOrderCreatedTemplates(role, templateData)?.email;
        case 'BUSINESS_VERIFICATION_SUBMITTED':
            return getBusinessVerificationSubmittedTemplates(templateData).email;
        case 'BUSINESS_VERIFICATION_RESULT':
            return getBusinessVerificationResultTemplates(templateData).email;
        case 'DRIVER_VERIFICATION_SUBMITTED':
            return getDriverVerificationSubmittedTemplates(templateData).email;
        case 'DRIVER_VERIFICATION_RESULT':
            return getDriverVerificationResultTemplates(templateData).email;
        case 'ORDER_DELIVERED':
            return getOrderDeliveredTemplates(templateData).email;
        case 'ORDER_PICKED_UP':
            return getOrderPickedUpTemplates(templateData).email;
        case 'admin_broadcast':
            return getAdminBroadcastTemplate(templateData).email;
        case 'holiday_celebration':
            return getHolidayCelebrationTemplate(templateData).email;
        default:
            return null;
    }
};

const getSmsTemplateByEvent = (eventType, role, templateData = {}) => {
    switch (eventType) {
        case 'WELCOME_SMS':
            return getWelcomeTemplates(role, templateData.name, templateData.phone).sms;
        case 'ROLE_SELECTED_SMS':
            return getRoleSelectedTemplates(role, templateData.name).sms;
        case 'ORDER_CREATED':
            return getOrderCreatedTemplates(role, templateData)?.sms;
        case 'ORDER_DELIVERED':
            return getOrderDeliveredTemplates(templateData).sms;
        case 'ORDER_PICKED_UP':
            return getOrderPickedUpTemplates(templateData).sms;
        case 'admin_broadcast':
            return getAdminBroadcastTemplate(templateData).sms;
        case 'holiday_celebration':
            return getHolidayCelebrationTemplate(templateData).sms;
        default:
            return null;
    }
};

module.exports = {
    getWelcomeTemplates,
    getOrderCreatedTemplates,
    getRoleSelectedTemplates,
    getBusinessVerificationSubmittedTemplates,
    getBusinessVerificationResultTemplates,
    getDriverVerificationSubmittedTemplates,
    getDriverVerificationResultTemplates,
    getOrderDeliveredTemplates,
    getOrderPickedUpTemplates,
    getAdminBroadcastTemplate,
    getHolidayCelebrationTemplate,
    getEmailTemplateByEvent,
    getSmsTemplateByEvent
};
