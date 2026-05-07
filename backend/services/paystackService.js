// services/paystackService.js
const axios = require('axios');
const { logger } = require('../config/logger');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const paystackHeaders = () => ({
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
});

/**
 * Create a transfer recipient on Paystack
 * @param {Object} recipientData - { name, account_number, bank_code, currency }
 * @returns {Promise<string>} Recipient code
 */
const createTransferRecipient = async (recipientData) => {
    try {
        const response = await axios.post(
            `${PAYSTACK_BASE_URL}/transferrecipient`,
            {
                type: 'nuban', // for bank accounts, or 'mobile_money'
                name: recipientData.name,
                account_number: recipientData.account_number,
                bank_code: recipientData.bank_code,
                currency: recipientData.currency || 'GHS'
            },
            { headers: paystackHeaders() }
        );

        if (!response.data.status) {
            throw new Error(response.data.message || 'Failed to create transfer recipient');
        }

        return response.data.data.recipient_code;
    } catch (error) {
        logger.error('Paystack createTransferRecipient error', { 
            error: error.response?.data || error.message 
        });
        throw error;
    }
};

/**
 * Initiate a transfer on Paystack
 * @param {Object} transferData - { amount, recipient, reason }
 * @returns {Promise<Object>} Transfer response data
 */
const initiateTransfer = async (transferData) => {
    try {
        const response = await axios.post(
            `${PAYSTACK_BASE_URL}/transfer`,
            {
                source: 'balance',
                amount: Math.round(transferData.amount * 100), // convert to pesewas
                recipient: transferData.recipient,
                reason: transferData.reason || 'Payout from Shopyos',
                currency: 'GHS'
            },
            { headers: paystackHeaders() }
        );

        if (!response.data.status) {
            throw new Error(response.data.message || 'Failed to initiate transfer');
        }

        return response.data.data;
    } catch (error) {
        logger.error('Paystack initiateTransfer error', { 
            error: error.response?.data || error.message 
        });
        throw error;
    }
};

/**
 * List Banks (to get bank codes)
 * @returns {Promise<Array>} List of banks
 */
const listBanks = async (country = 'ghana') => {
    try {
        const response = await axios.get(
            `${PAYSTACK_BASE_URL}/bank?country=${country}`,
            { headers: paystackHeaders() }
        );
        return response.data.data;
    } catch (error) {
        logger.error('Paystack listBanks error', { error: error.message });
        throw error;
    }
};

module.exports = {
    createTransferRecipient,
    initiateTransfer,
    listBanks
};
