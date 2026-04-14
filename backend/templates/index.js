// templates/index.js
// Centralized templates for Email and SMS notifications

const safe = (v, fallback = '') => (v === undefined || v === null ? fallback : String(v));

const wrapHtml = (title, bodyHtml) => `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #0f172a;">
        <div style="background: linear-gradient(135deg, #0C1559, #1e3a8a); color: #fff; padding: 18px 22px; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0; font-size: 20px;">${title}</h2>
        </div>
        <div style="padding: 20px 22px; border: 1px solid #e2e8f0; border-top: 0; border-radius: 0 0 12px 12px; background: #ffffff;">
            ${bodyHtml}
            <p style="margin-top: 20px; color: #64748b; font-size: 12px;">This is an automated message from Shopyos.</p>
        </div>
    </div>
`;

const getWelcomeTemplates = (role, name, phone) => {
    const commonSms = `Welcome to Shopyos, ${name}! Your account is ready.`;

    if (role === 'seller') {
        return {
            email: {
                subject: 'Welcome to Shopyos - Start Selling!',
                html: `<h2>Welcome, ${name}!</h2><p>Your Shopyos Seller account is ready. Start listing your products today!</p>`
            },
            sms: `${commonSms} You can now start listing products.`
        };
    } else if (role === 'driver') {
        return {
            email: {
                subject: 'Welcome to Shopyos Drivers!',
                html: `<h2>Welcome, ${name}!</h2><p>Your Shopyos Driver account is active. Log in to start picking up orders!</p>`
            },
            sms: `${commonSms} Log in to start picking up deliveries.`
        };
    } else if (role === 'admin') {
        return {
            email: {
                subject: 'Admin Access Granted',
                html: `<h2>Welcome Admin ${name}</h2><p>Your admin dashboard access is ready.</p>`
            },
            sms: `${commonSms} Administrator dashboard access granted.`
        };
    } else {
        // Default to buyer
        return {
            email: {
                subject: 'Welcome to Shopyos!',
                html: `<h2>Welcome, ${name}!</h2><p>Thank you for joining Shopyos. Start exploring amazing products!</p>`
            },
            sms: `${commonSms} Enjoy your shopping experience!`
        };
    }
};

const getRoleSelectedTemplates = (role, name) => {
    const roleLabel = role === 'seller' ? 'Seller' : role === 'driver' ? 'Driver' : role === 'admin' ? 'Admin' : 'Buyer';
    return {
        email: {
            subject: `Shopyos ${roleLabel} role activated`,
            html: wrapHtml('Role Activated', `
              <p>Hi ${safe(name, 'there')},</p>
              <p>Your <strong>${roleLabel}</strong> role has been activated successfully.</p>
              <p>You can now access features for this role in the app.</p>
            `)
        },
        sms: `Shopyos: Your ${roleLabel} role is now active. Open the app to continue.`
    };
};

const getOrderCreatedTemplates = (role, data) => {
    const { orderId, amount, customerName, itemsCount } = data;

    if (role === 'buyer') {
        return {
            email: {
                subject: `Order Confirmed: #${orderId}`,
                html: `<h2>Order #${orderId} Confirmed</h2>
               <p>Hi ${customerName},</p>
               <p>Your order for ${itemsCount} items totaling ₵${amount} has been successfully placed!</p>
               <p>We will notify you when it ships.</p>`
            },
            sms: `Shopyos: Your order #${orderId} for ₵${amount} is confirmed! We will update you on delivery.`
        };
    } else if (role === 'seller') {
        return {
            email: {
                subject: `New Order Received: #${orderId}`,
                html: `<h2>New Order Received</h2>
               <p>You have a new order (#${orderId}) to fulfill.</p>
               <p>Value: ₵${amount}</p>`
            },
            sms: `Shopyos Stores: New order #${orderId} received for ₵${amount}. Please prepare for fulfillment.`
        };
    }
    return null;
};

