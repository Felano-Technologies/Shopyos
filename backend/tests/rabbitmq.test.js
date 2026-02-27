require('dotenv').config();
const { getWelcomeTemplates, getOrderCreatedTemplates } = require('../templates');
const rabbitMQService = require('../services/rabbitmq');

async function runTests() {
    console.log('--- Running Template Unit Tests ---');

    // 1. Template tests
    const buyerWelcome = getWelcomeTemplates('buyer', 'Jane Doe', '+233123456');
    if (buyerWelcome.email.subject !== 'Welcome to Shopyos!') throw new Error('Welcome buyer subject mismatch');
    if (!buyerWelcome.sms.includes('Jane Doe')) throw new Error('Welcome buyer SMS missing name');
    console.log('✅ Buyer welcome template OK');

    const sellerWelcome = getWelcomeTemplates('seller', 'Store Owner', '+233987654');
    if (!sellerWelcome.sms.includes('start listing products')) throw new Error('Welcome seller SMS mismatch');
    console.log('✅ Seller welcome template OK');

    const orderCreated = getOrderCreatedTemplates('buyer', { orderId: 'ORD-1234', amount: '150.00', customerName: 'John', itemsCount: 2 });
    if (!orderCreated.email.html.includes('150.00')) throw new Error('Order template missing amount');
    if (!orderCreated.sms.includes('ORD-1234')) throw new Error('Order SMS missing ID');
    console.log('✅ Order created template OK');

    // 2. Integration / publishing test
    console.log('\n--- Running RabbitMQ Integration Test ---');

    try {
        await rabbitMQService.connect();

        // Publish a dummy email test
        const publishedEmail = await rabbitMQService.publishMessage('email', {
            eventType: 'WELCOME_EMAIL',
            userId: 'test-uuid-1234',
            role: 'buyer',
            email: 'test@shopyos.com',
            templateData: { name: 'Integration Test User', phone: '+123456789' }
        });

        if (publishedEmail) {
            console.log('✅ Successfully published test email to RabbitMQ');
        } else {
            console.error('❌ Failed to publish test email to RabbitMQ');
        }

        // Publish a dummy SMS test
        const publishedSms = await rabbitMQService.publishMessage('sms', {
            eventType: 'WELCOME_SMS',
            userId: 'test-uuid-1234',
            role: 'buyer',
            phone: '+1234567890',
            templateData: { name: 'Integration SMS Test', phone: '+123456789' }
        });

        if (publishedSms) {
            console.log('✅ Successfully published test SMS to RabbitMQ');
        } else {
            console.error('❌ Failed to publish test SMS to RabbitMQ');
        }

    } catch (error) {
        console.error('❌ Integration test failed to connect or publish:', error);
    } finally {
        // Give it a second to flush the buffer before exiting
        setTimeout(async () => {
            await rabbitMQService.close();
            console.log('\nAll tests completed.');
            process.exit(0);
        }, 1000);
    }
}

// Run if executed directly
if (require.main === module) {
    runTests();
}
