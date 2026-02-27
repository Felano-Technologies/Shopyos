// templates/index.js
// Centralized templates for Email and SMS notifications

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

module.exports = {
    getWelcomeTemplates,
    getOrderCreatedTemplates
};