const getBusinessVerificationSubmittedTemplates = (data = {}) => {
    const businessName = safe(data.businessName, 'your business');
    const audience = safe(data.audience, 'owner');

    if (audience === 'admin') {
        return {
            email: {
                subject: `Business verification request: ${businessName}`,
                html: wrapHtml('New Business Verification Request', `
                  <p>A business submitted verification documents.</p>
                  <p><strong>Business:</strong> ${businessName}</p>
                  <p>Please review this request in the admin dashboard.</p>
                `)
            }
        };
    }

    return {
        email: {
            subject: `Verification submitted for ${businessName}`,
            html: wrapHtml('Verification Submitted', `
              <p>Hi ${safe(data.ownerName, 'there')},</p>
              <p>We received your verification documents for <strong>${businessName}</strong>.</p>
              <p>Our team will review and update you once the decision is made.</p>
            `)
        }
    };
};

const getBusinessVerificationResultTemplates = (data = {}) => {
    const businessName = safe(data.businessName, 'your business');
    const status = safe(data.status, '').toLowerCase();
    const approved = status === 'verified' || status === 'approved';
    const reason = safe(data.reason, '');

    return {
        email: {
            subject: approved
                ? `${businessName} verification approved`
                : `${businessName} verification update`,
            html: wrapHtml(
                approved ? 'Business Approved' : 'Business Verification Update',
                approved
                    ? `<p>Great news. <strong>${businessName}</strong> has been verified and approved.</p>
                       <p>You can now continue using verified business features.</p>`
                    : `<p>Your verification request for <strong>${businessName}</strong> was not approved.</p>
                       ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                       <p>Please update the required details and submit again.</p>`
            )
        }
    };
};

const getDriverVerificationSubmittedTemplates = (data = {}) => {
    const driverName = safe(data.driverName, 'Driver');
    const audience = safe(data.audience, 'driver');

    if (audience === 'admin') {
        return {
            email: {
                subject: `Driver verification request: ${driverName}`,
                html: wrapHtml('New Driver Verification Request', `
                  <p>A driver has submitted verification documents.</p>
                  <p><strong>Driver:</strong> ${driverName}</p>
                  <p>Please review this request in the admin dashboard.</p>
                `)
            }
        };
    }

    return {
        email: {
            subject: 'Driver verification submitted',
            html: wrapHtml('Verification Submitted', `
              <p>Hi ${driverName},</p>
              <p>Your driver verification documents were submitted successfully.</p>
              <p>We will notify you after review.</p>
            `)
        }
    };
};

const getDriverVerificationResultTemplates = (data = {}) => {
    const driverName = safe(data.driverName, 'there');
    const status = safe(data.status, '').toLowerCase();
    const approved = status === 'verified' || status === 'approved';
    const reason = safe(data.reason, '');

    return {
        email: {
            subject: approved ? 'Driver verification approved' : 'Driver verification update',
            html: wrapHtml(
                approved ? 'Driver Approved' : 'Driver Verification Update',
                approved
                    ? `<p>Hi ${driverName},</p><p>Your driver verification has been approved. You can now start taking deliveries.</p>`
                    : `<p>Hi ${driverName},</p><p>Your driver verification was not approved.</p>${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}`
            )
        }
    };
};

const getOrderDeliveredTemplates = (data = {}) => {
    const orderId = safe(data.orderId, '');
    const amount = safe(data.amount, '');
    return {
        email: {
            subject: `Order delivered: #${orderId}`,
            html: wrapHtml('Order Delivered', `
              <p>Your order <strong>#${orderId}</strong> has been marked as delivered.</p>
              ${amount ? `<p><strong>Total:</strong> ₵${amount}</p>` : ''}
              <p>Thanks for shopping with Shopyos.</p>
            `)
        },
        sms: `Shopyos: Your order #${orderId} has been delivered.`
    };
};

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
    getEmailTemplateByEvent,
    getSmsTemplateByEvent
};
